import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useCourseFaculty(courseId: string, institutionId: string | null | undefined) {
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [institutionFaculty, setInstitutionFaculty] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const [{ data: assigned }, { data: members }] = await Promise.all([
      supabase.from('course_faculty').select('faculty_id').eq('course_id', courseId),
      institutionId
        ? supabase
            .from('institution_members')
            .select('user_id')
            .eq('institution_id', institutionId)
            .in('role', ['faculty', 'admin'])
        : Promise.resolve({ data: [] }),
    ])

    const ids = (assigned || []).map((r: { faculty_id: string }) => r.faculty_id)
    setAssignedIds(ids)

    if (members && members.length > 0) {
      const userIds = members.map((m: { user_id: string }) => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)
        .eq('role', 'faculty')
        .order('full_name')
      setInstitutionFaculty(profiles || [])
    } else {
      setInstitutionFaculty([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, institutionId])

  async function assign(facultyId: string) {
    await supabase.from('course_faculty').upsert(
      { course_id: courseId, faculty_id: facultyId },
      { onConflict: 'course_id,faculty_id', ignoreDuplicates: true }
    )
    await fetchData()
  }

  async function unassign(facultyId: string) {
    await supabase.from('course_faculty')
      .delete()
      .eq('course_id', courseId)
      .eq('faculty_id', facultyId)
    await fetchData()
  }

  return { assignedIds, institutionFaculty, loading, assign, unassign }
}
