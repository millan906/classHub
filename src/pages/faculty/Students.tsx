import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useStudents } from '../../hooks/useStudents'
import { useCourses } from '../../hooks/useCourses'
import { useAllEnrollments } from '../../hooks/useEnrollments'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useGradeBook } from '../../hooks/useGradeBook'
import { PageHeader, Divider } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import { scoreBarColor } from '../../utils/scoreColors'
import { Badge } from '../../components/ui/Badge'
import type { Profile, Course } from '../../types'

export default function FacultyStudents() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { students, approveWithCourses, rejectStudent } = useStudents(institution?.id)
  const { courses } = useCourses(null, profile?.id)
  const { enrollments, refetch: refetchEnrollments, unenrollStudent } = useAllEnrollments()
  const { quizzes, submissions } = useQuizzes()
  const { groups, columns, entries } = useGradeBook()

  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [selectedCourses, setSelectedCourses] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [filterCourseId, setFilterCourseId] = useState<string>('all')
  const [filterSection, setFilterSection] = useState<string>('all')
  const [viewingStudent, setViewingStudent] = useState<Profile | null>(null)

  const pending = students.filter(s => s.status === 'pending')
  const enrolled = students.filter(s => s.status === 'approved')
  const rejected = students.filter(s => s.status === 'rejected')
  const openCourses = courses.filter(c => c.status === 'open')

  // Unique sections across all enrolled students (for filter dropdown)
  const allSections = [...new Set(
    enrolled.map(s => s.section).filter((sec): sec is string => !!sec)
  )].sort()

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
          <Avatar initials={getInitials(viewingStudent.full_name)} bg={colors.bg} color={colors.color} seed={viewingStudent.avatar_seed} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500 }}>{viewingStudent.full_name}</div>
            <div style={{ fontSize: '12px', color: '#888' }}>{viewingStudent.email}</div>
            {(viewingStudent.program || viewingStudent.section) && (
              <div style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500, marginTop: '1px' }}>
                {[viewingStudent.program, viewingStudent.section].filter(Boolean).join(' · ')}
              </div>
            )}
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

        <Divider />

        {/* Submissions */}
        <SectionHeader label={`Submissions (${studentSubs.length})`} />
        {studentSubs.length === 0
          ? <EmptyNote text="No submissions yet." />
          : studentSubs.map(sub => {
              const quiz = quizzes.find(q => q.id === sub.quiz_id)
              const timeTaken = sub.started_at && sub.submitted_at
                ? Math.round((new Date(sub.submitted_at).getTime() - new Date(sub.started_at).getTime()) / 60000)
                : null
              const questions = (quiz?.questions ?? []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
              const hasTimestamps = sub.answer_timestamps && Object.keys(sub.answer_timestamps).length > 0
              return (
                <div key={sub.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{quiz?.title ?? 'Unknown'}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '1px', textTransform: 'capitalize' }}>{quiz?.item_type ?? 'quiz'}</div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: scoreBarColor(sub.score) }}>{sub.score}%</span>
                  </div>
                  {/* Time stats */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: '#888', marginBottom: hasTimestamps ? '10px' : 0 }}>
                    {sub.started_at && <span>Started: <strong style={{ color: '#555' }}>{new Date(sub.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>}
                    {sub.submitted_at && <span>Submitted: <strong style={{ color: '#555' }}>{new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>}
                    {timeTaken !== null && <span>Time: <strong style={{ color: '#555' }}>{timeTaken} min{timeTaken !== 1 ? 's' : ''}</strong></span>}
                    {sub.keystroke_count != null && sub.keystroke_count > 0 && <span>Keystrokes: <strong style={{ color: '#555' }}>{sub.keystroke_count}</strong></span>}
                  </div>
                  {/* Per-question timing */}
                  {questions.length > 0 && hasTimestamps && (
                    <div style={{ borderTop: '0.5px solid #F1EFE8', paddingTop: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Per-question timing</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {questions.map((q, i) => {
                          const ts = sub.answer_timestamps?.[q.id]
                          const relSecs = ts && sub.started_at
                            ? Math.round((new Date(ts).getTime() - new Date(sub.started_at).getTime()) / 1000)
                            : null
                          const relStr = relSecs !== null
                            ? relSecs < 60 ? `${relSecs}s` : `${Math.floor(relSecs / 60)}m ${relSecs % 60}s`
                            : null
                          return (
                            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                              <span style={{ color: '#aaa', minWidth: '24px', fontWeight: 600 }}>Q{i + 1}</span>
                              <span style={{ flex: 1, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {q.question_text.length > 55 ? q.question_text.slice(0, 55) + '…' : q.question_text}
                              </span>
                              <span style={{ flexShrink: 0, color: relStr ? '#1D9E75' : '#ddd', fontWeight: relStr ? 600 : 400 }}>
                                {relStr ? `@ ${relStr}` : '—'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>Enrolled ({enrolled.length})</div>
        {allSections.length > 0 && (
          <select
            value={filterSection}
            onChange={e => setFilterSection(e.target.value)}
            style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer' }}
          >
            <option value="all">All Sections</option>
            {allSections.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        )}
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
        let visible = enrolled
        if (filterSection !== 'all') visible = visible.filter(s => s.section === filterSection)
        if (filterCourseId !== 'all') visible = visible.filter(s => enrollments.some(e => e.student_id === s.id && e.course_id === filterCourseId))
        return visible.length === 0
          ? <div style={{ fontSize: '13px', color: '#888' }}>No students match the selected filters.</div>
          : visible.map(s => (
              <EnrolledStudentCard
                key={s.id}
                student={s}
                assignedCourses={getStudentCourses(s.id)}
                onClick={() => setViewingStudent(s)}
                onUnenroll={courseId => unenrollStudent(courseId, s.id)}
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
          {rejected.map(s => (
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
              badgeLabel="Rejected"
              borderColor="rgba(163,45,45,0.25)"
            />
          ))}
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
  badgeLabel = 'Pending', borderColor = '#EF9F27',
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
  onReject?: () => void
  badgeLabel?: string
  borderColor?: string
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
        border: `0.5px solid ${borderColor}`,
        borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
      }}>
        <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} seed={student.avatar_seed} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{student.email}</div>
          {(student.program || student.section) && (
            <div style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500, marginTop: '2px' }}>
              {[student.program, student.section].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <Badge label={badgeLabel} color={badgeLabel === 'Rejected' ? 'red' : 'amber'} />
        {!isExpanded && (
          <>
            <Button variant="primary" onClick={onStartApproving}>Approve</Button>
            {onReject && <Button variant="danger" onClick={onReject}>Reject</Button>}
          </>
        )}
      </div>

      {isExpanded && (
        <div style={{
          border: `0.5px solid ${borderColor}`, borderTop: 'none',
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
            {onReject && <Button variant="danger" onClick={onReject}>Reject</Button>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EnrolledStudentCard ──────────────────────────────────────────────────────

function EnrolledStudentCard({ student, assignedCourses, onClick, onUnenroll }: {
  student: Profile
  assignedCourses: Course[]
  onClick: () => void
  onUnenroll: (courseId: string) => void
}) {
  const colors = getAvatarColors(student.full_name)
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', marginBottom: '8px', padding: '9px',
      display: 'flex', alignItems: 'center', gap: '10px',
      cursor: 'pointer',
    }}>
      <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} seed={student.avatar_seed} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badge + view on one row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{student.full_name}</span>
          <Badge label="Enrolled" color="green" />
          <span style={{ fontSize: '11px', color: '#aaa', marginLeft: 'auto' }}>View →</span>
        </div>
        <div style={{ fontSize: '12px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{student.email}</div>
          {(student.program || student.section) && (
            <div style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500, marginTop: '1px' }}>
              {[student.program, student.section].filter(Boolean).join(' · ')}
            </div>
          )}
        {assignedCourses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
            {assignedCourses.map(c => (
              <span key={c.id} style={{
                fontSize: '11px', fontWeight: 500, padding: '2px 6px 2px 8px',
                borderRadius: '999px', background: '#E6F1FB', color: '#185FA5',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>
                {c.name}{c.section ? ` · ${c.section}` : ''}
                <button
                  onClick={e => { e.stopPropagation(); onUnenroll(c.id) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#185FA5', fontSize: '13px', lineHeight: 1,
                    padding: '0', display: 'flex', alignItems: 'center',
                  }}
                  title="Unenroll from this course"
                >×</button>
              </span>
            ))}
          </div>
        )}
        {assignedCourses.length === 0 && (
          <div style={{ fontSize: '11px', color: '#bbb', marginTop: '3px' }}>No courses assigned</div>
        )}
      </div>
    </div>
  )
}
