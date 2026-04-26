import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSlides } from '../../hooks/useSlides'
import { useQuizzes } from '../../hooks/useQuizzes'
import { usePdfQuizzes } from '../../hooks/usePdfQuizzes'
import { useQA } from '../../hooks/useQA'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useGradesVisible } from '../../hooks/useSettings'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { useMyAttendance } from '../../hooks/useAttendance'
import { useCourses } from '../../hooks/useCourses'
import { useIsMobile } from '../../hooks/useIsMobile'
import { scoreBarColor } from '../../utils/scoreColors'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const { slides } = useSlides()
  const { quizzes, submissions, fetchMySubmissions } = useQuizzes()
  const { pdfQuizzes, submissions: pdfSubmissions, fetchMySubmissions: fetchMyPdfSubmissions } = usePdfQuizzes()
  useQA()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const { groups, columns, entries } = useGradeBook()
  const { gradesVisible } = useGradesVisible(profile?.id ?? null)
  const { announcements } = useAnnouncements()
  const { records: attendanceRecords } = useMyAttendance(profile?.id ?? null)
  const { courses } = useCourses()
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) {
      fetchMySubmissions(profile.id)
      fetchMyPdfSubmissions(profile.id)
    }
  }, [profile])

  void slides
  void attendanceRecords

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function getCourseName(courseId?: string | null): string | null {
    if (!courseId) return null
    return courses.find(c => c.id === courseId)?.name ?? null
  }

  function itemTypeStyle(type?: string): { bg: string; color: string } {
    switch (type?.toLowerCase()) {
      case 'lab':        return { bg: '#f0fdf4', color: '#16a34a' }
      case 'exam':       return { bg: '#fef2f2', color: '#dc2626' }
      case 'assignment': return { bg: '#faf5ff', color: '#7c3aed' }
      case 'project':    return { bg: '#fff7ed', color: '#c2410c' }
      case 'activity':   return { bg: '#fefce8', color: '#a16207' }
      case 'paper':      return { bg: '#f5f4f0', color: '#888' }
      default:           return { bg: '#eff6ff', color: '#2563eb' }
    }
  }

  function itemTypeLabel(type?: string): string {
    if (!type || type === 'paper') return type === 'paper' ? 'Paper' : 'Quiz'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  // ─── Filters ───────────────────────────────────────────────────────────────
  const visibleQuizzes = useMemo(
    () => quizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id)),
    [quizzes, enrolledCourseIds],
  )
  const visiblePdfQuizzes = useMemo(
    () => pdfQuizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id)),
    [pdfQuizzes, enrolledCourseIds],
  )
  const submittedQuizIds = useMemo(() => new Set(submissions.map(s => s.quiz_id)), [submissions])
  const submittedPdfQuizIds = useMemo(() => new Set(pdfSubmissions.map(s => s.pdf_quiz_id)), [pdfSubmissions])

  const now = new Date()

  // ─── Due & missed items ────────────────────────────────────────────────────
  type DueItem = {
    id: string
    title: string
    due_date?: string | null
    close_at?: string | null
    is_open: boolean
    item_type?: string
    course_id?: string | null
  }

  const allDueItems: DueItem[] = useMemo(() => [
    ...visibleQuizzes.filter(q => q.is_open && !submittedQuizIds.has(q.id)),
    ...visiblePdfQuizzes.filter(q => q.is_open && !submittedPdfQuizIds.has(q.id)).map(q => ({ ...q, item_type: 'paper' })),
  ].sort((a, b) => {
    const aDate = a.close_at || a.due_date
    const bDate = b.close_at || b.due_date
    if (!aDate && !bDate) return 0
    if (!aDate) return 1
    if (!bDate) return -1
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  }), [visibleQuizzes, visiblePdfQuizzes, submittedQuizIds, submittedPdfQuizIds])

  const allMissedItems: DueItem[] = useMemo(() => [
    ...visibleQuizzes.filter(q => !q.is_open && !submittedQuizIds.has(q.id)),
    ...visiblePdfQuizzes.filter(q => !q.is_open && !submittedPdfQuizIds.has(q.id)).map(q => ({ ...q, item_type: 'paper' })),
  ], [visibleQuizzes, visiblePdfQuizzes, submittedQuizIds, submittedPdfQuizIds])

  const heroItem = allDueItems[0] ?? null
  const upNextItems = allDueItems.slice(1)

  // ─── Hero helpers ──────────────────────────────────────────────────────────
  function heroDeadline(item: DueItem): Date | null {
    const d = item.close_at || item.due_date
    return d ? new Date(d) : null
  }

  function heroHoursLeft(item: DueItem): number {
    const d = heroDeadline(item)
    if (!d) return 0
    return Math.max(0, Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60)))
  }

  function heroEyebrow(item: DueItem): string {
    const d = heroDeadline(item)
    if (!d) return 'Due soon'
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) return 'Past due'
    if (diffDays < 1) return 'Due today'
    if (diffDays < 2) return 'Due tomorrow'
    return `Due ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
  }

  function heroClosesLabel(item: DueItem): string | null {
    const d = item.close_at ? new Date(item.close_at) : item.due_date ? new Date(item.due_date) : null
    if (!d) return null
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const dateStr = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    return `Closes ${dateStr} at ${timeStr}`
  }

  function heroHintText(item: DueItem): string | null {
    const d = item.close_at ? new Date(item.close_at) : item.due_date ? new Date(item.due_date) : null
    if (!d) return null
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays < 1) return `Complete this today — it closes at ${timeStr}.`
    if (diffDays < 2) return `Complete this before you sleep tonight — it closes at ${timeStr} tomorrow morning.`
    return `This closes on ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}.`
  }

  // ─── Up next date label ────────────────────────────────────────────────────
  function upNextDate(item: DueItem): { day: string; month: string } {
    const d = item.close_at || item.due_date
    if (!d) return { day: '—', month: '' }
    const date = new Date(d)
    return {
      day: date.getDate().toString(),
      month: date.toLocaleDateString([], { month: 'short' }).toUpperCase(),
    }
  }

  function upNextDeadlineStr(item: DueItem): string | null {
    const d = item.close_at || item.due_date
    if (!d) return null
    return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // ─── Grade summary ─────────────────────────────────────────────────────────
  const enrolledGroups = useMemo(() => enrolledCourseIds.length > 0
    ? groups.filter(g => !g.course_id || enrolledCourseIds.includes(g.course_id))
    : groups,
  [enrolledCourseIds, groups])
  const enrolledColumns = useMemo(() => enrolledCourseIds.length > 0
    ? columns.filter(c => !c.course_id || enrolledCourseIds.includes(c.course_id))
    : columns,
  [enrolledCourseIds, columns])

  const myEntries = useMemo(() => entries.filter(e => e.student_id === profile?.id), [entries, profile?.id])
  const weightedRows = useMemo(() => enrolledGroups.map(g => {
    const cols = enrolledColumns.filter(c => c.group_id === g.id)
    const graded = cols.filter(c => myEntries.some(e => e.column_id === c.id && e.score !== null))
    const totalEarned = graded.reduce((sum, c) => {
      const entry = myEntries.find(e => e.column_id === c.id)
      return sum + (entry?.score ?? 0)
    }, 0)
    const totalMax = graded.reduce((sum, c) => sum + c.max_score, 0)
    const rawPct = totalMax > 0 ? (totalEarned / totalMax) * 100 : null
    const weighted = rawPct !== null ? (rawPct * g.weight_percent) / 100 : null
    return { group: g, rawPct, weighted }
  }), [enrolledGroups, enrolledColumns, myEntries])
  const hasAnyGrade = weightedRows.some(r => r.weighted !== null)
  const finalGrade = weightedRows.reduce((sum, r) => sum + (r.weighted ?? 0), 0)
  const totalWeight = weightedRows.filter(r => r.weighted !== null).reduce((sum, r) => sum + r.group.weight_percent, 0)
  const gwa = hasAnyGrade ? percentageToGWA(finalGrade) : null

  // ─── Recent submissions ────────────────────────────────────────────────────
  type RecentSub = {
    id: string
    title: string
    courseName: string | null
    earnedPoints: number | null
    totalPoints: number | null
    submittedAt: string
  }

  const recentSubmissions: RecentSub[] = useMemo(() => [
    ...submissions.map(s => {
      const quiz = quizzes.find(q => q.id === s.quiz_id)
      return {
        id: s.id,
        title: quiz?.title ?? '',
        courseName: courses.find(c => c.id === quiz?.course_id)?.name ?? null,
        earnedPoints: s.earned_points ?? null,
        totalPoints: s.total_points ?? null,
        submittedAt: s.submitted_at,
      }
    }),
    ...pdfSubmissions.map(s => {
      const quiz = pdfQuizzes.find(q => q.id === s.pdf_quiz_id)
      return {
        id: s.id,
        title: quiz?.title ?? '',
        courseName: courses.find(c => c.id === quiz?.course_id)?.name ?? null,
        earnedPoints: s.earned_points ?? null,
        totalPoints: quiz?.total_points ?? null,
        submittedAt: s.submitted_at,
      }
    }),
  ]
    .filter(s => s.title)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 3),
  [submissions, pdfSubmissions, quizzes, pdfQuizzes, courses])

  // ─── Announcements ─────────────────────────────────────────────────────────
  const recentAnnouncements = useMemo(() => announcements
    .filter(a => !a.course_id || enrolledCourseIds.includes(a.course_id))
    .slice(0, 2),
  [announcements, enrolledCourseIds])

  // ─── Header counts ─────────────────────────────────────────────────────────
  const dueCount = allDueItems.length
  const subtitleDue = dueCount === 0 ? "You're all caught up" : `${dueCount} thing${dueCount !== 1 ? 's' : ''} due this week`
  const subtitleSuffix = heroItem ? ` — start with the ${itemTypeLabel(heroItem.item_type).toLowerCase()}` : ''

  // ─── Greeting ──────────────────────────────────────────────────────────────
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Student'
  const todayStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: '#fff',
    border: '0.5px solid #e9e7e1',
    borderRadius: '16px',
    overflow: 'hidden',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.09em',
    color: '#c5c2bb', marginBottom: '8px',
  }

  function tagStyle(bg: string, color: string): React.CSSProperties {
    return {
      fontSize: '10px', fontWeight: 500,
      padding: '3px 9px', borderRadius: '20px',
      background: bg, color, whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.4px' }}>
            {greeting}, {firstName}
          </div>
          <div style={{ fontSize: '13px', color: '#aaa', marginTop: '2px' }}>
            {subtitleDue}{subtitleSuffix}
          </div>
        </div>
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#f6f5f1', border: '0.5px solid #e9e7e1',
            borderRadius: '999px', padding: '6px 8px 6px 14px',
          }}>
            <span style={{ fontSize: '13px', color: '#888' }}>{todayStr}</span>
          </div>
        )}
      </div>

      {/* ── Needs Your Attention ── */}
      <div>
        <div style={sectionLabel}>Needs your attention</div>
        {heroItem ? (
          <div style={card}>
            <div style={{ padding: '18px 18px 14px', display: 'flex', gap: '14px' }}>
              {/* Green accent bar */}
              <div style={{ width: '3px', borderRadius: '2px', background: '#1ecf96', flexShrink: 0, alignSelf: 'stretch' }} />
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#1ecf96', marginBottom: '5px' }}>
                  {heroEyebrow(heroItem)}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.35, marginBottom: '10px' }}>
                  {heroItem.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {heroItem.item_type && (
                    <span style={tagStyle(itemTypeStyle(heroItem.item_type).bg, itemTypeStyle(heroItem.item_type).color)}>
                      {itemTypeLabel(heroItem.item_type)}
                    </span>
                  )}
                  {getCourseName(heroItem.course_id) && (
                    <span style={tagStyle('#f5f4f0', '#888')}>{getCourseName(heroItem.course_id)}</span>
                  )}
                </div>
                {heroClosesLabel(heroItem) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#f59e0b', fontWeight: 500 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#f59e0b" strokeWidth="1.5">
                      <circle cx="6" cy="6" r="5" /><line x1="6" y1="3" x2="6" y2="6" /><line x1="6" y1="6" x2="8.5" y2="7.5" />
                    </svg>
                    {heroClosesLabel(heroItem)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '12px' }}>
                  <span style={{ fontSize: '36px', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-1.5px', lineHeight: 1 }}>
                    {heroHoursLeft(heroItem)}
                  </span>
                  <span style={{ fontSize: '13px', color: '#bbb' }}>hours left</span>
                </div>
              </div>
              {/* CTA — desktop only, inline */}
              {!isMobile && (
                <button
                  onClick={() => navigate('/student/quizzes')}
                  style={{
                    alignSelf: 'center', flexShrink: 0,
                    background: '#fff', border: '1.5px solid #1a1a1a',
                    borderRadius: '10px', padding: '10px 20px',
                    fontSize: '14px', fontWeight: 600, color: '#1a1a1a',
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  Start quiz →
                </button>
              )}
            </div>
            {/* CTA — mobile only, full width */}
            {isMobile && (
              <div style={{ padding: '0 18px 18px' }}>
                <button
                  onClick={() => navigate('/student/quizzes')}
                  style={{
                    width: '100%', background: '#1ecf96',
                    color: '#065f46', fontSize: '13px', fontWeight: 600,
                    padding: '10px 16px', borderRadius: '10px', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#065f46" strokeWidth="2.5">
                    <polygon points="4,2 14,8 4,14" />
                  </svg>
                  Start quiz now
                </button>
              </div>
            )}
            {/* Hint */}
            {heroHintText(heroItem) && (
              <div style={{ padding: '10px 18px', background: '#fafaf8', borderTop: '0.5px solid #f2f0ec' }}>
                <p style={{ fontSize: '11px', color: '#aaa', lineHeight: 1.5 }}>
                  {heroHintText(heroItem)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...card, padding: '14px 18px', background: '#f0fbf6', border: '0.5px solid rgba(29,158,117,0.2)' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F6E56' }}>You're all caught up ✓</div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>No urgent items. Check slides or review your notes.</div>
          </div>
        )}
      </div>

      {/* ── Up Next This Week ── */}
      {upNextItems.length > 0 && (
        <div>
          <div style={sectionLabel}>Up next this week</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {upNextItems.map(q => {
              const { day, month } = upNextDate(q)
              const deadlineStr = upNextDeadlineStr(q)
              return (
                <div
                  key={q.id}
                  onClick={() => navigate('/student/quizzes')}
                  style={{
                    ...card,
                    borderRadius: '13px', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer', minHeight: '64px',
                  }}
                >
                  {/* Date block */}
                  <div style={{ width: '38px', flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '17px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1 }}>{day}</div>
                    <div style={{ fontSize: '9px', color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px' }}>{month}</div>
                  </div>
                  {/* Divider */}
                  <div style={{ width: '0.5px', height: '30px', background: '#ece9e3', flexShrink: 0 }} />
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {q.title}
                    </div>
                    <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {q.item_type && (
                        <span style={tagStyle(itemTypeStyle(q.item_type).bg, itemTypeStyle(q.item_type).color)}>
                          {itemTypeLabel(q.item_type)}
                        </span>
                      )}
                      {getCourseName(q.course_id) && (
                        <span style={tagStyle('#f5f4f0', '#888')}>{getCourseName(q.course_id)}</span>
                      )}
                      {deadlineStr && <span style={{ color: '#bbb' }}>· {deadlineStr}</span>}
                    </div>
                  </div>
                  {/* Arrow */}
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f6f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#bbb" strokeWidth="2">
                      <polyline points="4,2 9,6 4,10" />
                    </svg>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bottom row: Missed | Recent Scores + Announcements ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '2fr 3fr',
        gap: '12px',
        alignItems: 'start',
      }}>

        {/* Left: Missed */}
        <div>
          <div style={sectionLabel}>Missed</div>
          {allMissedItems.length === 0 ? (
            <div style={{ ...card, borderRadius: '13px', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing missed.</div>
              <div style={{ fontSize: '11px', color: '#ccc', marginTop: '3px' }}>Keep it up — all work accounted for.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allMissedItems.slice(0, 3).map(q => (
                <div key={q.id} style={{ background: '#fff5f5', border: '0.5px solid #fecaca', borderRadius: '13px', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#dc2626" strokeWidth="1.5">
                        <circle cx="8" cy="8" r="6" />
                        <line x1="8" y1="5" x2="8" y2="8.5" />
                        <circle cx="8" cy="11" r="0.8" fill="#dc2626" />
                      </svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', marginBottom: '3px' }}>Missed</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{q.title}</div>
                      {q.due_date && (
                        <div style={{ fontSize: '12px', color: '#f87171', marginTop: '2px' }}>
                          Was due {new Date(q.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid #fecaca', lineHeight: 1.5 }}>
                    Reach out to your instructor — they may allow a late submission or makeup quiz.
                  </div>
                </div>
              ))}
              {allMissedItems.length > 3 && (
                <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', padding: '4px' }}>
                  +{allMissedItems.length - 3} more missed
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Recent Scores + Announcements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Recent Scores */}
          <div>
            <div style={sectionLabel}>Recent scores</div>
            <div style={{ ...card, borderRadius: '13px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c5c2bb' }}>Submissions</span>
                <button
                  onClick={() => navigate('/student/grades')}
                  style={{ fontSize: '12px', color: '#1ecf96', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  All grades →
                </button>
              </div>
              {recentSubmissions.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#aaa' }}>No submissions yet.</div>
              ) : recentSubmissions.map((s, i) => {
                const isGraded = s.earnedPoints !== null && s.totalPoints !== null && s.totalPoints > 0
                const pct = isGraded ? (s.earnedPoints! / s.totalPoints!) * 100 : null
                const badgeStyle = !isGraded
                  ? { bg: '#f5f4f0', color: '#888' }
                  : pct !== null && pct < 50
                  ? { bg: '#fef2f2', color: '#dc2626' }
                  : { bg: '#f0fdf4', color: '#16a34a' }
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: i < recentSubmissions.length - 1 ? '0.5px solid #f2f0ec' : 'none',
                      minHeight: '44px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title}
                      </div>
                      {s.courseName && (
                        <div style={{ fontSize: '11px', color: '#bbb', marginTop: '2px' }}>{s.courseName}</div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      padding: '3px 10px', borderRadius: '20px', flexShrink: 0,
                      background: badgeStyle.bg, color: badgeStyle.color,
                    }}>
                      {!isGraded ? 'Pending' : `${s.earnedPoints} / ${s.totalPoints}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Announcements */}
          {recentAnnouncements.length > 0 && (
            <div>
              <div style={sectionLabel}>Announcements</div>
              <div style={{ ...card, borderRadius: '13px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c5c2bb' }}>From your courses</span>
                  <button
                    onClick={() => navigate('/student/announcements')}
                    style={{ fontSize: '12px', color: '#1ecf96', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  >
                    View all →
                  </button>
                </div>
                {recentAnnouncements.map((a, i) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: i < recentAnnouncements.length - 1 ? '0.5px solid #f2f0ec' : 'none',
                    }}
                  >
                    <div style={{ width: '34px', height: '34px', background: '#f5f4f0', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#aaa" strokeWidth="1.5">
                        <path d="M2 3.5h12v7.5H9.5l-3 2V11H2V3.5z" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{a.title}</div>
                      <div style={{
                        fontSize: '12px', color: '#aaa', marginTop: '2px', lineHeight: 1.4,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {a.body}
                      </div>
                      <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
                        {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Running Grade ── */}
      {gradesVisible && hasAnyGrade && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #e9e7e1' }}>
            <div>
              <div style={{ ...sectionLabel, marginBottom: '4px' }}>Running Grade</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginTop: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: scoreBarColor(Math.round(finalGrade)), lineHeight: 1 }}>
                  {finalGrade.toFixed(1)}
                </span>
                <span style={{ fontSize: '14px', color: '#aaa' }}>%</span>
              </div>
              {totalWeight < 100 && (
                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{totalWeight}% of weight graded</div>
              )}
            </div>
            {gwa && (
              <div style={{ textAlign: 'center', background: '#fafaf8', borderRadius: '10px', padding: '8px 14px', border: '0.5px solid #e9e7e1' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: gwaColor(gwa), lineHeight: 1 }}>{gwa}</div>
                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GWA</div>
              </div>
            )}
          </div>
          <div style={{ padding: '4px 0' }}>
            {weightedRows.filter(r => r.rawPct !== null).map(({ group, rawPct }, i) => (
              <div key={group.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '9px 16px',
                borderTop: i > 0 ? '0.5px solid #f2f0ec' : undefined,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{group.name}</span>
                    <span style={{ fontSize: '11px', color: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#ccc', fontWeight: 600 }}>
                      {rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div style={{ height: '4px', background: '#f1efe8', borderRadius: '999px' }}>
                    <div style={{ height: '100%', width: `${rawPct ?? 0}%`, background: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#f1efe8', borderRadius: '999px' }} />
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#bbb', flexShrink: 0 }}>{group.weight_percent}%</span>
              </div>
            ))}
          </div>
          <div
            onClick={() => navigate('/student/grades')}
            style={{ padding: '10px 16px', borderTop: '0.5px solid #e9e7e1', fontSize: '12px', color: '#1ecf96', fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
          >
            View full grade breakdown →
          </div>
        </div>
      )}

    </div>
  )
}
