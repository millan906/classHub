import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Course, GradingPeriod, CourseScheduleItem, CourseResource, SyllabusRow } from '../types'

const BUCKET = 'course-resources'

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

  useEffect(() => {
    fetchCourses()
    const channel = supabase
      .channel('courses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, fetchCourses)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function createCourse(
    id: string,
    name: string,
    section: string,
    userId: string,
    topics: string[] = [],
    gradingSystem: GradingPeriod[] = [],
    schedule: CourseScheduleItem[] = [],
    resources: CourseResource[] = [],
    syllabus: SyllabusRow[] = [],
  ) {
    const { error } = await supabase.from('courses').insert({
      id,
      name: name.trim(),
      section: section.trim() || null,
      created_by: userId,
      topics,
      grading_system: gradingSystem,
      schedule,
      resources,
      syllabus,
    })
    if (error) throw error
    await fetchCourses()
  }

  async function updateCourse(
    id: string,
    name: string,
    section: string,
    topics: string[] = [],
    gradingSystem: GradingPeriod[] = [],
    schedule: CourseScheduleItem[] = [],
    resources: CourseResource[] = [],
    syllabus: SyllabusRow[] = [],
  ) {
    const { error } = await supabase.from('courses').update({
      name: name.trim(),
      section: section.trim() || null,
      topics,
      grading_system: gradingSystem,
      schedule,
      resources,
      syllabus,
    }).eq('id', id)
    if (error) throw error
    await fetchCourses()
  }

  async function deleteCourse(id: string) {
    // Remove all storage files for this course
    const { data: files } = await supabase.storage.from(BUCKET).list(id)
    if (files && files.length > 0) {
      await supabase.storage.from(BUCKET).remove(files.map(f => `${id}/${f.name}`))
    }
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error
    await fetchCourses()
  }

  async function toggleCourseStatus(id: string, status: 'open' | 'closed') {
    const { error } = await supabase.from('courses').update({ status }).eq('id', id)
    if (error) throw error
    await fetchCourses()
  }

  async function uploadResource(courseId: string, file: File): Promise<{ file_path: string; file_name: string }> {
    if (file.size > 50 * 1024 * 1024) throw new Error('File too large. Maximum size is 50 MB.')
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${courseId}/${Date.now()}_${safe}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file)
    if (error) throw error
    return { file_path: path, file_name: file.name }
  }

  async function deleteResource(filePath: string) {
    await supabase.storage.from(BUCKET).remove([filePath])
  }

  function getResourceUrl(filePath: string): string {
    return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl
  }

  return {
    courses, loading,
    createCourse, updateCourse, deleteCourse, toggleCourseStatus,
    uploadResource, deleteResource, getResourceUrl,
  }
}
