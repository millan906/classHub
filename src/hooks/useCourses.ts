import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Course } from '../types'

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchCourses() {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false })
    setCourses(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCourses() }, [])

  async function createCourse(name: string, section: string, userId: string) {
    const { error } = await supabase.from('courses').insert({
      name: name.trim(),
      section: section.trim() || null,
      created_by: userId,
    })
    if (error) throw error
    await fetchCourses()
  }

  async function updateCourse(id: string, name: string, section: string) {
    const { error } = await supabase.from('courses').update({
      name: name.trim(),
      section: section.trim() || null,
    }).eq('id', id)
    if (error) throw error
    await fetchCourses()
  }

  async function deleteCourse(id: string) {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error
    await fetchCourses()
  }

  async function toggleCourseStatus(id: string, status: 'open' | 'closed') {
    const { error } = await supabase.from('courses').update({ status }).eq('id', id)
    if (error) throw error
    await fetchCourses()
  }

  return { courses, loading, createCourse, updateCourse, deleteCourse, toggleCourseStatus }
}
