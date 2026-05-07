import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useQA } from '../../hooks/useQA'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { PostQuestion } from '../../components/qa/PostQuestion'
import { QACard } from '../../components/qa/QACard'

export default function StudentQA() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { questions, loadingMore, hasMore, loadMore, error: qaError, postQuestion, uploadAttachment, updateQuestion, postAnswer } = useQA(institution?.id)
  const { courses: allCourses } = useCourses(institution?.id)
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)

  // Only show courses the student is enrolled in
  const enrolledCourses = allCourses.filter(c => enrolledCourseIds.includes(c.id))

  async function handlePost(
    title: string, body: string, tag: string, isPrivate: boolean,
    courseId?: string | null, recipientIds?: string[] | null,
    questionType?: 'question' | 'excuse_request',
    attachmentUrl?: string | null, attachmentName?: string | null,
  ) {
    if (!profile) return
    await postQuestion(title, body, tag, profile.id, isPrivate, profile.role, courseId, recipientIds, questionType, attachmentUrl, attachmentName)
  }

  async function handleAnswer(questionId: string, body: string) {
    if (!profile) return
    await postAnswer(questionId, body, profile.id, profile.role)
  }

  if (!profile) return null

  // Defense-in-depth: hide private questions that don't belong to this student.
  // RLS already enforces this server-side; this prevents any accidental client leak.
  const visibleQuestions = questions.filter(q =>
    !q.is_private || q.posted_by === profile.id || q.recipient_ids?.includes(profile.id)
  )

  return (
    <div>
      <PageHeader title="Q&A" subtitle="Ask questions and help your classmates." />
      {qaError && (
        <div style={{ margin: '0 0 12px', padding: '10px 14px', background: '#FEE2E2', border: '0.5px solid #FCA5A5', borderRadius: '8px', fontSize: '13px', color: '#991B1B' }}>
          {qaError}
        </div>
      )}
      <PostQuestion onPost={handlePost} courses={enrolledCourses} onUploadAttachment={uploadAttachment} />
      {visibleQuestions.length === 0
        ? <div style={{ fontSize: '13px', color: '#888' }}>No questions yet. Be the first to ask!</div>
        : visibleQuestions.map(q => (
            <QACard key={q.id} question={q} currentProfile={profile!} onAnswer={handleAnswer} onUpdate={updateQuestion} />
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
