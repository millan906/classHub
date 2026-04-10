import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface Enrollment {
  id: string
  course_id: string
  student_id: string
  invited_by: string
  created_at: string
}

// For faculty: manage enrollments across all their courses
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
      .channel('course-enrollments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_enrollments' }, () => { if (courseId) fetch(courseId) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [courseId])

  async function enrollStudent(cId: string, studentId: string, facultyId: string) {
    const { error } = await supabase.from('course_enrollments').insert({
      course_id: cId,
      student_id: studentId,
      invited_by: facultyId,
    })
    if (error) throw error
    if (courseId) await fetch(courseId)
  }

  async function unenrollStudent(cId: string, studentId: string) {
    const { error } = await supabase
      .from('course_enrollments')
      .delete()
      .eq('course_id', cId)
      .eq('student_id', studentId)
    if (error) throw error
    if (courseId) await fetch(courseId)
  }

  return { enrollments, loading, enrollStudent, unenrollStudent, refetch: fetch }
}

// For faculty: get all enrollments across all courses
export function useAllEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])

  async function fetchAll() {
    const { data } = await supabase.from('course_enrollments').select('*')
    setEnrollments(data || [])
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('all-enrollments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_enrollments' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return { enrollments, refetch: fetchAll }
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
    const channel = supabase
      .channel('my-enrollments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_enrollments' }, () => { if (studentId) fetchMine(studentId) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [studentId])

  return { enrolledCourseIds, loading }
}
