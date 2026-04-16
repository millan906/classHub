import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { percentageToGWA } from '../utils/gwaConversion'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface FinalGrade {
  id: string
  student_id: string
  course_id: string
  grade: number | null
  published: boolean
  created_at: string
  updated_at: string
}

export interface MyFinalGrade extends FinalGrade {
  course_name: string
}

// For faculty: full management of all final grades
export function useFinalGrades() {
  const [finalGrades, setFinalGrades] = useState<FinalGrade[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    const { data } = await supabase.from('final_grades').select('*')
    if (data) setFinalGrades(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('final-grades-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_grades' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function upsertGrade(studentId: string, courseId: string, grade: number) {
    const { error } = await supabase.from('final_grades').upsert(
      { student_id: studentId, course_id: courseId, grade, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,course_id' }
    )
    if (error) console.error('Upsert grade error:', error)
    await fetchAll()
  }

  async function publishGrade(studentId: string, courseId: string) {
    const { error } = await supabase.from('final_grades')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('course_id', courseId)
    if (error) { console.error('Publish grade error:', error); return }
    await fetchAll()
    // Send email notification to student
    const grade = finalGrades.find(g => g.student_id === studentId && g.course_id === courseId)?.grade
    if (grade != null) {
      const gwa = percentageToGWA(grade)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ type: 'final_grade_published', studentId, courseId, grade, gwa }),
        }).catch(err => console.error('[Email] Final grade notification failed:', err))
      }
    }
  }

  async function unpublishGrade(studentId: string, courseId: string) {
    const { error } = await supabase.from('final_grades')
      .update({ published: false, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('course_id', courseId)
    if (error) console.error('Unpublish grade error:', error)
    await fetchAll()
  }

  async function publishAllForCourse(courseId: string) {
    const { error } = await supabase.from('final_grades')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('course_id', courseId)
      .not('grade', 'is', null)
    if (error) console.error('Publish all error:', error)
    await fetchAll()
  }

  return { finalGrades, loading, upsertGrade, publishGrade, unpublishGrade, publishAllForCourse }
}

// For students: view their own published final grades with course names
export function useMyFinalGrades(userId: string | null) {
  const [grades, setGrades] = useState<MyFinalGrade[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchMine() {
    if (!userId) { setLoading(false); return }
    const { data } = await supabase
      .from('final_grades')
      .select('*, courses(name)')
      .eq('student_id', userId)
      .eq('published', true)
    if (data) {
      setGrades(data.map((g: FinalGrade & { courses: { name: string } | null }) => ({
        ...g,
        course_name: g.courses?.name ?? 'Unknown Course',
      })))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMine()
    const channel = supabase
      .channel('my-final-grades-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_grades' }, fetchMine)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  return { grades, loading }
}
