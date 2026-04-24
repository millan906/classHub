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
import { PageHeader } from '../../components/ui/Card'
import { scoreBarColor } from '../../utils/scoreColors'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const { slides } = useSlides()
  const { quizzes, submissions, fetchMySubmissions } = useQuizzes()
  const { pdfQuizzes, submissions: pdfSubmissions, fetchMySubmissions: fetchMyPdfSubmissions } = usePdfQuizzes()
  const { questions } = useQA()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const { groups, columns, entries } = useGradeBook()
  const { gradesVisible } = useGradesVisible(profile?.id ?? null)
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) {
      fetchMySubmissions(profile.id)
      fetchMyPdfSubmissions(profile.id)
    }
  }, [profile])

  const visibleSlides = slides.filter(s => s.course_id == null || enrolledCourseIds.includes(s.course_id))
  const visibleQuizzes = quizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id))
  const visiblePdfQuizzes = pdfQuizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id))
  const submittedQuizIds = new Set(submissions.map(s => s.quiz_id))
  const submittedPdfQuizIds = new Set(pdfSubmissions.map(s => s.pdf_quiz_id))

  const now = new Date()

  function urgencyLabel(due_date?: string): { text: string; color: string } {
    if (!due_date) return { text: 'No deadline', color: '#bbb' }
    const d = new Date(due_date)
    const diffMs = d.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    // Past deadline but still open
    if (diffMs < 0)     return { text: `Due ${dateStr} · Still open`, color: '#C87000' }
    // Closes within the hour
    if (diffHours < 1) {
      const mins = Math.ceil(diffMs / (1000 * 60))
      return { text: `Due today · ${mins}m left!`, color: '#A32D2D' }
    }
    // Closes today — show the time
    if (diffHours < 24) return { text: `Due today at ${timeStr}`, color: '#C87000' }
    // Closes tomorrow
    if (diffDays < 2)   return { text: `Due tomorrow at ${timeStr}`, color: '#185FA5' }
    // Closes within 7 days — show day name + date
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

  // Grade summary — scoped to enrolled courses only
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

  const myQuestions = questions.filter(q => q.posted_by === profile?.id)
  const completedQuizzes = submissions.length

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] ?? 'Student'}`}
        subtitle="Here's what's happening in your class."
      />

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: 'Slides', value: visibleSlides.length },
          { label: 'Submitted', value: completedQuizzes },
          { label: 'Pending', value: allDueItems.length, highlight: allDueItems.length > 0 },
          { label: 'My Questions', value: myQuestions.length },
        ].map(({ label, value, highlight }) => (
          <div key={label} style={{
            background: highlight ? '#FAEEDA' : '#F7F6F2',
            borderRadius: '10px', padding: '10px 12px',
            border: highlight ? '0.5px solid rgba(200,112,0,0.2)' : '0.5px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '22px', fontWeight: 600, color: highlight ? '#C87000' : '#1a1a1a' }}>{value}</div>
            <div style={{ fontSize: '11px', color: highlight ? '#C87000' : '#888', marginTop: '1px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Due + Missed */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {/* Due */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: allDueItems.length > 0 ? '0.5px solid rgba(0,0,0,0.07)' : undefined, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#185FA5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due</span>
            {allDueItems.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 600, background: '#E6F1FB', color: '#185FA5', padding: '1px 7px', borderRadius: '999px' }}>
                {allDueItems.length}
              </span>
            )}
          </div>
          <div style={{ padding: allDueItems.length > 0 ? '8px 14px 10px' : '10px 14px' }}>
            {allDueItems.length === 0
              ? <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing due right now.</div>
              : allDueItems.map(q => {
                  const { text, color } = urgencyLabel(q.due_date ?? undefined)
                  const typeLabel = q.item_type ? q.item_type.charAt(0).toUpperCase() + q.item_type.slice(1) : 'Quiz'
                  return (
                    <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                        <div style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
                          <span style={{ color: '#bbb' }}>{typeLabel}</span>
                          <span style={{ color, fontWeight: 600 }}>{text}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/student/quizzes')}
                        style={{ fontSize: '12px', color: '#185FA5', background: '#E6F1FB', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}
                      >
                        Go →
                      </button>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* Missed */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: allMissedItems.length > 0 ? '0.5px solid rgba(0,0,0,0.07)' : undefined, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Missed</span>
            {allMissedItems.length > 0 && (
              <span style={{ fontSize: '10px', fontWeight: 600, background: '#FCEBEB', color: '#A32D2D', padding: '1px 7px', borderRadius: '999px' }}>
                {allMissedItems.length}
              </span>
            )}
          </div>
          <div style={{ padding: allMissedItems.length > 0 ? '8px 14px 10px' : '10px 14px' }}>
            {allMissedItems.length === 0
              ? <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing missed.</div>
              : allMissedItems.map(q => (
                  <div key={q.id} style={{ marginBottom: '7px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{q.title}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>
                      {q.item_type ? q.item_type.charAt(0).toUpperCase() + q.item_type.slice(1) : 'Quiz'}
                      {q.due_date ? ` · ${new Date(q.due_date).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* Running grade summary */}
      {gradesVisible && hasAnyGrade && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
          {/* Header with grade hero */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Running Grade</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
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

          {/* Component bars */}
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
    </div>
  )
}
