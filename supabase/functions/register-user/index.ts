import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FACULTY_INVITE_CODE = Deno.env.get('FACULTY_INVITE_CODE') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { firstName, lastName, email, password, inviteCode, program, section, studentNo } = await req.json()

  if (!email || !password || !firstName || !lastName) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (password.length < 15 || password.length > 64) {
    return new Response(JSON.stringify({ error: 'Password must be between 15 and 64 characters.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return new Response(JSON.stringify({ error: 'Password must contain at least one letter and one number.' }), {
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

  const trimmedStudentNo = role === 'student' && studentNo ? studentNo.trim() || null : null

  // Insert profile using service role (bypasses RLS)
  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    full_name: `${firstName.trim()} ${lastName.trim()}`,
    email,
    role,
    status,
    ...(role === 'student' && trimmedStudentNo ? { student_no: trimmedStudentNo } : {}),
    ...(role === 'student' && program ? { program: program.trim() } : {}),
    ...(role === 'student' && section ? { section: section.trim() } : {}),
  })

  if (profileError) {
    // Roll back the auth user if profile insert fails
    await supabase.auth.admin.deleteUser(user.id)
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Auto-enrollment: if student has a student_no, check pending_roster for matches
  if (role === 'student' && trimmedStudentNo) {
    const { data: pendingEntries } = await supabase
      .from('pending_roster')
      .select('id, course_id')
      .eq('student_no', trimmedStudentNo)

    if (pendingEntries && pendingEntries.length > 0) {
      // Get institution_id from the first matched course to approve the student
      const courseIds = pendingEntries.map((e: { id: string; course_id: string }) => e.course_id)
      const { data: courses } = await supabase
        .from('courses')
        .select('id, institution_id')
        .in('id', courseIds)

      const firstCourse = courses && courses.length > 0 ? courses[0] : null
      const institutionId = firstCourse?.institution_id ?? null

      // Approve the student and set institution_id
      await supabase
        .from('profiles')
        .update({ status: 'approved', ...(institutionId ? { institution_id: institutionId } : {}) })
        .eq('id', user.id)

      // Upsert enrollments for each matched course
      for (const entry of pendingEntries as { id: string; course_id: string }[]) {
        await supabase
          .from('course_enrollments')
          .upsert(
            { course_id: entry.course_id, student_id: user.id, invited_by: user.id },
            { onConflict: 'course_id,student_id', ignoreDuplicates: true }
          )
      }

      // Delete matched pending_roster entries
      const entryIds = pendingEntries.map((e: { id: string; course_id: string }) => e.id)
      await supabase
        .from('pending_roster')
        .delete()
        .in('id', entryIds)
    }
  }

  return new Response(JSON.stringify({ success: true, role, status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
