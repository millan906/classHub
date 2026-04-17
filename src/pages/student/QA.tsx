import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useQA } from '../../hooks/useQA'
import { PageHeader } from '../../components/ui/Card'
import { PostQuestion } from '../../components/qa/PostQuestion'
import { QACard } from '../../components/qa/QACard'

export default function StudentQA() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { questions, postQuestion, updateQuestion, postAnswer } = useQA(institution?.id)

  async function handlePost(title: string, body: string, tag: string) {
    if (!profile) return
    await postQuestion(title, body, tag, profile.id)
  }

  async function handleAnswer(questionId: string, body: string) {
    if (!profile) return
    await postAnswer(questionId, body, profile.id)
  }

  if (!profile) return null

  return (
    <div>
      <PageHeader title="Q&A" subtitle="Ask questions and help your classmates." />
      <PostQuestion onPost={handlePost} />
      {questions.length === 0
        ? <div style={{ fontSize: '13px', color: '#888' }}>No questions yet. Be the first to ask!</div>
        : questions.map(q => (
            <QACard key={q.id} question={q} currentProfile={profile!} onAnswer={handleAnswer} onUpdate={updateQuestion} />
          ))
      }
    </div>
  )
}
