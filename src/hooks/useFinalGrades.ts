import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { percentageToGWA } from '../utils/gwaConversion'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface FinalGrade {
  id: string
  student_id: string
  course_id: string
  midterm_grade: number | null
  grade: number | null  // Final exam grade
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
  const [error, setError] = useState<string | null>(null)

  async function fetchAll() {
    try {
      setError(null)
      const { data, error: err } = await supabase.from('final_grades').select('*')
      if (err) throw err
      if (data) setFinalGrades(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load final grades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('final-grades-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'final_grades' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function upsertGrade(studentId: string, courseId: string, midtermGrade: number | null, finalGrade: number | null) {
    const { error } = await supabase.from('final_grades').upsert(
      { student_id: studentId, course_id: courseId, midterm_grade: midtermGrade, grade: finalGrade, updated_at: new Date().toISOString() },
      { onConflict: 'student_id,course_id' }
    )
    if (error) throw error
    await fetchAll()
  }

  async function publishGrade(studentId: string, courseId: string) {
    const { error } = await supabase.from('final_grades')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('course_id', courseId)
    if (error) throw error
    await fetchAll()
    // Send email notification to student — use course grade (avg of midterm + final)
    const rec = finalGrades.find(g => g.student_id === studentId && g.course_id === courseId)
    const courseGrade = rec?.midterm_grade != null && rec?.grade != null
      ? (rec.midterm_grade + rec.grade) / 2
      : rec?.grade ?? rec?.midterm_grade ?? null
    if (courseGrade != null) {
      const grade = courseGrade
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
    if (error) throw error
    await fetchAll()
  }

  async function publishAllForCourse(courseId: string) {
    const { error } = await supabase.from('final_grades')
      .update({ published: true, updated_at: new Date().toISOString() })
      .eq('course_id', courseId)
      .or('midterm_grade.not.is.null,grade.not.is.null')
    if (error) throw error
    await fetchAll()
  }

  return { finalGrades, loading, error, upsertGrade, publishGrade, unpublishGrade, publishAllForCourse }
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
