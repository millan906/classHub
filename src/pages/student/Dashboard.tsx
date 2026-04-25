import { useEffect } from 'react'
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
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) {
      fetchMySubmissions(profile.id)
      fetchMyPdfSubmissions(profile.id)
    }
  }, [profile])

  // ─── Filters ───────────────────────────────────────────────────────────────
  void slides // available for future use
  const visibleQuizzes = quizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id))
  const visiblePdfQuizzes = pdfQuizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id))
  const submittedQuizIds = new Set(submissions.map(s => s.quiz_id))
  const submittedPdfQuizIds = new Set(pdfSubmissions.map(s => s.pdf_quiz_id))

  const now = new Date()

  // ─── Urgency label ─────────────────────────────────────────────────────────
  function urgencyLabel(due_date?: string): { text: string; color: string } {
    if (!due_date) return { text: 'No deadline', color: '#bbb' }
    const d = new Date(due_date)
    const diffMs = d.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    if (diffMs < 0)     return { text: `Due ${dateStr} · Still open`, color: '#C87000' }
    if (diffHours < 1) {
      const mins = Math.ceil(diffMs / (1000 * 60))
      return { text: `Due today · ${mins}m left!`, color: '#A32D2D' }
    }
    if (diffHours < 24) return { text: `Due today at ${timeStr}`, color: '#C87000' }
    if (diffDays < 2)   return { text: `Due tomorrow at ${timeStr}`, color: '#185FA5' }
    if (diffDays < 7) {
      const dayStr = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      return { text: `Due ${dayStr}`, color: '#185FA5' }
    }
    return { text: `Due ${dateStr}`, color: '#aaa' }
  }

  type DueItem = { id: string; title: string; due_date?: string | null; is_open: boolean; item_type?: string }

  const allDueItems: DueItem[] = [
    ...visibleQuizzes.filter(q => q.is_open && !submittedQuizIds.has(q.id)),
    ...visiblePdfQuizzes.filter(q => q.is_open && !submittedPdfQuizIds.has(q.id)).map(q => ({ ...q, item_type: 'paper' })),
  ].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })

  const allMissedItems: DueItem[] = [
    ...visibleQuizzes.filter(q => !q.is_open && !submittedQuizIds.has(q.id)),
    ...visiblePdfQuizzes.filter(q => !q.is_open && !submittedPdfQuizIds.has(q.id)).map(q => ({ ...q, item_type: 'paper' })),
  ]

  // ─── Grade summary ─────────────────────────────────────────────────────────
  const enrolledGroups = enrolledCourseIds.length > 0
    ? groups.filter(g => !g.course_id || enrolledCourseIds.includes(g.course_id))
    : groups
  const enrolledColumns = enrolledCourseIds.length > 0
    ? columns.filter(c => !c.course_id || enrolledCourseIds.includes(c.course_id))
    : columns

  const myEntries = entries.filter(e => e.student_id === profile?.id)
  const weightedRows = enrolledGroups.map(g => {
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
  })
  const hasAnyGrade = weightedRows.some(r => r.weighted !== null)
  const finalGrade = weightedRows.reduce((sum, r) => sum + (r.weighted ?? 0), 0)
  const totalWeight = weightedRows.filter(r => r.weighted !== null).reduce((sum, r) => sum + r.group.weight_percent, 0)
  const gwa = hasAnyGrade ? percentageToGWA(finalGrade) : null

  // ─── Attendance ─────────────────────────────────────────────────────────────
  const absenceCount = attendanceRecords.filter(r => r.status === 'absent').length
  const hasAttendanceWarning = absenceCount >= 3

  // ─── Recent announcements ──────────────────────────────────────────────────
  const recentAnnouncements = announcements
    .filter(a => !a.course_id || enrolledCourseIds.includes(a.course_id))
    .slice(0, 2)

  // ─── Recent scores ─────────────────────────────────────────────────────────
  const recentScores = [...submissions]
    .filter(s => s.score !== null && s.score !== undefined)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .slice(0, 3)
    .map(s => ({ submission: s, quiz: quizzes.find(q => q.id === s.quiz_id) }))
    .filter(r => r.quiz)

  // ─── Needs attention ───────────────────────────────────────────────────────
  const criticalDue = allDueItems.filter(i => {
    if (!i.due_date) return false
    const diffHours = (new Date(i.due_date).getTime() - now.getTime()) / (1000 * 60 * 60)
    return diffHours >= 0 && diffHours < 24
  })

  const attentionItems: { label: string; color: string; bg: string; onClick: () => void }[] = [
    ...(criticalDue.length > 0 ? [{
      label: `${criticalDue.length} due today`,
      color: '#C87000', bg: '#FAEEDA',
      onClick: () => navigate('/student/quizzes'),
    }] : []),
    ...(hasAttendanceWarning ? [{
      label: `${absenceCount} absences`,
      color: '#A32D2D', bg: '#FCEBEB',
      onClick: () => navigate('/student/attendance'),
    }] : []),
    ...(allMissedItems.length > 0 ? [{
      label: `${allMissedItems.length} missed`,
      color: '#555', bg: '#F1EFE8',
      onClick: () => navigate('/student/quizzes'),
    }] : []),
  ]

  const allCaughtUp = attentionItems.length === 0

  // ─── Today label ───────────────────────────────────────────────────────────
  const todayStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: '#fff',
    border: '0.5px solid rgba(0,0,0,0.1)',
    borderRadius: '12px',
    overflow: 'hidden',
  }

  const sectionLabel = (color = '#888'): React.CSSProperties => ({
    fontSize: '11px', fontWeight: 700, color,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Welcome ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a1a' }}>
            Hey, {profile?.full_name?.split(' ')[0] ?? 'Student'} 👋
          </div>
          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{todayStr}</div>
        </div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>
          {enrolledCourseIds.length} course{enrolledCourseIds.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Needs Attention ── */}
      <div style={{
        ...card,
        background: allCaughtUp ? '#F0FBF6' : '#fff',
        border: allCaughtUp ? '0.5px solid rgba(29,158,117,0.2)' : '0.5px solid rgba(0,0,0,0.1)',
        padding: '10px 14px',
      }}>
        {allCaughtUp ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>✓</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F6E56' }}>You're all caught up</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>
                No urgent items. Check slides or review your notes.
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ ...sectionLabel('#A32D2D'), marginBottom: '8px' }}>Needs Attention</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {attentionItems.map(item => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  style={{
                    padding: '5px 12px', fontSize: '12px', fontWeight: 600,
                    borderRadius: '999px', border: 'none',
                    background: item.bg, color: item.color,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Due + Missed ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '10px',
      }}>
        {/* Due */}
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: allDueItems.length > 0 ? '0.5px solid rgba(0,0,0,0.07)' : undefined, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={sectionLabel('#185FA5')}>Due</span>
            {allDueItems.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 600, background: '#E6F1FB', color: '#185FA5', padding: '1px 7px', borderRadius: '999px' }}>
                {allDueItems.length}
              </span>
            )}
          </div>
          <div style={{ padding: allDueItems.length > 0 ? '8px 14px 10px' : '10px 14px' }}>
            {allDueItems.length === 0 ? (
              <div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing due right now.</div>
                <div style={{ fontSize: '11px', color: '#ccc', marginTop: '3px' }}>Good time to review slides or check announcements.</div>
              </div>
            ) : allDueItems.map(q => {
              const { text, color } = urgencyLabel(q.due_date ?? undefined)
              const typeLabel = q.item_type ? q.item_type.charAt(0).toUpperCase() + q.item_type.slice(1) : 'Quiz'
              const isCritical = (() => {
                if (!q.due_date) return false
                const diff = (new Date(q.due_date).getTime() - now.getTime()) / (1000 * 60 * 60)
                return diff >= 0 && diff < 1
              })()
              return (
                <div key={q.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px',
                  padding: isCritical ? '6px 8px' : undefined,
                  background: isCritical ? '#FCEBEB' : undefined,
                  borderRadius: isCritical ? '8px' : undefined,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                    <div style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
                      <span style={{ color: '#bbb' }}>{typeLabel}</span>
                      <span style={{ color, fontWeight: 600 }}>{text}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/student/quizzes')}
                    style={{
                      fontSize: '12px', color: '#185FA5', background: '#E6F1FB',
                      border: 'none', borderRadius: '6px', padding: '6px 12px',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
                    }}
                  >
                    Go →
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Missed */}
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: allMissedItems.length > 0 ? '0.5px solid rgba(0,0,0,0.07)' : undefined, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={sectionLabel('#A32D2D')}>Missed</span>
            {allMissedItems.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 600, background: '#FCEBEB', color: '#A32D2D', padding: '1px 7px', borderRadius: '999px' }}>
                {allMissedItems.length}
              </span>
            )}
          </div>
          <div style={{ padding: allMissedItems.length > 0 ? '8px 14px 10px' : '10px 14px' }}>
            {allMissedItems.length === 0 ? (
              <div>
                <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing missed.</div>
                <div style={{ fontSize: '11px', color: '#ccc', marginTop: '3px' }}>Keep it up — all work accounted for.</div>
              </div>
            ) : allMissedItems.map(q => (
              <div key={q.id} style={{ marginBottom: '7px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{q.title}</div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>
                  {q.item_type ? q.item_type.charAt(0).toUpperCase() + q.item_type.slice(1) : 'Quiz'}
                  {q.due_date ? ` · ${new Date(q.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Announcements ── */}
      {recentAnnouncements.length > 0 && (
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={sectionLabel('Announcements')}>Announcements</span>
            <button
              onClick={() => navigate('/student/announcements')}
              style={{ fontSize: '11px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              View all →
            </button>
          </div>
          <div style={{ padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentAnnouncements.map(a => (
              <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{a.title}</div>
                <div style={{
                  fontSize: '12px', color: '#888',
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {a.body}
                </div>
                <div style={{ fontSize: '11px', color: '#ccc', marginTop: '1px' }}>
                  {new Date(a.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Running Grade ── */}
      {gradesVisible && hasAnyGrade && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
            <div>
              <div style={sectionLabel('Running Grade')}>Running Grade</div>
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
              <div style={{ textAlign: 'center', background: '#FAFAF8', borderRadius: '10px', padding: '8px 14px', border: '0.5px solid rgba(0,0,0,0.07)' }}>
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
                borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.05)' : undefined,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{group.name}</span>
                    <span style={{ fontSize: '11px', color: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#ccc', fontWeight: 600 }}>
                      {rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                    <div style={{ height: '100%', width: `${rawPct ?? 0}%`, background: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#F1EFE8', borderRadius: '999px' }} />
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#bbb', flexShrink: 0 }}>{group.weight_percent}%</span>
              </div>
            ))}
          </div>
          <div
            onClick={() => navigate('/student/grades')}
            style={{ padding: '10px 16px', borderTop: '0.5px solid rgba(0,0,0,0.07)', fontSize: '12px', color: '#1D9E75', fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
          >
            View full grade breakdown →
          </div>
        </div>
      )}

      {/* ── Recent Scores ── */}
      {recentScores.length > 0 && (
        <div style={card}>
          <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={sectionLabel('Recent Scores')}>Recent Scores</span>
            <button
              onClick={() => navigate('/student/grades')}
              style={{ fontSize: '11px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              Full grades →
            </button>
          </div>
          <div style={{ padding: '4px 0' }}>
            {recentScores.map(({ submission, quiz }, i) => {
              const pct = submission.total_points && submission.total_points > 0
                ? (submission.score / submission.total_points) * 100
                : submission.score
              return (
                <div key={submission.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '9px 16px',
                  borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.05)' : undefined,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                        {quiz!.title}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: scoreBarColor(Math.round(pct)), flexShrink: 0 }}>
                        {submission.score}/{submission.total_points ?? submission.score}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: scoreBarColor(Math.round(pct)), borderRadius: '999px' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
