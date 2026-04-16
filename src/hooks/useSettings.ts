import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface FacultySettings {
  notify_before_due: boolean
}

const DEFAULT: FacultySettings = {
  notify_before_due: true,
}

export function useSettings(facultyId: string | null) {
  const [settings, setSettings] = useState<FacultySettings>(DEFAULT)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!facultyId) { setLoading(false); return }
    load()
  }, [facultyId])

  async function load() {
    const { data } = await supabase
      .from('faculty_settings')
      .select('*')
      .eq('faculty_id', facultyId!)
      .maybeSingle()
    if (data) {
      setSettings({ notify_before_due: data.notify_before_due ?? true })
    }
    setLoading(false)
  }

  async function updateSettings(updates: Partial<FacultySettings>) {
    if (!facultyId) return
    const next = { ...settings, ...updates }
    setSettings(next)
    await supabase.from('faculty_settings').upsert(
      { faculty_id: facultyId, ...next },
      { onConflict: 'faculty_id' },
    )
  }

  return { settings, loading, updateSettings }
}

// Used by students to check if any enrolled course has grades published
export function useGradesVisible(studentId: string | null) {
  const [gradesVisible, setGradesVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) { setLoading(false); return }
    supabase
      .from('course_enrollments')
      .select('course_id, courses!inner(grades_visible)')
      .eq('student_id', studentId)
      .eq('courses.grades_visible', true)
      .limit(1)
      .then(({ data }) => {
        setGradesVisible((data?.length ?? 0) > 0)
        setLoading(false)
      })
  }, [studentId])

  return { gradesVisible, loading }
}
