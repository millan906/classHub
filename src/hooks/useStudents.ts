import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

// 150 covers current ~80-student institution with 2x headroom.
// Client-side status filtering (pending/approved/rejected) requires all
// students to be in memory — raise this if headcount approaches the limit.
const PAGE_SIZE = 150

export function useStudents(institutionId?: string | null) {
  const [students, setStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const allIdsRef = useRef<string[]>([])

  async function resolveAllIds(): Promise<string[]> {
    if (!institutionId) return []
    const [{ data: members }, { data: byInst }] = await Promise.all([
      supabase
        .from('institution_members')
        .select('user_id')
        .eq('institution_id', institutionId)
        .eq('role', 'student'),
      supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')
        .eq('institution_id', institutionId),
    ])
    const memberIds = (members || []).map((m: { user_id: string }) => m.user_id)
    const byInstIds = (byInst || []).map((p: { id: string }) => p.id)
    return [...new Set([...memberIds, ...byInstIds])]
  }

  async function fetchStudents() {
    if (institutionId) {
      const allIds = await resolveAllIds()
      allIdsRef.current = allIds
      if (allIds.length === 0) { setStudents([]); setLoading(false); setHasMore(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .in('id', allIds)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)
      const rows = data || []
      setStudents(rows)
      setHasMore(rows.length === PAGE_SIZE)
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)
      const rows = data || []
      setStudents(rows)
      setHasMore(rows.length === PAGE_SIZE)
    }
    setLoading(false)
  }

  async function loadMore() {
    setLoadingMore(true)
    const from = students.length
    const to = from + PAGE_SIZE - 1
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false })
        .range(from, to)
      if (institutionId && allIdsRef.current.length > 0) {
        query = query.in('id', allIdsRef.current) as typeof query
      }
      const { data } = await query
      const rows = data || []
      setStudents(prev => [...prev, ...rows])
      setHasMore(rows.length === PAGE_SIZE)
    } finally {
      setLoadingMore(false)
    }
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

  return { students, loading, loadingMore, hasMore, loadMore, approveWithCourses, rejectStudent }
}
