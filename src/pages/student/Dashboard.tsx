import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSlides } from '../../hooks/useSlides'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useQA } from '../../hooks/useQA'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useGradeBook } from '../../hooks/useGradeBook'
import { MetricCard, PageHeader, Card } from '../../components/ui/Card'
import { scoreBarColor } from '../../utils/scoreColors'
import { Button } from '../../components/ui/Button'

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

  // Due: open, not yet submitted
  const dueItems = visibleQuizzes.filter(q => q.is_open && !submittedQuizIds.has(q.id))

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

  const myQuestions = questions.filter(q => q.posted_by === profile?.id)

  return (
    <div>
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? 'Student'}`}
        subtitle="Here's what's happening in your class."
      />

      {/* Metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', marginBottom: '1.1rem' }}>
        <MetricCard label="Slides available" value={visibleSlides.length} />
        <MetricCard label="Latest score" value={latestScore !== null ? `${latestScore}%` : '—'} valueColor={latestScore !== null ? (latestScore >= 50 ? '#0F6E56' : '#A32D2D') : '#1a1a1a'} />
        <MetricCard label="My questions" value={myQuestions.length} />
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
        {/* Due */}
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#185FA5', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Due ({dueItems.length})
          </div>
          {dueItems.length === 0
            ? <div style={{ fontSize: '12px', color: '#aaa' }}>Nothing due right now.</div>
            : dueItems.map(q => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{q.title}</div>
                    {q.due_date && <div style={{ fontSize: '11px', color: '#aaa' }}>Due {new Date(q.due_date).toLocaleDateString()}</div>}
                  </div>
                  <button
                    onClick={() => navigate('/student/quizzes')}
                    style={{ fontSize: '11px', color: '#185FA5', background: '#E6F1FB', border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    Go →
                  </button>
                </div>
              ))
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
