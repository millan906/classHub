import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useMyAttendance } from '../../hooks/useAttendance'
import { useQuizzes } from '../../hooks/useQuizzes'
import { usePdfQuizzes } from '../../hooks/usePdfQuizzes'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { printSyllabus } from '../../utils/syllabuspPrint'
import { downloadFile } from '../../utils/downloadFile'
import type { Course, CourseResource, SyllabusCell } from '../../types'

const SCHEDULE_TYPE_LABELS: Record<string, string> = { lecture: 'Lecture', lab: 'Lab', other: 'Other' }
const CAT_LABELS: Record<CourseResource['category'], string> = {
  book: '📚 Books', journal: '📰 Journal Readings', lab: '🧪 Lab Materials', other: '📎 Other',
}

function SyllabusFileLink({ cell, getResourceUrl }: { cell: SyllabusCell; getResourceUrl: (p: string) => string }) {
  if (!cell.text && !cell.file_path && !cell.link) return <span style={{ color: '#ccc' }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {cell.text && <span style={{ fontSize: '12px', color: '#333' }}>{cell.text}</span>}
      {cell.file_path && (
        <button
          onClick={() => void downloadFile(getResourceUrl(cell.file_path!), cell.file_name ?? 'file')}
          style={{ fontSize: '11px', color: '#185FA5', textDecoration: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          📎 {cell.file_name ?? 'File'}
        </button>
      )}
      {!cell.file_path && cell.link && (
        <a href={cell.link} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', color: '#185FA5', textDecoration: 'none' }}>
          🔗 Link
        </a>
      )}
    </div>
  )
}

function CourseDetail({ course, onBack, getResourceUrl }: {
  course: Course
  onBack: () => void
  getResourceUrl: (p: string) => string
}) {
  const schedule = course.schedule ?? []
  const topics = course.topics ?? []
  const grading = course.grading_system ?? []
  const resources = course.resources ?? []
  const syllabus = course.syllabus ?? []

  const byCategory = (cat: CourseResource['category']) => resources.filter(r => r.category === cat)

  return (
    <div>
      {/* Back + header */}
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#555', marginBottom: '12px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        ← Back to courses
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
          🏫
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{course.name}</div>
          {course.section && <div style={{ fontSize: '13px', color: '#888' }}>Section {course.section}</div>}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {(syllabus.length > 0 || grading.length > 0) && (
            <button
              onClick={() => printSyllabus(course, getResourceUrl)}
              style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '8px', border: '0.5px solid #1D9E75', background: '#E1F5EE', color: '#0F6E56', cursor: 'pointer', fontWeight: 500 }}
            >
              🖨 Print / Download
            </button>
          )}
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '3px 12px', borderRadius: '999px',
            background: course.status === 'open' ? '#E1F5EE' : '#F1EFE8',
            color: course.status === 'open' ? '#0F6E56' : '#888',
          }}>
            {course.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Grading summary — horizontal, shown at top */}
      {grading.length > 0 && (
        <Section title="Grading System">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {grading.map((p, i) => (
                    <th key={i} style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'center', border: '0.5px solid #ddd', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.label}</th>
                  ))}
                  <th style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'center', border: '0.5px solid #ddd', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {grading.map((p, i) => (
                    <td key={i} style={{ padding: '5px 10px', border: '0.5px solid #eee', textAlign: 'center', fontWeight: 600, color: '#1D9E75' }}>{p.weight}%</td>
                  ))}
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', textAlign: 'center', fontWeight: 700, color: '#1D9E75', background: '#F9F9F7' }}>{grading.reduce((s, p) => s + p.weight, 0)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Schedule */}
      {schedule.length > 0 && (
        <Section title="Class Schedule">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '320px' }}>
              <thead>
                <tr>
                  {['Type', 'Day', 'Time', 'Room'].map(h => (
                    <th key={h} style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'left', border: '0.5px solid #ddd', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map(s => (
                  <tr key={s.id}>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 600, whiteSpace: 'nowrap' }}>{SCHEDULE_TYPE_LABELS[s.type] ?? s.type}</td>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee' }}>{s.day}</td>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee', whiteSpace: 'nowrap' }}>{s.time}</td>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee', color: '#888' }}>{s.room ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Topics */}
      {topics.length > 0 && (
        <Section title="Topics / Modules">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {topics.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1D9E75', minWidth: '20px', flexShrink: 0, marginTop: '1px' }}>{i + 1}.</span>
                <span style={{ fontSize: '13px', color: '#333' }}>{t}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Syllabus table */}
      {syllabus.length > 0 && (
        <Section title="Course Syllabus">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {(['Week', 'Lesson / Topic', 'Readings', 'Assignments', 'Laboratory'] as const).map(h => (
                    <th key={h} style={{ background: '#F1EFE8', padding: '8px 10px', border: '0.5px solid #ddd', textAlign: 'left', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap', width: h === 'Week' ? '60px' : h === 'Lesson / Topic' ? '22%' : undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syllabus.map(row => (
                  <tr key={row.id}>
                    <td style={{ padding: '8px 10px', border: '0.5px solid #eee', verticalAlign: 'top', whiteSpace: 'nowrap', color: '#888', fontWeight: 500 }}>{row.week}</td>
                    <td style={{ padding: '8px 10px', border: '0.5px solid #eee', verticalAlign: 'top' }}>{row.lesson}</td>
                    <td style={{ padding: '8px 10px', border: '0.5px solid #eee', verticalAlign: 'top' }}><SyllabusFileLink cell={row.readings} getResourceUrl={getResourceUrl} /></td>
                    <td style={{ padding: '8px 10px', border: '0.5px solid #eee', verticalAlign: 'top' }}><SyllabusFileLink cell={row.assignments} getResourceUrl={getResourceUrl} /></td>
                    <td style={{ padding: '8px 10px', border: '0.5px solid #eee', verticalAlign: 'top' }}><SyllabusFileLink cell={row.laboratory} getResourceUrl={getResourceUrl} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Resources by category */}
      {resources.length > 0 && (
        <Section title="Resources">
          {(['book', 'journal', 'lab', 'other'] as CourseResource['category'][]).map(cat => {
            const items = byCategory(cat)
            if (items.length === 0) return null
            return (
              <div key={cat} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  {CAT_LABELS[cat]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {items.map(r => {
                    const href = r.file_path ? getResourceUrl(r.file_path) : r.link
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{r.file_path ? '📎' : '🔗'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{r.title || r.file_name || r.link}</div>
                          {r.file_name && r.title && <div style={{ fontSize: '11px', color: '#aaa' }}>{r.file_name}</div>}
                        </div>
                        {r.file_path ? (
                          <button
                            onClick={() => void downloadFile(getResourceUrl(r.file_path!), r.file_name ?? r.title ?? 'file')}
                            style={{ fontSize: '12px', color: '#185FA5', fontWeight: 500, flexShrink: 0, padding: '3px 10px', border: '0.5px solid #185FA5', borderRadius: '6px', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Download
                          </button>
                        ) : r.link ? (
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none', fontWeight: 500, flexShrink: 0, padding: '3px 10px', border: '0.5px solid #185FA5', borderRadius: '6px' }}
                          >
                            Open
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </Section>
      )}


      {schedule.length === 0 && topics.length === 0 && resources.length === 0 && grading.length === 0 && (
        <div style={{ fontSize: '13px', color: '#aaa', marginTop: '8px' }}>
          Your professor hasn't added course details yet.
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function StudentCourses() {
  const { profile } = useAuth()
  const { courses, getResourceUrl } = useCourses()
  const { enrolledCourseIds, loading } = useMyEnrollments(profile?.id ?? null)
  const { groups, columns, entries } = useGradeBook()
  const { sessions, records, loading: attendanceLoading } = useMyAttendance(profile?.id ?? null)
  const { quizzes, submissions, fetchMySubmissions } = useQuizzes()
  const { pdfQuizzes, submissions: pdfSubmissions, fetchMySubmissions: fetchMyPdfSubmissions } = usePdfQuizzes()
  const { announcements } = useAnnouncements()
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  useEffect(() => {
    if (profile) {
      fetchMySubmissions(profile.id)
      fetchMyPdfSubmissions(profile.id)
    }
  }, [profile])

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))
  const myEntries = entries.filter(e => e.student_id === profile?.id)
  const submittedQuizIds = new Set(submissions.map(s => s.quiz_id))
  const submittedPdfQuizIds = new Set(pdfSubmissions.map(s => s.pdf_quiz_id))
  const now = new Date()

  // ─── Per-course helpers ────────────────────────────────────────────────────
  function getCourseGrade(courseId: string): number | null {
    const courseGroups = groups.filter(g => !g.course_id || g.course_id === courseId)
    const courseColumns = columns.filter(c => !c.course_id || c.course_id === courseId)
    const rows = courseGroups.map(g => {
      const cols = courseColumns.filter(c => c.group_id === g.id)
      const graded = cols.filter(c => myEntries.some(e => e.column_id === c.id && e.score !== null))
      const totalEarned = graded.reduce((sum, c) => {
        const entry = myEntries.find(e => e.column_id === c.id)
        return sum + (entry?.score ?? 0)
      }, 0)
      const totalMax = graded.reduce((sum, c) => sum + c.max_score, 0)
      const rawPct = totalMax > 0 ? (totalEarned / totalMax) * 100 : null
      return rawPct !== null ? (rawPct * g.weight_percent) / 100 : null
    })
    if (!rows.some(r => r !== null)) return null
    return rows.reduce<number>((sum, r) => sum + (r ?? 0), 0)
  }

  function getCourseAttendance(courseId: string): number | null {
    const courseSessions = sessions.filter(s => s.course_id === courseId)
    if (courseSessions.length === 0) return null
    const sessionIds = new Set(courseSessions.map(s => s.id))
    const studentRecords = records.filter(r => sessionIds.has(r.session_id))
    if (studentRecords.length === 0) return null
    const present = studentRecords.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'excused').length
    return Math.round((present / studentRecords.length) * 100)
  }

  function getCourseUnread(courseId: string): number {
    const lastSeen = localStorage.getItem(`announcements_seen_${profile?.id}`)
    return announcements
      .filter(a => a.course_id === courseId)
      .filter(a => !lastSeen || new Date(a.created_at) > new Date(lastSeen))
      .length
  }

  type DueItem = { id: string; title: string; due_date?: string | null; close_at?: string | null; is_open: boolean; item_type?: string }

  function getCourseNextDue(courseId: string): DueItem | null {
    const items: DueItem[] = [
      ...quizzes.filter(q => q.course_id === courseId && q.is_open && !submittedQuizIds.has(q.id)),
      ...pdfQuizzes.filter(q => q.course_id === courseId && q.is_open && !submittedPdfQuizIds.has(q.id)).map(q => ({ ...q, item_type: 'paper' })),
    ].sort((a, b) => {
      const aD = a.close_at || a.due_date
      const bD = b.close_at || b.due_date
      if (!aD && !bD) return 0
      if (!aD) return 1
      if (!bD) return -1
      return new Date(aD).getTime() - new Date(bD).getTime()
    })
    return items[0] ?? null
  }

  function getCourseMissed(courseId: string): DueItem | null {
    return [
      ...quizzes.filter(q => q.course_id === courseId && !q.is_open && !submittedQuizIds.has(q.id)),
      ...pdfQuizzes.filter(q => q.course_id === courseId && !q.is_open && !submittedPdfQuizIds.has(q.id)).map(q => ({ ...q, item_type: 'paper' })),
    ][0] ?? null
  }

  function getBorderColor(courseId: string): string {
    const missed = getCourseMissed(courseId)
    if (missed) return '#ef4444'
    const grade = getCourseGrade(courseId)
    if (grade === null || grade >= 75) return '#1ecf96'
    if (grade >= 60) return '#3b82f6'
    return '#ef4444'
  }

  function itemTypeLabel(type?: string): string {
    if (!type || type === 'paper') return type === 'paper' ? 'Paper' : 'Quiz'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  function itemTypeStyle(type?: string): { bg: string; color: string } {
    switch (type?.toLowerCase()) {
      case 'lab':        return { bg: '#f0fdf4', color: '#16a34a' }
      case 'exam':       return { bg: '#fef2f2', color: '#dc2626' }
      case 'assignment': return { bg: '#faf5ff', color: '#7c3aed' }
      case 'project':    return { bg: '#fff7ed', color: '#c2410c' }
      case 'activity':   return { bg: '#fefce8', color: '#a16207' }
      default:           return { bg: '#eff6ff', color: '#2563eb' }
    }
  }

  function deadlineStr(item: DueItem): string | null {
    const d = item.close_at || item.due_date
    if (!d) return null
    return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (loading || attendanceLoading) return null

  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
        getResourceUrl={getResourceUrl}
      />
    )
  }

  const todayStr = now.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#c5c2bb', marginBottom: '4px' }}>My Courses</div>
          <div style={{ fontSize: '13px', color: '#aaa' }}>
            {enrolledCourses.length} course{enrolledCourses.length !== 1 ? 's' : ''} enrolled · {todayStr}
          </div>
        </div>
      </div>

      {enrolledCourses.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid #e9e7e1', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>No courses yet</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor will enroll you in a course.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {enrolledCourses.map(course => {
            const borderColor = getBorderColor(course.id)
            const grade = getCourseGrade(course.id)
            const attendance = getCourseAttendance(course.id)
            const unread = getCourseUnread(course.id)
            const nextDue = getCourseNextDue(course.id)
            const missed = getCourseMissed(course.id)
            const hasInfo = (course.topics?.length ?? 0) > 0 || (course.schedule?.length ?? 0) > 0
              || (course.resources?.length ?? 0) > 0 || (course.grading_system?.length ?? 0) > 0
              || (course.syllabus?.length ?? 0) > 0

            return (
              <div
                key={course.id}
                style={{
                  background: '#fff',
                  border: '0.5px solid #e9e7e1',
                  borderLeft: `3px solid ${borderColor}`,
                  borderRadius: '14px',
                  overflow: 'hidden',
                }}
              >
                {/* Header row */}
                <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{course.name}</span>
                      {course.section && (
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#888', background: '#f5f4f0', padding: '2px 8px', borderRadius: '999px' }}>
                          {course.section}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, fontSize: '11px', fontWeight: 500,
                    padding: '3px 12px', borderRadius: '999px',
                    background: course.status === 'open' ? '#E1F5EE' : '#F1EFE8',
                    color: course.status === 'open' ? '#0F6E56' : '#aaa',
                  }}>
                    {course.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>

                {/* Stats row */}
                <div style={{ margin: '0 18px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderRadius: '10px', overflow: 'hidden', border: '0.5px solid #f0eeea' }}>
                  {[
                    { label: 'Grade', value: grade !== null ? `${grade.toFixed(0)}%` : '—', color: grade !== null && grade < 60 ? '#ef4444' : '#1a1a1a' },
                    { label: 'Attendance', value: attendance !== null ? `${attendance}%` : '—', color: '#1a1a1a' },
                    { label: 'Unread', value: unread > 0 ? String(unread) : '0', color: unread > 0 ? '#1ecf96' : '#1a1a1a' },
                  ].map((stat, i) => (
                    <div
                      key={stat.label}
                      style={{
                        padding: '10px 14px',
                        background: '#f9f8f5',
                        borderLeft: i > 0 ? '0.5px solid #f0eeea' : 'none',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{stat.label}</div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Footer row */}
                <div style={{ padding: '10px 18px', borderTop: '0.5px solid #f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
                    {missed ? (
                      <>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {missed.title} was due{' '}
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>
                            {missed.due_date ? new Date(missed.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                          </span>
                          {' '}— missed
                        </span>
                        {missed.item_type && (
                          <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', flexShrink: 0, background: itemTypeStyle(missed.item_type).bg, color: itemTypeStyle(missed.item_type).color }}>
                            {itemTypeLabel(missed.item_type)}
                          </span>
                        )}
                      </>
                    ) : nextDue ? (
                      <>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nextDue.title} due{' '}
                          <span style={{ fontWeight: 600 }}>{deadlineStr(nextDue)}</span>
                        </span>
                        {nextDue.item_type && (
                          <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', flexShrink: 0, background: itemTypeStyle(nextDue.item_type).bg, color: itemTypeStyle(nextDue.item_type).color }}>
                            {itemTypeLabel(nextDue.item_type)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#ccc' }}>No upcoming items</span>
                    )}
                  </div>
                  {hasInfo && (
                    <button
                      onClick={() => setSelectedCourse(course)}
                      style={{ fontSize: '12px', color: '#1ecf96', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, padding: 0 }}
                    >
                      Syllabus →
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
