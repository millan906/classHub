import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LOGIN_LIMIT = 5
const BASE_COOLDOWN_MS = 30_000 // 30s, doubles per tier — matches client-side logic

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { email, password } = await req.json().catch(() => ({}))
  if (!email || !password) return json({ error: 'Missing credentials' }, 400)

  const normalizedEmail = String(email).trim().toLowerCase()

  // Service role client — only used for rate limit table, never exposed to client
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Check current rate limit state ───────────────────────────────────────
  const { data: limitRow } = await serviceClient
    .from('login_rate_limits')
    .select('attempts, locked_until, tier')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (limitRow?.locked_until && new Date(limitRow.locked_until) > new Date()) {
    const remainingMs = new Date(limitRow.locked_until).getTime() - Date.now()
    return json({ error: 'Too many failed attempts', blocked: true, remainingMs }, 429)
  }

  // ── Attempt login via anon client (returns a real user session) ───────────
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )

  const { data, error: authError } = await anonClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: String(password),
  })

  if (authError) {
    // ── Record failure ──────────────────────────────────────────────────────
    const attempts = (limitRow?.attempts ?? 0) + 1
    let lockedUntil: string | null = null
    let tier = limitRow?.tier ?? 0

    if (attempts >= LOGIN_LIMIT) {
      tier++
      lockedUntil = new Date(Date.now() + BASE_COOLDOWN_MS * Math.pow(2, tier - 1)).toISOString()
    }

    await serviceClient.from('login_rate_limits').upsert({
      email: normalizedEmail,
      attempts: lockedUntil ? 0 : attempts, // reset counter after lockout
      locked_until: lockedUntil,
      tier,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    const remainingMs = lockedUntil ? new Date(lockedUntil).getTime() - Date.now() : 0
    return json({
      error: authError.message,
      blocked: !!lockedUntil,
      remainingMs,
    }, 401)
  }

  // ── Success — clear rate limit record ────────────────────────────────────
  await serviceClient.from('login_rate_limits').delete().eq('email', normalizedEmail)

  return json({
    access_token: data.session!.access_token,
    refresh_token: data.session!.refresh_token,
  })
})
