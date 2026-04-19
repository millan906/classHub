/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useCourseFaculty } from '../../hooks/useCourseFaculty'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui/Spinner'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import type { Profile } from '../../types'

interface CoursesTabProps {
  institutionId: string | undefined
}

interface EnrolledStudent {
  student_id: string
  full_name: string
  email: string
  section?: string | null
  avatar_seed?: string | null
}

export default function CoursesTab({ institutionId }: CoursesTabProps) {
  const { profile } = useAuth()
  const { courses, loading, createCourse, deleteCourse } = useCourses(institutionId)
  const [newName, setNewName] = useState('')
  const [newSection, setNewSection] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  const [expandedPanel, setExpandedPanel] = useState<Record<string, 'faculty' | 'students'>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleCreate() {
    if (!newName.trim() || !profile || !institutionId) return
    setCreating(true)
    setCreateError('')
    try {
      const id = crypto.randomUUID()
      await createCourse(id, newName.trim(), newSection.trim(), profile.id, [], [], [], [], [], institutionId)
      setNewName('')
      setNewSection('')
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create course.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(courseId: string) {
    setDeleting(courseId)
    try {
      await deleteCourse(courseId)
      if (expandedCourse === courseId) setExpandedCourse(null)
      setConfirmDelete(null)
    } catch (err: unknown) {
      console.error('Delete failed', err)
    } finally {
      setDeleting(null)
    }
  }

  function toggleExpand(courseId: string) {
    setExpandedCourse(prev => prev === courseId ? null : courseId)
    setExpandedPanel(prev => ({ ...prev, [courseId]: prev[courseId] ?? 'faculty' }))
  }

  function setPanel(courseId: string, panel: 'faculty' | 'students') {
    setExpandedPanel(prev => ({ ...prev, [courseId]: panel }))
  }

  return (
    <div>
      {/* Create course form */}
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '14px 16px', marginBottom: '20px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
          New Course
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Course name</div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Introduction to Programming"
              style={{
                padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
                border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
                fontFamily: 'Inter, sans-serif', outline: 'none', width: '240px',
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Section (optional)</div>
            <input
              value={newSection}
              onChange={e => setNewSection(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. A"
              style={{
                padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
                border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
                fontFamily: 'Inter, sans-serif', outline: 'none', width: '100px',
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: '7px 16px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
              border: 'none', background: '#1D9E75', color: '#fff',
              cursor: creating || !newName.trim() ? 'not-allowed' : 'pointer',
              opacity: creating || !newName.trim() ? 0.6 : 1,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {createError && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '6px', padding: '8px 12px' }}>
            {createError}
          </div>
        )}
      </div>

      {/* Course list */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        All Courses
      </div>

      {loading ? (
        <Spinner />
      ) : courses.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#aaa', padding: '20px 0' }}>No courses yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {courses.map(course => {
            const isExpanded = expandedCourse === course.id
            const panel = expandedPanel[course.id] ?? 'faculty'
            return (
              <div key={course.id} style={{
                background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)',
                borderRadius: '10px', overflow: 'hidden',
              }}>
                {/* Course header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
                  <div
                    onClick={() => toggleExpand(course.id)}
                    style={{ flex: 1, cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>
                      {course.name}{course.section ? ` · Section ${course.section}` : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                      {isExpanded ? 'Click to collapse' : 'Click to manage'}
                    </div>
                  </div>
                  <span
                    onClick={() => toggleExpand(course.id)}
                    style={{ fontSize: '11px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}
                  >
                    {isExpanded ? '▲' : '▼'}
                  </span>
                  {confirmDelete === course.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#A32D2D' }}>Delete this course?</span>
                      <button
                        onClick={() => handleDelete(course.id)}
                        disabled={deleting === course.id}
                        style={{
                          fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                          border: 'none', background: '#A32D2D', color: '#fff',
                          cursor: deleting === course.id ? 'not-allowed' : 'pointer',
                          fontFamily: 'Inter, sans-serif', fontWeight: 500,
                          opacity: deleting === course.id ? 0.6 : 1,
                        }}
                      >
                        {deleting === course.id ? '...' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                          border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent',
                          color: '#555', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(course.id)}
                      style={{
                        fontSize: '12px', padding: '4px 8px', borderRadius: '6px',
                        border: '0.5px solid rgba(163,45,45,0.3)', background: 'transparent',
                        color: '#A32D2D', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Expanded panels */}
                {isExpanded && (
                  <div style={{ borderTop: '0.5px solid #F1EFE8' }}>
                    {/* Panel tab switcher */}
                    <div style={{ display: 'flex', gap: '0', borderBottom: '0.5px solid #F1EFE8' }}>
                      {(['faculty', 'students'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setPanel(course.id, p)}
                          style={{
                            padding: '8px 16px', fontSize: '12px', fontWeight: 500,
                            border: 'none', background: panel === p ? '#F0FBF6' : 'transparent',
                            color: panel === p ? '#1D9E75' : '#888',
                            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            borderBottom: panel === p ? '2px solid #1D9E75' : '2px solid transparent',
                          }}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>

                    {panel === 'faculty' ? (
                      <CourseFacultyPanel
                        courseId={course.id}
                        institutionId={institutionId}
                      />
                    ) : (
                      <CourseStudentsPanel
                        courseId={course.id}
                        currentUserId={profile?.id}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Faculty Panel ────────────────────────────────────────────────────────────

function CourseFacultyPanel({ courseId, institutionId }: {
  courseId: string
  institutionId: string | undefined
}) {
  const { assignedIds, institutionFaculty, loading, assign, unassign } = useCourseFaculty(courseId, institutionId)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(facultyId: string, isAssigned: boolean) {
    setSaving(facultyId)
    try {
      if (isAssigned) await unassign(facultyId)
      else await assign(facultyId)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div style={{ padding: '12px 14px' }}><Spinner /></div>

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {institutionFaculty.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#aaa' }}>No faculty in this institution yet.</div>
      ) : institutionFaculty.map((f: Profile) => {
        const isAssigned = assignedIds.includes(f.id)
        const colors = getAvatarColors(f.full_name)
        return (
          <div key={f.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '7px 10px', borderRadius: '8px',
            background: isAssigned ? '#F0FBF6' : '#fafafa',
            border: `0.5px solid ${isAssigned ? '#B6E8D4' : 'rgba(0,0,0,0.07)'}`,
          }}>
            <Avatar initials={getInitials(f.full_name)} bg={colors.bg} color={colors.color} seed={f.avatar_seed} size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{f.full_name}</div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>{f.email}</div>
            </div>
            <button
              onClick={() => toggle(f.id, isAssigned)}
              disabled={saving === f.id}
              style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: isAssigned ? '#FCEBEB' : '#1D9E75',
                color: isAssigned ? '#A32D2D' : '#fff',
                cursor: saving === f.id ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', fontWeight: 500,
                opacity: saving === f.id ? 0.6 : 1,
              }}
            >
              {saving === f.id ? '…' : isAssigned ? 'Remove' : 'Assign'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Students Panel ───────────────────────────────────────────────────────────

function CourseStudentsPanel({ courseId, currentUserId }: {
  courseId: string
  currentUserId: string | undefined
}) {
  const [students, setStudents] = useState<EnrolledStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [unenrolling, setUnenrolling] = useState<string | null>(null)

  async function fetchStudents() {
    setLoading(true)
    const { data: enrollments } = await supabase
      .from('course_enrollments')
      .select('student_id')
      .eq('course_id', courseId)

    if (!enrollments || enrollments.length === 0) {
      setStudents([])
      setLoading(false)
      return
    }

    const ids = enrollments.map((e: any) => e.student_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, section, avatar_seed')
      .in('id', ids)
      .order('full_name')

    setStudents((profiles || []).map((p: any) => ({
      student_id: p.id,
      full_name: p.full_name,
      email: p.email,
      section: p.section,
      avatar_seed: p.avatar_seed,
    })))
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  async function handleUnenroll(studentId: string) {
    setUnenrolling(studentId)
    try {
      await supabase
        .from('course_enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', studentId)
      setStudents(prev => prev.filter(s => s.student_id !== studentId))
    } finally {
      setUnenrolling(null)
    }
  }

  if (loading) return <div style={{ padding: '12px 14px' }}><Spinner /></div>

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {students.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#aaa' }}>No students enrolled yet.</div>
      ) : students.map(s => {
        const colors = getAvatarColors(s.full_name)
        const isMe = s.student_id === currentUserId
        return (
          <div key={s.student_id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '7px 10px', borderRadius: '8px',
            background: '#fafafa', border: '0.5px solid rgba(0,0,0,0.07)',
          }}>
            <Avatar initials={getInitials(s.full_name)} bg={colors.bg} color={colors.color} seed={s.avatar_seed} size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{s.full_name}{isMe ? ' (you)' : ''}</div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>{s.email}</div>
            </div>
            {s.section && (
              <span style={{
                fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                borderRadius: '999px', background: '#E6F1FB', color: '#0C447C',
              }}>
                {s.section}
              </span>
            )}
            <button
              onClick={() => handleUnenroll(s.student_id)}
              disabled={unenrolling === s.student_id}
              style={{
                fontSize: '12px', padding: '4px 8px', borderRadius: '6px',
                border: '0.5px solid rgba(163,45,45,0.3)', background: 'transparent',
                color: '#A32D2D', cursor: unenrolling === s.student_id ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                opacity: unenrolling === s.student_id ? 0.6 : 1,
              }}
            >
              {unenrolling === s.student_id ? '…' : 'Unenroll'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
