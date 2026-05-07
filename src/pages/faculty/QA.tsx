import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useQA } from '../../hooks/useQA'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useCourses } from '../../hooks/useCourses'
import { useStudents } from '../../hooks/useStudents'
import { useAllEnrollments } from '../../hooks/useEnrollments'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/ui/Card'
import { PostQuestion } from '../../components/qa/PostQuestion'
import { QACard } from '../../components/qa/QACard'
import type { AttendanceSession } from '../../types'

export default function FacultyQA() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const [courseFilter, setCourseFilter] = useState<string | null>(null)
  const [pageError, setPageError] = useState('')

  const { questions: allQuestions, loadingMore, hasMore, loadMore, error: qaError, postQuestion, updateQuestion, deleteQuestion, toggleQuestion, postAnswer, endorseAnswer } = useQA(institution?.id)
  const { courses } = useCourses(institution?.id, profile?.id)
  const { students } = useStudents(institution?.id)
  const { enrollments: allEnrollments } = useAllEnrollments()
  const { quizzes, grantException } = useQuizzes(profile?.id)
  const [allSessions, setAllSessions] = useState<AttendanceSession[]>([])

  useEffect(() => {
    if (courses.length === 0) return
    const courseIds = courses.map(c => c.id)
    supabase.from('attendance_sessions').select('*')
      .in('course_id', courseIds)
      .order('date', { ascending: false })
      .then(({ data }) => setAllSessions(data ?? []))
  }, [courses])

  const approvedStudents = students.filter(s => s.status === 'approved')

  // Client-side course filter for the question list
  const enrolledInFilter = courseFilter
    ? new Set(allEnrollments.filter(e => e.course_id === courseFilter).map(e => e.student_id))
    : null
  const questions = enrolledInFilter
    ? allQuestions.filter(q => q.course_id === courseFilter || enrolledInFilter.has(q.posted_by))
    : allQuestions

  async function handlePost(
    title: string, body: string, tag: string, isPrivate: boolean,
    courseId?: string | null, recipientIds?: string[] | null,
  ) {
    if (!profile) return
    await postQuestion(title, body, tag, profile.id, isPrivate, profile.role, courseId, recipientIds)
  }

  async function handleAnswer(questionId: string, body: string) {
    if (!profile) return
    await postAnswer(questionId, body, profile.id, profile.role)
  }

  async function handleGrantRetake(quizId: string, studentId: string) {
    if (!profile) return
    await grantException(quizId, studentId, 1, profile.id)
  }

  async function handleLogExcused(sessionId: string, studentId: string) {
    const { error } = await supabase.from('attendance_records').upsert(
      { session_id: sessionId, student_id: studentId, status: 'excused' },
      { onConflict: 'session_id,student_id' }
    )
    if (error) throw error
  }

  async function handleDelete(id: string) {
    setPageError('')
    try {
      await deleteQuestion(id)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to delete question')
    }
  }

  if (!profile) return null

  return (
    <div>
      <PageHeader title="Q&A" subtitle="Answer student questions." />

      {(qaError || pageError) && (
        <div style={{ margin: '0 0 12px', padding: '10px 14px', background: '#FEE2E2', border: '0.5px solid #FCA5A5', borderRadius: '8px', fontSize: '13px', color: '#991B1B' }}>
          {qaError || pageError}
        </div>
      )}

      {/* Course filter */}
      {courses.length > 0 && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#888', flexShrink: 0 }}>Filter by course:</span>
          <select
            value={courseFilter ?? ''}
            onChange={e => setCourseFilter(e.target.value || null)}
            style={{
              fontSize: '12px', padding: '5px 10px', borderRadius: '8px',
              border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
              fontFamily: 'Inter, sans-serif', cursor: 'pointer',
            }}
          >
            <option value=''>All courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` — ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <PostQuestion onPost={handlePost} courses={courses} students={approvedStudents} allEnrollments={allEnrollments} />

      {questions.length === 0
        ? <div style={{ fontSize: '13px', color: '#888' }}>No questions yet.</div>
        : questions.map(q => (
            <QACard
              key={q.id}
              question={q}
              currentProfile={profile}
              onAnswer={handleAnswer}
              onEndorse={endorseAnswer}
              onUpdate={updateQuestion}
              onToggle={toggleQuestion}
              onDelete={handleDelete}
              quizzes={quizzes}
              attendanceSessions={allSessions}
              onGrantRetake={handleGrantRetake}
              onLogExcused={handleLogExcused}
            />
          ))
      }

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button onClick={loadMore} disabled={loadingMore} style={{
            fontSize: '13px', padding: '7px 20px', borderRadius: '8px',
            border: '0.5px solid rgba(0,0,0,0.25)', background: 'transparent',
            cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.5 : 1,
            fontFamily: 'Inter, sans-serif',
          }}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
