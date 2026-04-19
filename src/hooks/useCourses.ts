import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Course, GradingPeriod, CourseScheduleItem, CourseResource, SyllabusRow } from '../types'

const BUCKET = 'course-resources'

export function useCourses(institutionId?: string | null, facultyId?: string | null) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchCourses() {
    if (facultyId) {
      // Faculty: only courses they're assigned to via course_faculty
      const { data: assignments } = await supabase
        .from('course_faculty')
        .select('course_id')
        .eq('faculty_id', facultyId)
      const courseIds = (assignments || []).map((a: { course_id: string }) => a.course_id)
      if (courseIds.length === 0) { setCourses([]); setLoading(false); return }
      const { data } = await supabase
        .from('courses')
        .select('*')
        .in('id', courseIds)
        .order('created_at', { ascending: false })
      setCourses(data || [])
    } else {
      // Students / public: all institution courses
      let query = supabase.from('courses').select('*').order('created_at', { ascending: false })
      if (institutionId) query = query.eq('institution_id', institutionId) as typeof query
      const { data } = await query
      setCourses(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchCourses()
    const channel = supabase
      .channel(`courses-changes-${facultyId ?? institutionId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, fetchCourses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_faculty' }, fetchCourses)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [institutionId, facultyId])

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
    institution_id?: string | null,
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
      ...(institution_id ? { institution_id } : {}),
    })
    if (error) throw error
    // Auto-assign creator as the teaching faculty for this course
    await supabase.from('course_faculty').upsert(
      { course_id: id, faculty_id: userId },
      { onConflict: 'course_id,faculty_id', ignoreDuplicates: true }
    )
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

  async function copyCourseInfo(sourceId: string, targetId: string) {
    const source = courses.find(c => c.id === sourceId)
    if (!source) throw new Error('Source course not found')
    const { error } = await supabase.from('courses').update({
      topics: source.topics ?? [],
      grading_system: source.grading_system ?? [],
      schedule: source.schedule ?? [],
      resources: source.resources ?? [],
      syllabus: source.syllabus ?? [],
    }).eq('id', targetId)
    if (error) throw error
    await fetchCourses()
  }

  async function toggleGradesVisible(id: string, visible: boolean) {
    const { error } = await supabase.from('courses').update({ grades_visible: visible }).eq('id', id)
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
    createCourse, updateCourse, deleteCourse, toggleCourseStatus, toggleGradesVisible,
    uploadResource, deleteResource, getResourceUrl, copyCourseInfo,
  }
}
