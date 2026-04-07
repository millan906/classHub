// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const FACULTY_INVITE_CODE = Deno.env.get('FACULTY_INVITE_CODE') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { code } = await req.json()
  const isFaculty = FACULTY_INVITE_CODE.length > 0 && code === FACULTY_INVITE_CODE
  const role = isFaculty ? 'faculty' : 'student'
  const status = isFaculty ? 'approved' : 'pending'

  return new Response(JSON.stringify({ role, status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
