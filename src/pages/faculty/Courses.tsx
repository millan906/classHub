import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import type { Course } from '../../types'

const inputStyle: React.CSSProperties = {
  padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  color: '#1a1a1a',
}

function CourseForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { name: string; section: string }
  onSave: (name: string, section: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [section, setSection] = useState(initial?.section ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Course name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(name, section)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)',
      borderRadius: '12px', padding: '14px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '140px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Course name <span style={{ color: '#A32D2D' }}>*</span></div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. CS101, Data Structures"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Section (optional)</div>
          <input
            value={section}
            onChange={e => setSection(e.target.value)}
            placeholder="e.g. A, 01"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', paddingBottom: '1px' }}>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '6px' }}>{error}</div>}
    </div>
  )
}

function CourseStudentsPanel({
  course,
  facultyId,
}: {
  course: Course
  facultyId: string
}) {
  const { enrollments, enrollStudent, unenrollStudent, refetch } = useCourseEnrollments(course.id)
  const { students } = useStudents()
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  const approved = students.filter(s => s.status === 'approved')
  const enrolledIds = new Set(enrollments.map(e => e.student_id))
  const notEnrolled = approved.filter(s => !enrolledIds.has(s.id))
  const enrolledStudents = approved.filter(s => enrolledIds.has(s.id))

  async function handleInvite() {
    if (!selectedStudentId) return
    setInviting(true)
    setError('')
    try {
      await enrollStudent(course.id, selectedStudentId, facultyId)
      setSelectedStudentId('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(studentId: string) {
    await unenrollStudent(course.id, studentId)
    refetch(course.id)
  }

  return (
    <div style={{
      borderTop: '0.5px solid rgba(0,0,0,0.08)',
      marginTop: '10px', paddingTop: '10px',
    }}>
      <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>
        Enrolled students ({enrolledStudents.length})
      </div>

      {enrolledStudents.length === 0 && (
        <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>No students enrolled yet.</div>
      )}

      {enrolledStudents.map(s => {
        const colors = getAvatarColors(s.full_name)
        return (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 8px', background: '#F9F9F7',
            borderRadius: '8px', marginBottom: '5px',
          }}>
            <Avatar initials={getInitials(s.full_name)} bg={colors.bg} color={colors.color} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{s.full_name}</div>
              <div style={{ fontSize: '11px', color: '#888' }}>{s.email}</div>
            </div>
            <Button variant="danger" onClick={() => handleRemove(s.id)} style={{ fontSize: '11px', padding: '2px 8px' }}>
              Remove
            </Button>
          </div>
        )
      })}

      {notEnrolled.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            style={{ ...inputStyle, flex: 1, fontSize: '12px' }}
          >
            <option value="">Invite a student...</option>
            {notEnrolled.map(s => (
              <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
            ))}
          </select>
          <Button variant="primary" onClick={handleInvite} disabled={inviting || !selectedStudentId} style={{ fontSize: '12px' }}>
            {inviting ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
      )}
      {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '4px' }}>{error}</div>}
    </div>
  )
}

function CourseRow({
  course,
  facultyId,
  onEdit,
  onDelete,
  onToggle,
}: {
  course: Course
  facultyId: string
  onEdit: (course: Course) => void
  onDelete: (course: Course) => void
  onToggle: (id: string, status: 'open' | 'closed') => void
}) {
  const isOpen = course.status === 'open'
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', padding: '12px 14px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{course.name}</span>
            {course.section && (
              <span style={{ fontSize: '12px', color: '#888' }}>· Section {course.section}</span>
            )}
          </div>
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: isOpen ? '#E1F5EE' : '#F1EFE8',
            color: isOpen ? '#0F6E56' : '#888',
          }}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button
            onClick={() => setExpanded(v => !v)}
            style={{ fontSize: '12px' }}
          >
            {expanded ? 'Hide students' : 'Students'}
          </Button>
          <Button onClick={() => onEdit(course)}>Edit</Button>
          <Button
            onClick={() => onToggle(course.id, isOpen ? 'closed' : 'open')}
            style={isOpen
              ? { background: '#FEF3CD', color: '#D4900A', borderColor: '#D4900A' }
              : { background: '#E1F5EE', color: '#0F6E56', borderColor: '#0F6E56' }
            }
          >
            {isOpen ? 'Close' : 'Open'}
          </Button>
          <Button variant="danger" onClick={() => onDelete(course)}>Delete</Button>
        </div>
      </div>

      {expanded && (
        <CourseStudentsPanel course={course} facultyId={facultyId} />
      )}
    </div>
  )
}

export default function FacultyCourses() {
  const { profile } = useAuth()
  const { courses, createCourse, updateCourse, deleteCourse, toggleCourseStatus } = useCourses()
  const [showForm, setShowForm] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null)

  if (!profile) return null

  async function handleCreate(name: string, section: string) {
    if (!profile) return
    await createCourse(name, section, profile.id)
    setShowForm(false)
  }

  async function handleUpdate(name: string, section: string) {
    if (!editingCourse) return
    await updateCourse(editingCourse.id, name, section)
    setEditingCourse(null)
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete course"
          message={`Delete "${confirmDelete.name}${confirmDelete.section ? ` · Section ${confirmDelete.section}` : ''}"? All enrolled students will be removed. This cannot be undone.`}
          onConfirm={async () => { await deleteCourse(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <PageHeader title="Courses" subtitle="Manage your courses and enrolled students." />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {!showForm && !editingCourse && (
          <Button variant="primary" onClick={() => setShowForm(true)}>+ New course</Button>
        )}
      </div>

      {showForm && (
        <CourseForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {courses.length === 0 && !showForm ? (
        <div style={{ fontSize: '13px', color: '#888' }}>No courses yet. Create your first course.</div>
      ) : (
        courses.map(course =>
          editingCourse?.id === course.id ? (
            <CourseForm
              key={course.id}
              initial={{ name: course.name, section: course.section ?? '' }}
              onSave={handleUpdate}
              onCancel={() => setEditingCourse(null)}
            />
          ) : (
            <CourseRow
              key={course.id}
              course={course}
              facultyId={profile.id}
              onEdit={setEditingCourse}
              onDelete={setConfirmDelete}
              onToggle={toggleCourseStatus}
            />
          )
        )
      )}
    </div>
  )
}
