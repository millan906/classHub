import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useStudents() {
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false })
    setStudents(data || [])
    setLoading(false)
  }

  async function approveWithCourses(studentId: string, courseIds: string[], facultyId: string) {
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', studentId)
    if (courseIds.length > 0) {
      await supabase.from('course_enrollments').insert(
        courseIds.map(cid => ({ course_id: cid, student_id: studentId, invited_by: facultyId }))
      )
    }
    await fetchStudents()
  }

  async function rejectStudent(id: string) {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id)
    await fetchStudents()
  }

  return { students, loading, approveWithCourses, rejectStudent }
}
