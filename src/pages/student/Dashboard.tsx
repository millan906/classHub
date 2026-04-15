import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSlides } from '../../hooks/useSlides'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useQA } from '../../hooks/useQA'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useGradeBook } from '../../hooks/useGradeBook'
import { MetricCard, PageHeader } from '../../components/ui/Card'
import { scoreBarColor } from '../../utils/scoreColors'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const { slides } = useSlides()
  const { quizzes, submissions, fetchMySubmissions } = useQuizzes()
  const { questions } = useQA()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const { groups, columns, entries } = useGradeBook()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) fetchMySubmissions(profile.id)
  }, [profile])

  const visibleSlides = slides.filter(s => s.course_id == null || enrolledCourseIds.includes(s.course_id))
  const visibleQuizzes = quizzes.filter(q => q.course_id == null || enrolledCourseIds.includes(q.course_id))
  const mySubmissions = submissions
  const submittedQuizIds = new Set(mySubmissions.map(s => s.quiz_id))
  const latestSub = [...mySubmissions].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
  const latestScore = latestSub?.score ?? null

  const now = new Date()

  function urgencyLabel(due_date?: string): { text: string; color: string } {
    if (!due_date) return { text: 'No deadline', color: '#bbb' }
    const d = new Date(due_date)
    const diffMs = d.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffMs < 0)       return { text: 'Overdue',    color: '#A32D2D' }
    if (diffDays < 1)     return { text: 'Due today',  color: '#C87000' }
    if (diffDays < 7)     return { text: `${Math.ceil(diffDays)}d left`, color: '#185FA5' }
    return { text: d.toLocaleDateString(), color: '#aaa' }
  }

  // Due: open, not yet submitted — sorted by closest deadline
  const dueItems = visibleQuizzes
    .filter(q => q.is_open && !submittedQuizIds.has(q.id))
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  // Missed: closed, no submission
  const missedItems = visibleQuizzes.filter(q => !q.is_open && !submittedQuizIds.has(q.id))

  // Scores from gradebook
  const myEntries = entries.filter(e => e.student_id === profile?.id)
  const scoresByGroup = groups.map(g => {
    const cols = columns.filter(c => c.group_id === g.id)
    const rows = cols.map(col => {
      const entry = myEntries.find(e => e.column_id === col.id)
      return { col, score: entry?.score ?? null }
    }).filter(r => r.score !== null)
    return { group: g, rows }
  }).filter(g => g.rows.length > 0)

  // Weighted grade summary
  const weightedRows = groups.map(g => {
    const cols = columns.filter(c => c.group_id === g.id)
    const graded = cols.filter(c => myEntries.some(e => e.column_id === c.id && e.score !== null))
    const totalEarned = graded.reduce((sum, c) => {
      const entry = myEntries.find(e => e.column_id === c.id)
      return sum + (entry?.score ?? 0)
    }, 0)
    const totalMax = graded.reduce((sum, c) => sum + c.max_score, 0)
    const rawPct = totalMax > 0 ? (totalEarned / totalMax) * 100 : null
    const weighted = rawPct !== null ? (rawPct * g.weight_percent) / 100 : null
    return { group: g, rawPct, weighted, graded: graded.length }
  })
  const hasAnyGrade = weightedRows.some(r => r.weighted !== null)
  const finalGrade = weightedRows.reduce((sum, r) => sum + (r.weighted ?? 0), 0)
  const totalWeight = weightedRows.filter(r => r.weighted !== null).reduce((sum, r) => sum + r.group.weight_percent, 0)

  const myQuestions = questions.filter(q => q.posted_by === profile?.id)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Student'}`}
        subtitle="Here's what's happening in your class."
      />

      {/* Metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '1.1rem' }}>
        <MetricCard label="Slides available" value={visibleSlides.length} />
        <MetricCard label="Latest score" value={latestScore !== null ? `${latestScore}%` : '—'} valueColor={latestScore !== null ? (latestScore >= 50 ? '#0F6E56' : '#A32D2D') : '#1a1a1a'} />
        <MetricCard label="My questions" value={myQuestions.length} />
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
        {/* Due */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#185FA5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Due ({dueItems.length})
          </div>
          {dueItems.length === 0
            ? <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing due right now.</div>
            : dueItems.map(q => {
                const { text, color } = urgencyLabel(q.due_date)
                const typeLabel = q.item_type ? q.item_type.charAt(0).toUpperCase() + q.item_type.slice(1) : 'Quiz'
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title}</div>
                      <div style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
                        <span style={{ color: '#bbb' }}>{typeLabel}</span>
                        <span style={{ color, fontWeight: color === '#A32D2D' || color === '#C87000' ? 600 : 400 }}>{text}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/student/quizzes')}
                      style={{ fontSize: '11px', color: '#185FA5', background: '#E6F1FB', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}
                    >
                      Go →
                    </button>
                  </div>
                )
              })
          }
        </div>

        {/* Missed */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#A32D2D', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Missed ({missedItems.length})
          </div>
          {missedItems.length === 0
            ? <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing missed.</div>
            : missedItems.map(q => (
                <div key={q.id} style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{q.title}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    {q.item_type ? q.item_type.charAt(0).toUpperCase() + q.item_type.slice(1) : 'Quiz'}{q.due_date ? ` · ${new Date(q.due_date).toLocaleDateString()}` : ''}
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      {/* Weighted grade summary */}
      {hasAnyGrade && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Weighted Grade
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Component', 'Weight', 'Score', 'Weighted'].map(h => (
                    <th key={h} style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'left', border: '0.5px solid #ddd', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weightedRows.map(({ group, rawPct, weighted }) => (
                  <tr key={group.id}>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee' }}>{group.name}</td>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee', color: '#888' }}>{group.weight_percent}%</td>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee', color: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#bbb' }}>
                      {rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 600, color: weighted !== null ? scoreBarColor(Math.round((weighted / group.weight_percent) * 100)) : '#bbb' }}>
                      {weighted !== null ? weighted.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 600, background: '#F9F9F7' }}>
                    Final Grade {totalWeight < 100 ? <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 400 }}>({totalWeight}% graded)</span> : ''}
                  </td>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', background: '#F9F9F7' }} />
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 700, fontSize: '13px', background: '#F9F9F7', color: scoreBarColor(Math.round(finalGrade)) }}>
                    {finalGrade.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scores */}
      {scoresByGroup.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            My Scores
          </div>
          {scoresByGroup.map(({ group, rows }) => (
            <div key={group.id} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                {group.name} · {group.weight_percent}%
              </div>
              {rows.map(({ col, score }) => {
                const pct = score !== null ? Math.round((score! / col.max_score) * 100) : null
                const barColor = scoreBarColor(pct)
                return (
                  <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</div>
                      <div style={{ height: '3px', background: '#F1EFE8', borderRadius: '999px', marginTop: '3px' }}>
                        <div style={{ height: '100%', width: (pct ?? 0) + '%', background: barColor, borderRadius: '999px' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: barColor, flexShrink: 0 }}>{pct}%</div>
                    <div style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>{score}/{col.max_score}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
