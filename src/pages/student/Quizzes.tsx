import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useIntegrityLogs } from '../../hooks/useIntegrityLogs'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useCourses } from '../../hooks/useCourses'
import { usePdfQuizzes } from '../../hooks/usePdfQuizzes'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TYPE_ORDER } from '../../constants/itemTypes'
import { scoreBarColor } from '../../utils/scoreColors'
import { PageHeader } from '../../components/ui/Card'
import { Spinner, PageError } from '../../components/ui/Spinner'
import { QuizCard } from '../../components/quizzes/QuizCard'
import { QuizTaker } from '../../components/quizzes/QuizTaker'
import { PdfQuizCard } from '../../components/pdfquizzes/PdfQuizCard'
import { PdfQuizTaker } from '../../components/pdfquizzes/PdfQuizTaker'
import type { Quiz, PdfQuiz } from '../../types'

export default function StudentQuizzes() {
  const { profile } = useAuth()
  const { quizzes, submissions, loading, error, fetchMySubmissions, submitQuiz, uploadFile, fetchMyFileSubmission } = useQuizzes()
  const { pdfQuizzes, submissions: pdfSubmissions, fetchMySubmissions: fetchMyPdfSubmissions, submitPdfQuiz, getPdfUrl } = usePdfQuizzes()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const { logEvent } = useIntegrityLogs()
  const { groups, columns, entries } = useGradeBook()
  const { courses } = useCourses()
  const isMobile = useIsMobile()
  const [takingQuiz, setTakingQuiz] = useState<Quiz | null>(null)
  const [existingFile, setExistingFile] = useState<{ file_name: string; file_url: string } | null>(null)
  const [takingPdfQuiz, setTakingPdfQuiz] = useState<PdfQuiz | null>(null)
  const [filterCourseId, setFilterCourseId] = useState<string>('all')
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set())
  const [closedCollapsed, setClosedCollapsed] = useState(true)

  useEffect(() => {
    if (profile) {
      fetchMySubmissions(profile.id)
      fetchMyPdfSubmissions(profile.id)
    }
  }, [profile])

  const visibleQuizzes = quizzes.filter(q =>
    q.course_id == null || enrolledCourseIds.includes(q.course_id)
  )

  async function handleSubmit(answers: Record<string, string>, earnedPoints: number, totalPoints: number, autoSubmitted = false, keystrokeCount = 0, startedAt?: string, answerTimestamps?: Record<string, string>) {
    if (!profile || !takingQuiz) return
    await submitQuiz(takingQuiz.id, profile.id, answers, earnedPoints, totalPoints, autoSubmitted, keystrokeCount, startedAt, answerTimestamps)
    const hasEssay = (takingQuiz.questions ?? []).some(q => q.type === 'essay')
    if (!hasEssay) setTimeout(() => setTakingQuiz(null), 3000)
  }

  function handleLogEvent(eventType: string, severity: 'low' | 'medium' | 'high') {
    if (!profile || !takingQuiz) return
    logEvent(takingQuiz.id, profile.id, eventType, severity)
  }

  if (loading) return <Spinner />
  if (error) return <PageError message={error} />

  if (takingPdfQuiz) {
    return (
      <PdfQuizTaker
        quiz={takingPdfQuiz}
        pdfUrl={getPdfUrl(takingPdfQuiz.pdf_path)}
        onSubmit={async (answers) => {
          if (!profile) return { earned: 0, total: 0, score: 0 }
          return await submitPdfQuiz(takingPdfQuiz.id, profile.id, answers)
        }}
        onClose={() => setTakingPdfQuiz(null)}
      />
    )
  }

  if (takingQuiz) {
    return (
      <QuizTaker
        quiz={takingQuiz}
        onSubmit={handleSubmit}
        onCancel={() => { setTakingQuiz(null); setExistingFile(null) }}
        onLogEvent={handleLogEvent}
        onFileUpload={profile ? async (file) => { await uploadFile(takingQuiz.id, profile.id, file) } : undefined}
        existingFile={existingFile ?? undefined}
      />
    )
  }

  const manualColumns = columns.filter(c => c.entry_type === 'manual' && (!c.course_id || enrolledCourseIds.includes(c.course_id)))

  return (
    <div>
      <PageHeader title="Assessments" subtitle="View and submit your assessments." />

      {/* Course filter */}
      <div style={{ marginBottom: '1rem' }}>
        <select
          value={filterCourseId}
          onChange={e => setFilterCourseId(e.target.value)}
          style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontFamily: 'Inter, sans-serif', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? undefined : '200px' }}
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

        if (filtered.length === 0) {
          return <div style={{ fontSize: '13px', color: '#888' }}>No assessments yet.</div>
        }

        const openItems = filtered.filter(q => q.is_open)
        const closedItems = filtered.filter(q => !q.is_open)

        function renderTypeGroups(items: typeof filtered, keyPrefix: string) {
          const grouped = TYPE_ORDER.map(({ type, label }) => ({
            type, label,
            items: items.filter(q => (q.item_type ?? 'quiz') === type),
          })).filter(g => g.items.length > 0)

          return grouped.map(({ type, label, items: typeItems }) => {
            const colKey = `${keyPrefix}-${type}`
            const isCollapsed = collapsedTypes.has(colKey)
            const toggle = () => setCollapsedTypes(prev => {
              const next = new Set(prev)
              if (next.has(colKey)) { next.delete(colKey) } else { next.add(colKey) }
              return next
            })
            return (
              <div key={colKey} style={{ marginBottom: '12px' }}>
                <button
                  onClick={toggle}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: '6px', width: '100%', textAlign: 'left' }}
                >
                  <span style={{ fontSize: '11px', color: '#aaa', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                  <span style={{ fontSize: '11px', color: '#bbb' }}>({typeItems.length})</span>
                </button>
                {!isCollapsed && typeItems.map(quiz => {
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
                      mySubmissions={quizSubs}
                      attemptsUsed={attemptsUsed}
                      onTake={attemptsUsed < maxAttempts ? async (q) => {
                        if (profile && q.allow_file_upload) {
                          const f = await fetchMyFileSubmission(q.id, profile.id)
                          setExistingFile(f)
                        } else {
                          setExistingFile(null)
                        }
                        setTakingQuiz(q)
                      } : undefined}
                    />
                  )
                })}
              </div>
            )
          })
        }

        return (
          <>
            {/* Open */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1D9E75', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1D9E75' }}>Open</span>
                <span style={{ fontSize: '12px', fontWeight: 600, background: '#E6F7F1', color: '#1D9E75', padding: '1px 8px', borderRadius: '999px' }}>{openItems.length}</span>
              </div>
              {openItems.length === 0
                ? <div style={{ fontSize: '13px', color: '#aaa', padding: '12px 0' }}>No open assessments right now.</div>
                : renderTypeGroups(openItems, 'open')
              }
            </div>

            {/* Closed — pill toggle button */}
            {closedItems.length > 0 && (
              <div>
                <button
                  onClick={() => setClosedCollapsed(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: closedCollapsed ? '#F4F3EF' : '#ECEAE4',
                    border: '0.5px solid rgba(0,0,0,0.1)',
                    borderRadius: '999px',
                    padding: '6px 14px 6px 10px',
                    cursor: 'pointer',
                    marginBottom: closedCollapsed ? '0' : '12px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#aaa', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#666' }}>Closed</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, background: '#fff', color: '#888', padding: '1px 7px', borderRadius: '999px', border: '0.5px solid rgba(0,0,0,0.1)' }}>{closedItems.length}</span>
                  <span style={{ fontSize: '10px', color: '#aaa', display: 'inline-block', transform: closedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', marginLeft: '2px' }}>▼</span>
                </button>
                {!closedCollapsed && (
                  <div style={{ marginTop: '12px' }}>
                    {renderTypeGroups(closedItems, 'closed')}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })()}

      {/* PDF Quizzes — folded into Open/Closed */}
      {(() => {
        const visiblePdf = pdfQuizzes.filter(q =>
          q.course_id == null || enrolledCourseIds.includes(q.course_id)
        ).filter(q => {
          if (filterCourseId === 'all') return true
          if (filterCourseId === 'none') return !q.course_id
          return q.course_id === filterCourseId
        })
        if (visiblePdf.length === 0) return null
        const openPdf = visiblePdf.filter(q => q.is_open)
        const closedPdf = visiblePdf.filter(q => !q.is_open)
        function renderPdfCards(items: typeof visiblePdf) {
          return items.map(quiz => {
            const subs = pdfSubmissions.filter(s => s.pdf_quiz_id === quiz.id)
            const best = subs.length > 0 ? subs.reduce((b, s) => s.earned_points > b.earned_points ? s : b) : undefined
            const attemptsUsed = subs.length
            return (
              <PdfQuizCard
                key={quiz.id}
                quiz={quiz}
                mySubmission={best}
                attemptsUsed={attemptsUsed}
                onTake={quiz.is_open && attemptsUsed < quiz.max_attempts ? setTakingPdfQuiz : undefined}
              />
            )
          })
        }
        return (
          <>
            {openPdf.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Paper Assessments</div>
                {renderPdfCards(openPdf)}
              </div>
            )}
            {closedPdf.length > 0 && !closedCollapsed && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Paper Assessments</div>
                {renderPdfCards(closedPdf)}
              </div>
            )}
          </>
        )
      })()}

      {/* Manual entry scores */}
      {manualColumns.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Assessment Results
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
                    {score !== null ? `${score} / ${col.max_score}` : 'Awaiting grade'}
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
