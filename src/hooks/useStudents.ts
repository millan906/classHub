import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useStudents(institutionId?: string | null) {
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchStudents() {
    if (institutionId) {
      // Run both lookups in parallel to avoid sequential round trips
      const [{ data: members }, { data: byInst }] = await Promise.all([
        supabase
          .from('institution_members')
          .select('user_id')
          .eq('institution_id', institutionId)
          .eq('role', 'student'),
        supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .eq('institution_id', institutionId),
      ])

      const memberIds = (members || []).map((m: { user_id: string }) => m.user_id)
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
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false })
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
    if (institutionId) {
      await supabase.from('institution_members').upsert(
        { institution_id: institutionId, user_id: studentId, role: 'student' },
        { onConflict: 'institution_id,user_id' }
      )
    }
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status: 'approved' } : s))
  }

  async function rejectStudent(id: string) {
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected' } : s))
  }

  return { students, loading, approveWithCourses, rejectStudent }
}
