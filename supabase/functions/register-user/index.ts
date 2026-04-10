import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACULTY_INVITE_CODE = Deno.env.get('FACULTY_INVITE_CODE') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { firstName, lastName, email, password, inviteCode } = await req.json()

  if (!email || !password || !firstName || !lastName) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const isFaculty = FACULTY_INVITE_CODE.length > 0 && inviteCode === FACULTY_INVITE_CODE
  const role = isFaculty ? 'faculty' : 'student'
  const status = isFaculty ? 'approved' : 'pending'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Create auth user — email_confirm: true bypasses email confirmation requirement
  const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !user) {
    return new Response(JSON.stringify({ error: createError?.message ?? 'Registration failed' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Insert profile using service role (bypasses RLS)
  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    full_name: `${firstName.trim()} ${lastName.trim()}`,
    email,
    role,
    status,
  })

  if (profileError) {
    // Roll back the auth user if profile insert fails
    await supabase.auth.admin.deleteUser(user.id)
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, role, status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
