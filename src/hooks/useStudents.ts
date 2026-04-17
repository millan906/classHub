import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useStudents(institutionId?: string | null) {
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchStudents() {
    if (institutionId) {
      // Get all student members of this institution
      const { data: members } = await supabase
        .from('institution_members')
        .select('user_id')
        .eq('institution_id', institutionId)
        .eq('role', 'student')
      const memberIds = (members || []).map((m: any) => m.user_id)

      // Also get profiles with institution_id set (pending students who joined)
      const { data: byInst } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .eq('institution_id', institutionId)
      const byInstIds = (byInst || []).map((p: Profile) => p.id)

      const allIds = [...new Set([...memberIds, ...byInstIds])]
      if (allIds.length === 0) { setStudents([]); setLoading(false); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .in('id', allIds)
        .order('created_at', { ascending: false })
      setStudents(data || [])
    } else {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false })
      setStudents(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
    const channel = supabase
      .channel(`students-changes-${institutionId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStudents)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [institutionId])

  async function approveWithCourses(studentId: string, courseIds: string[], facultyId: string) {
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', studentId)
    if (courseIds.length > 0) {
      await supabase.from('course_enrollments').upsert(
        courseIds.map(cid => ({ course_id: cid, student_id: studentId, invited_by: facultyId })),
        { onConflict: 'student_id,course_id', ignoreDuplicates: true }
      )
    }
    // Also ensure they're in institution_members as student
    if (institutionId) {
      await supabase.from('institution_members').upsert(
        { institution_id: institutionId, user_id: studentId, role: 'student' },
        { onConflict: 'institution_id,user_id' }
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
