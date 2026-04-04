import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useStudents } from '../../hooks/useStudents'
import { useCourses } from '../../hooks/useCourses'
import { useAllEnrollments } from '../../hooks/useEnrollments'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useGradeBook } from '../../hooks/useGradeBook'
import { PageHeader, Divider } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { StudentRow } from '../../components/students/StudentRow'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import { scoreBarColor } from '../../utils/scoreColors'
import { Badge } from '../../components/ui/Badge'
import type { Profile, Course } from '../../types'

export default function FacultyStudents() {
  const { profile } = useAuth()
  const { students, approveWithCourses, rejectStudent } = useStudents()
  const { courses } = useCourses()
  const { enrollments, refetch: refetchEnrollments } = useAllEnrollments()
  const { quizzes, submissions } = useQuizzes()
  const { groups, columns, entries } = useGradeBook()

  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [filterCourseId, setFilterCourseId] = useState<string>('all')
  const [viewingStudent, setViewingStudent] = useState<Profile | null>(null)

  const pending = students.filter(s => s.status === 'pending')
  const enrolled = students.filter(s => s.status === 'approved')
  const rejected = students.filter(s => s.status === 'rejected')
  const openCourses = courses.filter(c => c.status === 'open')

  function startApproving(studentId: string) {
    setApprovingId(studentId)
    setSelectedCourses([])
  }

  function cancelApproving() {
    setApprovingId(null)
    setSelectedCourses([])
  }

  function toggleCourse(courseId: string) {
    setSelectedCourses(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    )
  }

  async function handleApprove() {
    if (!approvingId || !profile) return
    setSaving(true)
    await approveWithCourses(approvingId, selectedCourses, profile.id)
    await refetchEnrollments()
    setSaving(false)
    cancelApproving()
  }

  async function handleReject(studentId: string) {
    if (approvingId === studentId) cancelApproving()
    await rejectStudent(studentId)
  }

  function getStudentCourses(studentId: string): Course[] {
    const ids = enrollments.filter(e => e.student_id === studentId).map(e => e.course_id)
    return courses.filter(c => ids.includes(c.id))
  }

  // ── Student detail view ──────────────────────────────────────────────────────
  if (viewingStudent) {
    const studentCourseIds = enrollments
      .filter(e => e.student_id === viewingStudent.id)
      .map(e => e.course_id)

    const relevantQuizzes = quizzes.filter(q =>
      !q.course_id || studentCourseIds.includes(q.course_id)
    )

    const studentSubs = submissions.filter(s => s.student_id === viewingStudent.id)
    const submittedQuizIds = new Set(studentSubs.map(s => s.quiz_id))

    const dueItems = relevantQuizzes.filter(q => q.is_open && !submittedQuizIds.has(q.id))
    const missedItems = relevantQuizzes.filter(q => !q.is_open && !submittedQuizIds.has(q.id))

    const studentEntries = entries.filter(e => e.student_id === viewingStudent.id)

    // Build scores: group entries by grade group
    const scoresByGroup = groups.map(g => {
      const groupCols = columns.filter(c => c.group_id === g.id)
      const rows = groupCols.map(col => {
        const entry = studentEntries.find(e => e.column_id === col.id)
        return { col, score: entry?.score ?? null }
      }).filter(r => r.score !== null)
      return { group: g, rows }
    }).filter(g => g.rows.length > 0)

    const colors = getAvatarColors(viewingStudent.full_name)
    const studentCourses = getStudentCourses(viewingStudent.id)

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
          <Button onClick={() => setViewingStudent(null)}>← Students</Button>
          <Avatar initials={getInitials(viewingStudent.full_name)} bg={colors.bg} color={colors.color} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500 }}>{viewingStudent.full_name}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>{viewingStudent.email}</div>
          </div>
        </div>

        {/* Enrolled courses */}
        {studentCourses.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {studentCourses.map(c => (
              <span key={c.id} style={{ fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '999px', background: '#E6F1FB', color: '#185FA5' }}>
                {c.name}{c.section ? ` · ${c.section}` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Scores */}
        <SectionHeader label="Scores" />
        {scoresByGroup.length === 0
          ? <EmptyNote text="No scores recorded yet." />
          : scoresByGroup.map(({ group, rows }) => (
              <div key={group.id} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  {group.name} · {group.weight_percent}%
                </div>
                {rows.map(({ col, score }) => {
                  const pct = score !== null ? Math.round((score! / col.max_score) * 100) : null
                  const barColor = scoreBarColor(pct)
                  return (
                    <div key={col.id} style={{
                      background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)',
                      borderRadius: '10px', padding: '9px 12px', marginBottom: '6px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{col.title}</div>
                        <div style={{ height: '3px', background: '#F1EFE8', borderRadius: '999px', marginTop: '5px' }}>
                          <div style={{ height: '100%', width: (pct ?? 0) + '%', background: barColor, borderRadius: '999px' }} />
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 500, flexShrink: 0 }}>
                        {score} <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>/ {col.max_score}</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: barColor, flexShrink: 0, minWidth: '36px', textAlign: 'right' }}>
                        {pct}%
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
        }

        <Divider />

        {/* Due */}
        <SectionHeader label={`Due (${dueItems.length})`} />
        {dueItems.length === 0
          ? <EmptyNote text="Nothing currently due." />
          : dueItems.map(q => (
              <AssessmentRow key={q.id} title={q.title} itemType={q.item_type ?? 'quiz'} dueDate={q.due_date} status="due" />
            ))
        }

        <Divider />

        {/* Missed */}
        <SectionHeader label={`Missed (${missedItems.length})`} />
        {missedItems.length === 0
          ? <EmptyNote text="Nothing missed." />
          : missedItems.map(q => (
              <AssessmentRow key={q.id} title={q.title} itemType={q.item_type ?? 'quiz'} dueDate={q.due_date} status="missed" />
            ))
        }
      </div>
    )
  }

  // ── Main list ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Students" subtitle="Approve enrollment requests and assign courses." />

      {/* ── Pending ── */}
      {pending.length > 0 && (
        <>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: '#854F0B' }}>
            Pending approvals ({pending.length})
          </div>
          {pending.map(s => (
            <PendingStudentCard
              key={s.id}
              student={s}
              openCourses={openCourses}
              isExpanded={approvingId === s.id}
              selectedCourses={selectedCourses}
              saving={saving}
              onStartApproving={() => startApproving(s.id)}
              onToggleCourse={toggleCourse}
              onApprove={handleApprove}
              onCancel={cancelApproving}
              onReject={() => handleReject(s.id)}
            />
          ))}
          <Divider />
        </>
      )}

      {/* ── Enrolled ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>Enrolled ({enrolled.length})</div>
        <select
          value={filterCourseId}
          onChange={e => setFilterCourseId(e.target.value)}
          style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer' }}
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
          ))}
        </select>
      </div>
      {(() => {
        const visible = filterCourseId === 'all'
          ? enrolled
          : enrolled.filter(s => enrollments.some(e => e.student_id === s.id && e.course_id === filterCourseId))
        return visible.length === 0
          ? <div style={{ fontSize: '13px', color: '#888' }}>No students in this course yet.</div>
          : visible.map(s => (
              <EnrolledStudentCard
                key={s.id}
                student={s}
                assignedCourses={getStudentCourses(s.id)}
                onClick={() => setViewingStudent(s)}
              />
            ))
      })()}

      {/* ── Rejected ── */}
      {rejected.length > 0 && (
        <>
          <Divider />
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px', color: '#A32D2D' }}>
            Rejected ({rejected.length})
          </div>
          {rejected.map(s => <StudentRow key={s.id} student={s} />)}
        </>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>{label}</div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '12px' }}>{text}</div>
}

function AssessmentRow({ title, itemType, dueDate, status }: {
  title: string; itemType: string; dueDate?: string; status: 'due' | 'missed'
}) {
  const accent = status === 'due' ? { bg: '#E6F1FB', color: '#185FA5' } : { bg: '#FCEBEB', color: '#A32D2D' }
  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)',
      borderRadius: '10px', padding: '9px 12px', marginBottom: '6px',
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{title}</div>
        {dueDate && (
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>
            Due {new Date(dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
      <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: accent.bg, color: accent.color }}>
        {itemType.charAt(0).toUpperCase() + itemType.slice(1)}
      </span>
    </div>
  )
}

// ─── PendingStudentCard ───────────────────────────────────────────────────────

function PendingStudentCard({
  student, openCourses, isExpanded, selectedCourses, saving,
  onStartApproving, onToggleCourse, onApprove, onCancel, onReject,
}: {
  student: Profile
  openCourses: Course[]
  isExpanded: boolean
  selectedCourses: string[]
  saving: boolean
  onStartApproving: () => void
  onToggleCourse: (id: string) => void
  onApprove: () => void
  onCancel: () => void
  onReject: () => void
}) {
  const colors = getAvatarColors(student.full_name)
  const approveLabel = selectedCourses.length > 0
    ? `Approve & assign ${selectedCourses.length} course${selectedCourses.length > 1 ? 's' : ''}`
    : 'Approve'

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px', background: '#fff',
        border: '0.5px solid #EF9F27',
        borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
      }}>
        <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{student.email}</div>
        </div>
        <Badge label="Pending" color="amber" />
        {!isExpanded && (
          <>
            <Button variant="primary" onClick={onStartApproving}>Approve</Button>
            <Button variant="danger" onClick={onReject}>Reject</Button>
          </>
        )}
      </div>

      {isExpanded && (
        <div style={{
          border: '0.5px solid #EF9F27', borderTop: 'none',
          borderRadius: '0 0 12px 12px', padding: '12px 14px',
          background: '#FEFDF7',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#555', marginBottom: '8px' }}>
            Assign courses <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span>
          </div>
          {openCourses.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>No open courses available.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {openCourses.map(c => {
                const active = selectedCourses.includes(c.id)
                return (
                  <button key={c.id} onClick={() => onToggleCourse(c.id)} style={{
                    padding: '5px 12px', fontSize: '12px', borderRadius: '999px',
                    border: active ? 'none' : '0.5px solid rgba(0,0,0,0.2)',
                    background: active ? '#185FA5' : 'transparent',
                    color: active ? '#fff' : '#555',
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                  }}>
                    {c.name}{c.section ? ` · ${c.section}` : ''}
                  </button>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button variant="primary" onClick={onApprove} disabled={saving}>
              {saving ? 'Saving…' : approveLabel}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="danger" onClick={onReject}>Reject</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EnrolledStudentCard ──────────────────────────────────────────────────────

function EnrolledStudentCard({ student, assignedCourses, onClick }: {
  student: Profile
  assignedCourses: Course[]
  onClick: () => void
}) {
  const colors = getAvatarColors(student.full_name)
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', marginBottom: '8px', padding: '9px',
      display: 'flex', alignItems: 'center', gap: '10px',
      cursor: 'pointer',
    }}>
      <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>{student.email}</div>
        {assignedCourses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
            {assignedCourses.map(c => (
              <span key={c.id} style={{
                fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                borderRadius: '999px', background: '#E6F1FB', color: '#185FA5',
              }}>
                {c.name}{c.section ? ` · ${c.section}` : ''}
              </span>
            ))}
          </div>
        )}
        {assignedCourses.length === 0 && (
          <div style={{ fontSize: '11px', color: '#bbb', marginTop: '3px' }}>No courses assigned</div>
        )}
      </div>
      <Badge label="Enrolled" color="green" />
      <span style={{ fontSize: '11px', color: '#aaa' }}>View →</span>
    </div>
  )
}
