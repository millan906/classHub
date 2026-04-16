import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_ADDRESS = Deno.env.get('FROM_ADDRESS') ?? 'ClassHub <noreply@classhub.work>'
const CRON_SECRET = Deno.env.get('CRON_SECRET')

function escapeHtml(str: string) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  })
  if (!res.ok) console.error('[Resend]', to, res.status, await res.text())
  return res.ok
}

function emailTemplate(bodyHtml: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr><td style="background:#1D9E75;padding:28px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;">ClassHub</p>
        </td></tr>
        <tr><td style="padding:32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f0f0f0;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#aaa;">Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

async function getEnrolledEmails(supabase: ReturnType<typeof createClient>, courseId: string | null): Promise<string[]> {
  if (!courseId) return []
  const { data: enrollments } = await supabase
    .from('course_enrollments').select('student_id').eq('course_id', courseId)
  const ids = (enrollments ?? []).map((e: any) => e.student_id).filter(Boolean)
  if (ids.length === 0) return []
  const { data: profiles } = await supabase
    .from('profiles').select('email').in('id', ids).eq('status', 'approved')
  return (profiles ?? []).map((p: any) => p.email).filter(Boolean)
}

async function getEnrolledIds(supabase: ReturnType<typeof createClient>, courseId: string | null): Promise<string[]> {
  if (!courseId) return []
  const { data: enrollments } = await supabase
    .from('course_enrollments').select('student_id').eq('course_id', courseId)
  return (enrollments ?? []).map((e: any) => e.student_id).filter(Boolean)
}

async function getCourse(supabase: ReturnType<typeof createClient>, courseId: string | null) {
  if (!courseId) return null
  const { data } = await supabase.from('courses').select('name, section').eq('id', courseId).single()
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Verify cron secret
  const secret = req.headers.get('x-cron-secret')
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const now = new Date().toISOString()
  const in30 = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const in35 = new Date(Date.now() + 35 * 60 * 1000).toISOString()

  const stats = { opened: 0, closed: 0, reminded: 0, emailsSent: 0 }

  for (const table of ['quizzes', 'pdf_quizzes'] as const) {

    // ── 1. Auto-open ──────────────────────────────────────────────────────────
    const { data: toOpen } = await supabase
      .from(table).select('id, title, course_id, item_type, close_at')
      .lte('open_at', now)
      .eq('is_open', false)
      .eq('open_notif_sent', false)
      .not('open_at', 'is', null)

    for (const quiz of toOpen ?? []) {
      await supabase.from(table).update({ is_open: true, open_notif_sent: true }).eq('id', quiz.id)
      stats.opened++

      const [emails, studentIds, course] = await Promise.all([
        getEnrolledEmails(supabase, quiz.course_id),
        getEnrolledIds(supabase, quiz.course_id),
        getCourse(supabase, quiz.course_id),
      ])

      const courseName = course ? course.name + (course.section ? ` · ${course.section}` : '') : 'Your Course'
      const itemType = escapeHtml((quiz as any).item_type ?? 'Assessment')
      const title = escapeHtml(quiz.title)
      const closeStr = quiz.close_at ? `<p style="margin:8px 0 0;font-size:14px;color:#666;">Closes: <strong>${escapeHtml(new Date(quiz.close_at).toLocaleString())}</strong></p>` : ''

      const html = emailTemplate(`
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a1a;">${title} is now open</h1>
        <p style="margin:0 0 4px;font-size:14px;color:#666;">${itemType} &nbsp;·&nbsp; ${escapeHtml(courseName)}</p>
        ${closeStr}
        <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">Log in to ClassHub to begin.</p>
      `)

      // In-app notifications
      if (studentIds.length > 0) {
        await supabase.from('notifications').insert(
          studentIds.map(uid => ({
            user_id: uid,
            title: `${quiz.title} is now open`,
            body: `A ${(quiz as any).item_type ?? 'assessment'} is now available.`,
            type: 'quiz_open',
            related_id: quiz.id,
          }))
        )
      }

      // Emails
      const results = await Promise.all(emails.map(e => sendEmail(e, `[ClassHub] ${quiz.title} is now open`, html)))
      stats.emailsSent += results.filter(Boolean).length
    }

    // ── 2. 30-min reminder ────────────────────────────────────────────────────
    const { data: toRemind } = await supabase
      .from(table).select('id, title, course_id, item_type, close_at')
      .gte('close_at', in30)
      .lte('close_at', in35)
      .eq('is_open', true)
      .eq('reminder_notif_sent', false)
      .not('close_at', 'is', null)

    for (const quiz of toRemind ?? []) {
      await supabase.from(table).update({ reminder_notif_sent: true }).eq('id', quiz.id)
      stats.reminded++

      const [emails, studentIds, course] = await Promise.all([
        getEnrolledEmails(supabase, quiz.course_id),
        getEnrolledIds(supabase, quiz.course_id),
        getCourse(supabase, quiz.course_id),
      ])

      const courseName = course ? course.name + (course.section ? ` · ${course.section}` : '') : 'Your Course'
      const title = escapeHtml(quiz.title)
      const itemType = escapeHtml((quiz as any).item_type ?? 'Assessment')

      const html = emailTemplate(`
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#E65100;">⏰ 30 minutes left!</h1>
        <p style="margin:0 0 4px;font-size:16px;font-weight:500;color:#1a1a1a;">${title}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#666;">${itemType} &nbsp;·&nbsp; ${escapeHtml(courseName)}</p>
        <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">This assessment closes in 30 minutes. Log in to ClassHub now to submit.</p>
      `)

      // In-app notifications
      if (studentIds.length > 0) {
        await supabase.from('notifications').insert(
          studentIds.map(uid => ({
            user_id: uid,
            title: `⏰ 30 min left — ${quiz.title}`,
            body: 'This assessment closes in 30 minutes. Submit now.',
            type: 'quiz_reminder',
            related_id: quiz.id,
          }))
        )
      }

      const results = await Promise.all(emails.map(e => sendEmail(e, `[ClassHub] 30 minutes left: ${quiz.title}`, html)))
      stats.emailsSent += results.filter(Boolean).length
    }

    // ── 3. Auto-close ─────────────────────────────────────────────────────────
    const { data: toClose } = await supabase
      .from(table).select('id')
      .lte('close_at', now)
      .eq('is_open', true)
      .not('close_at', 'is', null)

    for (const quiz of toClose ?? []) {
      await supabase.from(table).update({ is_open: false }).eq('id', quiz.id)
      stats.closed++
    }
  }

  console.log('[quiz-scheduler]', stats)
  return new Response(JSON.stringify(stats), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
