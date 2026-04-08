import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useIntegrityLogs } from '../../hooks/useIntegrityLogs'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useCourses } from '../../hooks/useCourses'
import { TYPE_ORDER } from '../../constants/itemTypes'
import { scoreBarColor } from '../../utils/scoreColors'
import { PageHeader } from '../../components/ui/Card'
import { Spinner, PageError } from '../../components/ui/Spinner'
import { QuizCard } from '../../components/quizzes/QuizCard'
import { QuizTaker } from '../../components/quizzes/QuizTaker'
import type { Quiz } from '../../types'

export default function StudentQuizzes() {
  const { profile } = useAuth()
  const { quizzes, submissions, loading, error, fetchMySubmissions, submitQuiz, uploadFile } = useQuizzes()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const { logEvent } = useIntegrityLogs()
  const { groups, columns, entries } = useGradeBook()
  const { courses } = useCourses()
  const [takingQuiz, setTakingQuiz] = useState<Quiz | null>(null)
  const [filterCourseId, setFilterCourseId] = useState<string>('all')
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (profile) fetchMySubmissions(profile.id)
  }, [profile])

  const visibleQuizzes = quizzes.filter(q =>
    q.course_id == null || enrolledCourseIds.includes(q.course_id)
  )

  async function handleSubmit(answers: Record<string, string>, earnedPoints: number, totalPoints: number, autoSubmitted = false) {
    if (!profile || !takingQuiz) return
    await submitQuiz(takingQuiz.id, profile.id, answers, earnedPoints, totalPoints, autoSubmitted)
    const hasEssay = (takingQuiz.questions ?? []).some(q => q.type === 'essay')
    if (!hasEssay) setTimeout(() => setTakingQuiz(null), 3000)
  }

  function handleLogEvent(eventType: string, severity: 'low' | 'medium' | 'high') {
    if (!profile || !takingQuiz) return
    logEvent(takingQuiz.id, profile.id, eventType, severity)
  }

  if (loading) return <Spinner />
  if (error) return <PageError message={error} />

  if (takingQuiz) {
    return (
      <QuizTaker
        quiz={takingQuiz}
        onSubmit={handleSubmit}
        onCancel={() => setTakingQuiz(null)}
        onLogEvent={handleLogEvent}
        onFileUpload={profile ? async (file) => { await uploadFile(takingQuiz.id, profile.id, file) } : undefined}
      />
    )
  }

  const manualColumns = columns.filter(c => c.entry_type === 'manual')

  return (
    <div>
      <PageHeader title="Assessments" subtitle="Take quizzes and view your results." />

      {/* Course filter */}
      <div style={{ marginBottom: '1rem' }}>
        <select
          value={filterCourseId}
          onChange={e => setFilterCourseId(e.target.value)}
          style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer' }}
        >
          <option value="all">All Courses</option>
          <option value="none">No Course</option>
          {courses.filter(c => enrolledCourseIds.includes(c.id)).map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · Section ${c.section}` : ''}</option>
          ))}
        </select>
      </div>

      {(() => {
        const filtered = visibleQuizzes.filter(q => {
          if (filterCourseId === 'all') return true
          if (filterCourseId === 'none') return !q.course_id
          return q.course_id === filterCourseId
        })

        const grouped = TYPE_ORDER.map(({ type, label }) => ({
          type, label,
          items: filtered.filter(q => (q.item_type ?? 'quiz') === type),
        })).filter(g => g.items.length > 0)

        if (grouped.length === 0) {
          return <div style={{ fontSize: '13px', color: '#888' }}>No assessments yet.</div>
        }

        return grouped.map(({ type, label, items }) => {
          const isCollapsed = collapsedTypes.has(type)
          const toggle = () => setCollapsedTypes(prev => {
            const next = new Set(prev)
            if (next.has(type)) { next.delete(type) } else { next.add(type) }
            return next
          })
          return (
            <div key={type} style={{ marginBottom: '16px' }}>
              <button
                onClick={toggle}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 0', marginBottom: '8px', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '11px', color: '#888', transition: 'transform 0.15s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>({items.length})</span>
              </button>

              {!isCollapsed && items.map(quiz => {
                const quizSubs = submissions.filter(s => s.quiz_id === quiz.id)
                const attemptsUsed = quizSubs.length
                const maxAttempts = quiz.max_attempts ?? 1
                const bestSub = quizSubs.length > 0
                  ? quizSubs.reduce((best, s) => (s.score > best.score ? s : best))
                  : undefined
                return (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    mySubmission={bestSub}
                    attemptsUsed={attemptsUsed}
                    onTake={attemptsUsed < maxAttempts ? setTakingQuiz : undefined}
                  />
                )
              })}
            </div>
          )
        })
      })()}

      {/* Manual entry scores */}
      {manualColumns.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Manual Scores
          </div>
          {manualColumns.map(col => {
            const group = groups.find(g => g.id === col.group_id)
            const entry = profile ? entries.find(e => e.column_id === col.id && e.student_id === profile.id) : undefined
            const score = entry?.score ?? null
            const pct = score !== null ? Math.round((score / col.max_score) * 100) : null
            const barColor = scoreBarColor(pct)
            return (
              <div key={col.id} style={{
                background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
                borderRadius: '12px', marginBottom: '8px', overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{col.title}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '1px' }}>
                      {group ? group.name : ''} · Max {col.max_score} pts
                    </div>
                    {pct !== null && (
                      <div style={{ height: '3px', background: '#F1EFE8', borderRadius: '999px', marginTop: '5px' }}>
                        <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: '999px' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: score !== null ? '#1a1a1a' : '#aaa', flexShrink: 0 }}>
                    {score !== null ? `${score} / ${col.max_score}` : 'Not graded'}
                  </div>
                </div>
                {col.description && (
                  <div style={{
                    borderTop: '0.5px solid rgba(0,0,0,0.08)',
                    padding: '10px 14px',
                    fontSize: '13px', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                  }}>
                    {col.description}
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
