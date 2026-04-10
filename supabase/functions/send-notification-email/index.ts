import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_ADDRESS = Deno.env.get('FROM_ADDRESS') ?? 'ClassHub <noreply@classhub.work>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  })
  const body = await res.json()
  if (!res.ok) console.error('[Resend] Failed for', to, res.status, JSON.stringify(body))
  return res.ok
}

function baseTemplate(headerLine1: string, headerLine2: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#1D9E75;padding:28px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px;">ClassHub</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${headerLine1}${headerLine2 ? ` &nbsp;·&nbsp; ${headerLine2}` : ''}</p>
            </td>
          </tr>
          <tr><td style="padding:32px;">${bodyHtml}</td></tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f0f0f0;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#aaa;">Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader! } } }
  )
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: callerProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'faculty') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const { type } = body

  // ── Quiz opened / closed ────────────────────────────────────────────────────
  if (type === 'quiz_open' || type === 'quiz_close') {
    const { quizId } = body

    const { data: quiz } = await supabase
      .from('quizzes').select('title, course_id, due_date, item_type').eq('id', quizId).single()
    if (!quiz) return new Response(JSON.stringify({ error: 'Quiz not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    // Get recipient emails
    let emails: string[] = []
    if (quiz.course_id) {
      const { data: enrollments } = await supabase
        .from('course_enrollments').select('student_id').eq('course_id', quiz.course_id)
      const ids = (enrollments ?? []).map((e: any) => e.student_id).filter(Boolean)
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('email').in('id', ids)
        emails = (profiles ?? []).map((p: any) => p.email).filter(Boolean)
      }
    } else {
      const { data } = await supabase
        .from('profiles').select('email').eq('role', 'student').eq('status', 'approved')
      emails = (data ?? []).map((r: any) => r.email).filter(Boolean)
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: courseData } = quiz.course_id
      ? await supabase.from('courses').select('name, section').eq('id', quiz.course_id).single()
      : { data: null }

    const courseName = courseData
      ? courseData.name + (courseData.section ? ` · Section ${courseData.section}` : '')
      : 'All Courses'

    const isOpen = type === 'quiz_open'
    const safeTitle = escapeHtml(quiz.title)
    const safeType = escapeHtml(quiz.item_type ?? 'Assessment')
    const safeCourse = escapeHtml(courseName)
    const dueLine = quiz.due_date
      ? `<p style="margin:8px 0 0;font-size:14px;color:#666;">Due: <strong>${escapeHtml(new Date(quiz.due_date).toLocaleString())}</strong></p>`
      : ''

    const bodyHtml = isOpen
      ? `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a1a;">${safeTitle} is now open</h1>
         <p style="margin:0 0 4px;font-size:14px;color:#666;">${safeType} &nbsp;·&nbsp; ${safeCourse}</p>
         ${dueLine}
         <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">Log in to ClassHub to begin.</p>`
      : `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a1a;">${safeTitle} has closed</h1>
         <p style="margin:0;font-size:14px;color:#666;">${safeType} &nbsp;·&nbsp; ${safeCourse}</p>
         <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">Submissions are no longer accepted.</p>`

    const html = baseTemplate(`Course: ${safeCourse}`, '', bodyHtml)
    const subject = isOpen ? `[ClassHub] ${quiz.title} is now open` : `[ClassHub] ${quiz.title} has closed`

    const results = await Promise.all(emails.map(e => sendEmail(e, subject, html)))
    const sent = results.filter(Boolean).length
    return new Response(JSON.stringify({ sent, failed: results.length - sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Essay graded ────────────────────────────────────────────────────────────
  if (type === 'essay_graded') {
    const { submissionId, earnedPoints, totalPoints } = body

    const { data: submission } = await supabase
      .from('quiz_submissions').select('student_id, quiz_id').eq('id', submissionId).single()
    if (!submission) return new Response(JSON.stringify({ error: 'Submission not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    const [profileRes, quizRes] = await Promise.all([
      supabase.from('profiles').select('email, first_name').eq('id', submission.student_id).single(),
      supabase.from('quizzes').select('title, item_type, course_id').eq('id', submission.quiz_id).single(),
    ])

    const email = profileRes.data?.email
    if (!email) return new Response(JSON.stringify({ sent: 0, reason: 'No email for student' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    const firstName = escapeHtml(profileRes.data?.first_name ?? 'Student')
    const quizTitle = escapeHtml(quizRes.data?.title ?? 'Assessment')
    const itemType = escapeHtml(quizRes.data?.item_type ?? 'Assessment')
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    const scoreColor = score >= 75 ? '#1D9E75' : score >= 50 ? '#f59e0b' : '#ef4444'

    const bodyHtml = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a1a;">Your ${itemType} has been graded</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#666;">${quizTitle}</p>
      <table cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:8px;padding:20px;width:100%;">
        <tr>
          <td style="font-size:13px;color:#666;">Score</td>
          <td align="right" style="font-size:22px;font-weight:700;color:${scoreColor};">${earnedPoints} / ${totalPoints}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#666;padding-top:4px;">Percentage</td>
          <td align="right" style="font-size:16px;font-weight:600;color:${scoreColor};padding-top:4px;">${score}%</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">Hi ${firstName}, log in to ClassHub to view your detailed results.</p>`

    const html = baseTemplate('Grade Notification', quizTitle, bodyHtml)
    const sent = await sendEmail(email, `[ClassHub] Your ${quizRes.data?.title} has been graded`, html)
    return new Response(JSON.stringify({ sent: sent ? 1 : 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ── Grade posted (manual gradebook entry) ───────────────────────────────────
  if (type === 'grade_posted') {
    const { columnId, studentId, score } = body

    const [profileRes, columnRes] = await Promise.all([
      supabase.from('profiles').select('email, first_name').eq('id', studentId).single(),
      supabase.from('grade_columns').select('title, max_score').eq('id', columnId).single(),
    ])

    const email = profileRes.data?.email
    if (!email) return new Response(JSON.stringify({ sent: 0, reason: 'No email for student' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

    const firstName = escapeHtml(profileRes.data?.first_name ?? 'Student')
    const colTitle = escapeHtml(columnRes.data?.title ?? 'Item')
    const maxScore = columnRes.data?.max_score ?? 100
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
    const scoreColor = pct >= 75 ? '#1D9E75' : pct >= 50 ? '#f59e0b' : '#ef4444'

    const bodyHtml = `
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a1a;">Grade posted</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#666;">${colTitle}</p>
      <table cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:8px;padding:20px;width:100%;">
        <tr>
          <td style="font-size:13px;color:#666;">Score</td>
          <td align="right" style="font-size:22px;font-weight:700;color:${scoreColor};">${score} / ${maxScore}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#666;padding-top:4px;">Percentage</td>
          <td align="right" style="font-size:16px;font-weight:600;color:${scoreColor};padding-top:4px;">${pct}%</td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">Hi ${firstName}, log in to ClassHub to view your grade book.</p>`

    const html = baseTemplate('Grade Notification', colTitle, bodyHtml)
    const sent = await sendEmail(email, `[ClassHub] Your grade for ${columnRes.data?.title} has been posted`, html)
    return new Response(JSON.stringify({ sent: sent ? 1 : 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Unknown notification type' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
