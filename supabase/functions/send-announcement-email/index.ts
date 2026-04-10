// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_ADDRESS = Deno.env.get('FROM_ADDRESS') ?? 'ClassHub <noreply@classhub.work>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verify caller is an authenticated faculty member
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify the JWT using a user-scoped client
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader! } } }
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Service role client for all data operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'faculty') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse body
  const text = await req.text()
  if (!text) {
    return new Response(JSON.stringify({ error: 'Empty request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { announcement } = JSON.parse(text)
  if (!announcement) {
    return new Response(JSON.stringify({ error: 'Missing announcement in body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let emails: string[] = []

  if (announcement.course_id) {
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select('student_id')
      .eq('course_id', announcement.course_id)
    const studentIds = (enrollments ?? []).map((e: any) => e.student_id).filter(Boolean)
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('email')
        .in('id', studentIds)
      emails = (profiles ?? []).map((p: any) => p.email).filter(Boolean)
    }
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'student')
      .eq('status', 'approved')
    emails = (data ?? []).map((row: any) => row.email).filter(Boolean)
  }

  const [facultyRes, courseRes] = await Promise.all([
    supabase.from('profiles').select('full_name, first_name, last_name').eq('id', announcement.posted_by).single(),
    announcement.course_id
      ? supabase.from('courses').select('name, section').eq('id', announcement.course_id).single()
      : Promise.resolve({ data: null }),
  ])
  const facultyName = facultyRes.data
    ? (`${facultyRes.data.first_name ?? ''} ${facultyRes.data.last_name ?? ''}`).trim() || facultyRes.data.full_name || 'Your Instructor'
    : 'Your Instructor'
  const courseName = courseRes.data
    ? courseRes.data.name + (courseRes.data.section ? ` · Section ${courseRes.data.section}` : '')
    : 'All Courses'

  if (emails.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'No recipients found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Escape all user-controlled content before injecting into HTML
  const safeTitle = escapeHtml(announcement.title ?? '')
  const safeBody = escapeHtml(announcement.body ?? '')
  const safeFaculty = escapeHtml(facultyName)
  const safeCourse = escapeHtml(courseName)

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="margin:0; padding:0; background:#f4f4f5; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:#1D9E75; padding: 28px 32px;">
                    <p style="margin:0; font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">ClassHub</p>
                    <p style="margin:6px 0 0; font-size:13px; color:rgba(255,255,255,0.85);">Faculty: <strong>${safeFaculty}</strong> &nbsp;·&nbsp; Course: <strong>${safeCourse}</strong></p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 32px;">
                    <h1 style="margin:0 0 12px; font-size:22px; font-weight:600; color:#1a1a1a;">${safeTitle}</h1>
                    <p style="margin:0 0 24px; font-size:13px; color:#aaa;">Announcement for <strong style="color:#555;">${safeCourse}</strong></p>
                    <p style="margin:0; font-size:15px; color:#444; line-height:1.7; white-space:pre-wrap;">${safeBody}</p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 32px; border-top: 1px solid #f0f0f0; background:#fafafa;">
                    <p style="margin:0; font-size:12px; color:#aaa;">Posted by Faculty <strong>${safeFaculty}</strong> via ClassHub. You received this because you are enrolled in <strong>${safeCourse}</strong>. Please do not reply to this email.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const results = await Promise.all(emails.map(async email => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject: `[ClassHub] ${announcement.title}`,
        html,
      }),
    })
    const body = await res.json()
    if (!res.ok) {
      console.error('[Resend] Failed for', email, res.status, JSON.stringify(body))
    }
    return { email, ok: res.ok, status: res.status, body }
  }))

  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  return new Response(JSON.stringify({
    sent,
    failed: failed.length,
    errors: failed.map(r => ({ email: r.email, status: r.status, error: r.body })),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
