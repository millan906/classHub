import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useIntegrityLogs } from '../../hooks/useIntegrityLogs'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useCourses } from '../../hooks/useCourses'
import { usePdfQuizzes } from '../../hooks/usePdfQuizzes'
import { useIsMobile } from '../../hooks/useIsMobile'
import { scoreBarColor } from '../../utils/scoreColors'
import { Spinner, PageError } from '../../components/ui/Spinner'
import { QuizTaker } from '../../components/quizzes/QuizTaker'
import { PdfQuizTaker } from '../../components/pdfquizzes/PdfQuizTaker'
import type { Quiz, PdfQuiz, QuizSubmission, PdfQuizSubmission, FileSubmission } from '../../types'

export default function StudentQuizzes() {
  const navigate = useNavigate()
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'submitted' | 'graded' | 'missed'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [fileSubMap, setFileSubMap] = useState<Record<string, FileSubmission | null>>({})

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


  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  // Unified assessment item type
  type AssessmentStatus = 'open' | 'submitted' | 'graded' | 'missed'

  type AssessmentItem = {
    id: string
    title: string
    itemType: string
    courseId: string | null
    courseName: string | null
    courseSection: string | null
    dueDate: string | null
    closeAt: string | null
    isOpen: boolean
    maxAttempts: number
    isFileSub: boolean
    isPdf: boolean
    // quiz
    quizRef?: Quiz
    quizSubs: QuizSubmission[]
    attemptsUsed: number
    bestSub?: QuizSubmission
    resultsVisible: boolean
    // pdf
    pdfRef?: PdfQuiz
    pdfSubs: PdfQuizSubmission[]
    totalPoints: number | null
  }

  function getCourseName(courseId: string | null): string | null {
    if (!courseId) return null
    return courses.find(c => c.id === courseId)?.name ?? null
  }

  function getCourseSection(courseId: string | null): string | null {
    if (!courseId) return null
    return courses.find(c => c.id === courseId)?.section ?? null
  }

  const visiblePdfQuizzes = pdfQuizzes.filter(q =>
    q.course_id == null || enrolledCourseIds.includes(q.course_id)
  )

  const allItems: AssessmentItem[] = [
    ...visibleQuizzes.map(q => {
      const subs = submissions.filter(s => s.quiz_id === q.id)
      const best = subs.length > 0 ? subs.reduce((b, s) => s.score > b.score ? s : b) : undefined
      return {
        id: q.id,
        title: q.title,
        itemType: q.item_type ?? 'quiz',
        courseId: q.course_id ?? null,
        courseName: getCourseName(q.course_id ?? null),
        courseSection: getCourseSection(q.course_id ?? null),
        dueDate: q.due_date ?? null,
        closeAt: q.close_at ?? null,
        isOpen: q.is_open,
        maxAttempts: q.max_attempts ?? 1,
        isFileSub: !!(q.allow_file_upload && (q.questions?.length ?? 0) === 0),
        isPdf: false,
        quizRef: q,
        quizSubs: subs,
        attemptsUsed: subs.length,
        bestSub: best,
        resultsVisible: q.results_visible ?? false,
        pdfSubs: [],
        totalPoints: best?.total_points ?? null,
      }
    }),
    ...visiblePdfQuizzes.map(q => {
      const subs = pdfSubmissions.filter(s => s.pdf_quiz_id === q.id)
      return {
        id: q.id,
        title: q.title,
        itemType: 'paper',
        courseId: q.course_id ?? null,
        courseName: getCourseName(q.course_id ?? null),
        courseSection: getCourseSection(q.course_id ?? null),
        dueDate: q.due_date ?? null,
        closeAt: q.close_at ?? null,
        isOpen: q.is_open,
        maxAttempts: q.max_attempts ?? 1,
        isFileSub: false,
        isPdf: true,
        pdfRef: q,
        quizSubs: [],
        attemptsUsed: subs.length,
        bestSub: undefined,
        resultsVisible: q.results_visible ?? false,
        pdfSubs: subs,
        totalPoints: q.total_points ?? null,
      }
    }),
  ]

  function getStatus(item: AssessmentItem): AssessmentStatus {
    const hasSubmission = item.isPdf ? item.pdfSubs.length > 0 : item.quizSubs.length > 0
    if (!hasSubmission && !item.isOpen) return 'missed'
    if (item.isOpen && item.attemptsUsed < item.maxAttempts) return 'open'
    if (!hasSubmission) return 'missed'
    if (item.resultsVisible && (item.isPdf ? item.pdfSubs[0]?.earned_points != null : item.bestSub?.earned_points != null)) return 'graded'
    return 'submitted'
  }

  // Apply course filter
  const courseFiltered = allItems.filter(item => {
    if (filterCourseId === 'all') return true
    if (filterCourseId === 'none') return !item.courseId
    return item.courseId === filterCourseId
  })

  const openItems = courseFiltered.filter(i => getStatus(i) === 'open')
  const submittedItems = courseFiltered.filter(i => getStatus(i) === 'submitted')
  const gradedItems = courseFiltered.filter(i => getStatus(i) === 'graded')
  const missedItems = courseFiltered.filter(i => getStatus(i) === 'missed')

  // Apply status filter for display
  const displayItems = activeFilter === 'all' ? courseFiltered
    : activeFilter === 'open' ? openItems
    : activeFilter === 'submitted' ? submittedItems
    : activeFilter === 'graded' ? gradedItems
    : missedItems

  // Sort display items by deadline
  const sortedDisplay = [...displayItems].sort((a, b) => {
    const aD = a.closeAt || a.dueDate
    const bD = b.closeAt || b.dueDate
    if (!aD && !bD) return 0
    if (!aD) return 1
    if (!bD) return -1
    return new Date(aD).getTime() - new Date(bD).getTime()
  })

  // Helpers
  function itemTypeStyle(type: string): { bg: string; color: string } {
    switch (type.toLowerCase()) {
      case 'lab':        return { bg: '#f0fdf4', color: '#16a34a' }
      case 'exam':       return { bg: '#fef2f2', color: '#dc2626' }
      case 'assignment': return { bg: '#faf5ff', color: '#7c3aed' }
      case 'project':    return { bg: '#fff7ed', color: '#c2410c' }
      case 'activity':   return { bg: '#fefce8', color: '#a16207' }
      case 'paper':      return { bg: '#f5f4f0', color: '#888' }
      default:           return { bg: '#eff6ff', color: '#2563eb' }
    }
  }

  function itemTypeLabel(type: string): string {
    if (type === 'paper') return 'Paper'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const statusBadgeStyle: Record<AssessmentStatus, { bg: string; color: string; label: string }> = {
    open:      { bg: '#f0fdf4', color: '#16a34a', label: 'Open' },
    submitted: { bg: '#f5f4f0', color: '#888',    label: 'Submitted' },
    graded:    { bg: '#eff6ff', color: '#2563eb', label: 'Graded' },
    missed:    { bg: '#fef2f2', color: '#dc2626', label: 'Missed' },
  }

  function deadlineLabel(item: AssessmentItem): string | null {
    const d = item.closeAt || item.dueDate
    if (!d) return null
    return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function deadlineTimeLabel(item: AssessmentItem): string | null {
    const d = item.closeAt || item.dueDate
    if (!d) return null
    const date = new Date(d)
    const dateStr = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${dateStr} · ${timeStr}`
  }

  function renderAttemptDots(used: number, max: number) {
    if (max <= 1) return null
    return (
      <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', marginLeft: '6px' }}>
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: i < used ? '#1ecf96' : '#e5e5e5', display: 'inline-block' }} />
        ))}
        <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '2px' }}>{used} of {max} attempts used</span>
      </span>
    )
  }

  function renderCard(item: AssessmentItem) {
    const status = getStatus(item)
    const typeStyle = itemTypeStyle(item.itemType)
    const statusStyle = statusBadgeStyle[status]
    const isExpanded = expandedId === item.id
    const courseLabel = [item.courseName, item.courseSection].filter(Boolean).join(' · ')

    // Score for graded items
    const earnedPoints = item.isPdf
      ? (item.pdfSubs[0]?.earned_points ?? null)
      : (item.bestSub?.earned_points ?? null)
    const totalPts = item.totalPoints
    const scorePct = earnedPoints != null && totalPts && totalPts > 0
      ? Math.round((earnedPoints / totalPts) * 100) : null

    // Submission date
    const submittedAt = item.isPdf
      ? (item.pdfSubs[0]?.submitted_at ?? null)
      : (item.bestSub?.submitted_at ?? null)

    return (
      <div
        key={item.id}
        style={{
          background: '#fff',
          border: status === 'missed' ? '0.5px solid #fecaca' : '0.5px solid #e9e7e1',
          borderLeft: status === 'missed' ? '3px solid #ef4444' : '0.5px solid #e9e7e1',
          borderRadius: '13px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div style={{ padding: '14px 16px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>{item.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: typeStyle.bg, color: typeStyle.color }}>
                  {itemTypeLabel(item.itemType)}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: statusStyle.bg, color: statusStyle.color }}>
                  {statusStyle.label}
                </span>
                {courseLabel && (
                  <span style={{ fontSize: '11px', color: '#aaa' }}>{courseLabel}</span>
                )}
              </div>
            </div>
            {/* Graded score - top right */}
            {status === 'graded' && earnedPoints != null && totalPts && (
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>
                  <span style={{ color: scorePct != null && scorePct < 50 ? '#ef4444' : '#1a1a1a' }}>{earnedPoints}</span>
                  <span style={{ color: '#aaa', fontWeight: 400, fontSize: '13px' }}> / {totalPts}</span>
                </div>
                <div style={{ height: '3px', background: '#f0eeea', borderRadius: '999px', marginTop: '5px', width: '60px' }}>
                  <div style={{ height: '100%', width: `${Math.min(scorePct ?? 0, 100)}%`, background: scorePct != null && scorePct >= 75 ? '#1ecf96' : scorePct != null && scorePct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: '999px' }} />
                </div>
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
              {/* Open state */}
              {status === 'open' && (
                <>
                  {deadlineTimeLabel(item) && (
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      Due <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{deadlineTimeLabel(item)}</span>
                    </span>
                  )}
                  {item.maxAttempts > 1 && renderAttemptDots(item.attemptsUsed, item.maxAttempts)}
                  {item.isFileSub && <span style={{ fontSize: '11px', color: '#bbb', marginLeft: '4px' }}>File submission</span>}
                </>
              )}
              {/* Submitted state */}
              {status === 'submitted' && (
                <>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    Submitted {submittedAt ? new Date(submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                  </span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>Awaiting grade</span>
                </>
              )}
              {/* Graded state */}
              {status === 'graded' && (
                <span style={{ fontSize: '12px', color: '#888' }}>
                  Graded {submittedAt ? new Date(submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                </span>
              )}
              {/* Missed state */}
              {status === 'missed' && (
                <>
                  <span style={{ fontSize: '12px', color: '#888' }}>
                    Was due <span style={{ color: '#ef4444', fontWeight: 600 }}>
                      {deadlineLabel(item) ?? 'Unknown date'}
                    </span>
                  </span>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>Contact your instructor for a makeup</span>
                </>
              )}
            </div>

            {/* CTA */}
            <div style={{ flexShrink: 0 }}>
              {status === 'open' && !item.isPdf && item.quizRef && (
                <button
                  onClick={() => {
                    if (item.quizRef) {
                      if (item.quizRef.allow_file_upload) {
                        fetchMyFileSubmission(item.quizRef.id, profile?.id ?? '').then(f => setExistingFile(f))
                      } else {
                        setExistingFile(null)
                      }
                      setTakingQuiz(item.quizRef)
                    }
                  }}
                  style={{ fontSize: '12px', fontWeight: 500, color: '#1ecf96', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  {item.attemptsUsed === 0
                    ? (item.isFileSub ? 'Submit →' : item.itemType === 'exam' ? 'Start exam →' : 'Start quiz →')
                    : (item.isFileSub ? 'Resubmit →' : 'Retake →')}
                </button>
              )}
              {status === 'open' && item.isPdf && item.pdfRef && (
                <button
                  onClick={() => setTakingPdfQuiz(item.pdfRef!)}
                  style={{ fontSize: '12px', fontWeight: 500, color: '#1ecf96', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  {item.attemptsUsed === 0 ? 'Start →' : 'Retake →'}
                </button>
              )}
              {status === 'submitted' && (
                <button
                  onClick={() => {
                    const next = isExpanded ? null : item.id
                    setExpandedId(next)
                    if (next && !item.isPdf && item.quizRef?.allow_file_upload && !(item.id in fileSubMap) && profile) {
                      fetchMyFileSubmission(item.id, profile.id).then(f => setFileSubMap(prev => ({ ...prev, [item.id]: f })))
                    }
                  }}
                  style={{ fontSize: '12px', fontWeight: 500, color: '#1ecf96', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  {isExpanded ? 'Hide ↑' : 'View submission →'}
                </button>
              )}
              {status === 'graded' && (
                <button
                  onClick={() => {
                    const next = isExpanded ? null : item.id
                    setExpandedId(next)
                    if (next && !item.isPdf && item.quizRef?.allow_file_upload && !(item.id in fileSubMap) && profile) {
                      fetchMyFileSubmission(item.id, profile.id).then(f => setFileSubMap(prev => ({ ...prev, [item.id]: f })))
                    }
                  }}
                  style={{ fontSize: '12px', fontWeight: 500, color: '#1ecf96', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  {isExpanded ? 'Hide ↑' : 'View feedback →'}
                </button>
              )}
              {status === 'missed' && (
                <button
                  onClick={() => navigate('/student/qa')}
                  style={{ fontSize: '12px', fontWeight: 500, color: '#1ecf96', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                >
                  Message instructor →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expanded: attempt history */}
        {isExpanded && !item.isPdf && item.quizSubs.length > 0 && (
          <div style={{ borderTop: '0.5px solid #f2f0ec', padding: '10px 16px', background: '#fafaf8' }}>
            {item.isFileSub ? (
              // File submission — show file link + score
              (() => {
                const fs = fileSubMap[item.id]
                const sub = item.quizSubs[0]
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '12px' }}>
                    <div>
                      {fs ? (
                        <a href={fs.file_url} target="_blank" rel="noreferrer"
                          style={{ color: '#185FA5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📎 {fs.file_name}
                        </a>
                      ) : (
                        <span style={{ color: '#aaa' }}>
                          {item.id in fileSubMap ? 'No file found' : 'Loading…'}
                        </span>
                      )}
                      {fs && <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                        Submitted {new Date(fs.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>}
                    </div>
                    <span style={{ fontWeight: 600 }}>
                      {item.resultsVisible && sub?.earned_points != null && sub?.total_points != null
                        ? `${sub.earned_points} / ${sub.total_points}`
                        : <span style={{ color: '#aaa', fontWeight: 400 }}>Pending</span>}
                    </span>
                  </div>
                )
              })()
            ) : (
              // Regular quiz — show attempt history
              [...item.quizSubs]
                .sort((a, b) => (a.attempt_number ?? 0) - (b.attempt_number ?? 0))
                .map(sub => (
                  <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #f2f0ec', fontSize: '12px' }}>
                    <span style={{ color: '#555' }}>
                      Attempt {sub.attempt_number ?? '—'} ·{' '}
                      <span style={{ color: '#aaa' }}>{new Date(sub.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </span>
                    <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                      {item.resultsVisible && sub.earned_points != null && sub.total_points != null
                        ? `${sub.earned_points} / ${sub.total_points}`
                        : <span style={{ color: '#aaa', fontWeight: 400 }}>Pending</span>}
                    </span>
                  </div>
                ))
            )}
          </div>
        )}
        {isExpanded && item.isPdf && item.pdfSubs.length > 0 && (
          <div style={{ borderTop: '0.5px solid #f2f0ec', padding: '10px 16px', background: '#fafaf8' }}>
            {item.pdfSubs.map((sub, i) => (
              <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < item.pdfSubs.length - 1 ? '0.5px solid #f2f0ec' : 'none', fontSize: '12px' }}>
                <span style={{ color: '#555' }}>
                  Attempt {sub.attempt_number} ·{' '}
                  <span style={{ color: '#aaa' }}>{new Date(sub.submitted_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </span>
                <span style={{ fontWeight: 600, color: '#1a1a1a' }}>
                  {item.resultsVisible ? `${sub.earned_points} / ${item.totalPoints}` : <span style={{ color: '#aaa', fontWeight: 400 }}>Pending</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Section rendering
  function renderSection(label: string, items: AssessmentItem[]) {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#c5c2bb', marginBottom: '10px' }}>
          {label} · {items.length}
        </div>
        {items.map(renderCard)}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#c5c2bb', marginBottom: '3px' }}>Assessments</div>
        <div style={{ fontSize: '13px', color: '#aaa' }}>All submissions, scores, and feedback</div>
      </div>

      {/* Course filter */}
      <div style={{ marginBottom: '14px' }}>
        <select
          value={filterCourseId}
          onChange={e => setFilterCourseId(e.target.value)}
          style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid #e9e7e1', background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontFamily: 'inherit', width: isMobile ? '100%' : 'auto', minWidth: isMobile ? undefined : '200px' }}
        >
          <option value="all">All courses</option>
          <option value="none">No Course</option>
          {enrolledCourses.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {([
          { key: 'all', label: 'All', count: courseFiltered.length },
          { key: 'open', label: 'Open', count: openItems.length },
          { key: 'submitted', label: 'Submitted', count: submittedItems.length },
          { key: 'graded', label: 'Graded', count: gradedItems.length },
          { key: 'missed', label: 'Missed', count: missedItems.length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            style={{
              fontSize: '13px', fontWeight: 500,
              padding: '6px 14px', borderRadius: '999px',
              border: activeFilter === tab.key ? '0.5px solid #1a1a1a' : '0.5px solid #e9e7e1',
              background: activeFilter === tab.key ? '#1a1a1a' : '#fff',
              color: activeFilter === tab.key ? '#fff' : '#888',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {tab.label} <span style={{ fontSize: '12px', opacity: 0.7 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Items */}
      {sortedDisplay.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#aaa', padding: '20px 0' }}>No assessments found.</div>
      ) : activeFilter === 'all' ? (
        <>
          {renderSection('Open', openItems)}
          {renderSection('Submitted', submittedItems)}
          {renderSection('Graded', gradedItems)}
          {renderSection('Missed', missedItems)}
        </>
      ) : (
        sortedDisplay.map(renderCard)
      )}

      {/* Manual entry scores - keep exactly as before */}
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
