import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useQA } from '../../hooks/useQA'
import { PageHeader } from '../../components/ui/Card'
import { PostQuestion } from '../../components/qa/PostQuestion'
import { QACard } from '../../components/qa/QACard'

export default function FacultyQA() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { questions, loadingMore, hasMore, loadMore, error: qaError, postQuestion, updateQuestion, deleteQuestion, toggleQuestion, postAnswer, endorseAnswer } = useQA(institution?.id)
  const [pageError, setPageError] = useState('')

  async function handlePost(title: string, body: string, tag: string, isPrivate: boolean) {
    if (!profile) return
    await postQuestion(title, body, tag, profile.id, isPrivate, profile.role)
  }

  async function handleAnswer(questionId: string, body: string) {
    if (!profile) return
    await postAnswer(questionId, body, profile.id, profile.role)
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
      <PostQuestion onPost={handlePost} />
      {questions.length === 0
        ? <div style={{ fontSize: '13px', color: '#888' }}>No questions yet.</div>
        : questions.map(q => (
            <QACard
              key={q.id}
              question={q}
              currentProfile={profile!}
              onAnswer={handleAnswer}
              onEndorse={endorseAnswer}
              onUpdate={updateQuestion}
              onToggle={toggleQuestion}
              onDelete={handleDelete}
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
