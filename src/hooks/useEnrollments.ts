import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface Enrollment {
  id: string
  course_id: string
  student_id: string
  invited_by: string
  created_at: string
}

// For faculty: manage enrollments for a specific course
export function useCourseEnrollments(courseId: string | null) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)

  async function fetch(id: string) {
    setLoading(true)
    const { data } = await supabase
      .from('course_enrollments')
      .select('*')
      .eq('course_id', id)
    setEnrollments(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (courseId) fetch(courseId)
    const channel = supabase
      .channel(`course-enrollments-${courseId ?? 'none'}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'course_enrollments',
        filter: courseId ? `course_id=eq.${courseId}` : undefined,
      }, () => { if (courseId) fetch(courseId) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [courseId])

  async function enrollStudent(cId: string, studentId: string, facultyId: string) {
    const { data, error } = await supabase.from('course_enrollments').insert({
      course_id: cId,
      student_id: studentId,
      invited_by: facultyId,
    }).select('*').single()
    if (error) throw error
    if (data) setEnrollments(prev => [...prev, data as Enrollment])
  }

  async function unenrollStudent(cId: string, studentId: string) {
    const { error } = await supabase
      .from('course_enrollments')
      .delete()
      .eq('course_id', cId)
      .eq('student_id', studentId)
    if (error) throw error
    setEnrollments(prev => prev.filter(e => !(e.course_id === cId && e.student_id === studentId)))
  }

  return { enrollments, loading, enrollStudent, unenrollStudent, refetch: fetch }
}

// For faculty: get all enrollments across all courses
export function useAllEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])

  async function fetchAll() {
    const { data } = await supabase.from('course_enrollments').select('course_id, student_id, invited_by, id, created_at')
    setEnrollments(data || [])
  }

  async function unenrollStudent(courseId: string, studentId: string) {
    await supabase.from('course_enrollments').delete()
      .eq('course_id', courseId).eq('student_id', studentId)
    setEnrollments(prev => prev.filter(e => !(e.course_id === courseId && e.student_id === studentId)))
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('all-enrollments-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'course_enrollments' }, (payload) => {
        setEnrollments(prev => [...prev, payload.new as Enrollment])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'course_enrollments' }, (payload) => {
        const old = payload.old as { course_id: string; student_id: string }
        setEnrollments(prev => prev.filter(e => !(e.course_id === old.course_id && e.student_id === old.student_id)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return { enrollments, refetch: fetchAll, unenrollStudent }
}

// For students: get enrolled course IDs
export function useMyEnrollments(studentId: string | null) {
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchMine(id: string) {
    const { data } = await supabase
      .from('course_enrollments')
      .select('course_id')
      .eq('student_id', id)
    setEnrolledCourseIds((data || []).map((e: { course_id: string }) => e.course_id))
    setLoading(false)
  }

  useEffect(() => {
    if (studentId) fetchMine(studentId)
    else setLoading(false)
    if (!studentId) return
    const channel = supabase
      .channel(`my-enrollments-${studentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'course_enrollments',
        filter: `student_id=eq.${studentId}`,
      }, () => fetchMine(studentId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [studentId])

  return { enrolledCourseIds, loading }
}
