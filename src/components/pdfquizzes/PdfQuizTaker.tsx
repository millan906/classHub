import { useState } from 'react'
import { Button } from '../ui/Button'
import { scoreBarColor } from '../../utils/scoreColors'
import type { PdfQuiz, PdfQuizAnswerKeyEntry } from '../../types'

interface PdfQuizTakerProps {
  quiz: PdfQuiz
  pdfUrl: string
  onSubmit: (answers: Record<string, string>) => Promise<{ earned: number; total: number; score: number }>
  onClose: () => void
}

function AnswerField({
  entry,
  value,
  onChange,
  disabled,
}: {
  entry: PdfQuizAnswerKeyEntry
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const selectStyle: React.CSSProperties = {
    padding: '5px 9px', fontSize: '13px',
    border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '6px',
    background: disabled ? '#f9f9f9' : '#fff', outline: 'none', cursor: disabled ? 'default' : 'pointer',
  }

  if (entry.question_type === 'mcq') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={selectStyle}>
        <option value="">-- select --</option>
        {['A', 'B', 'C', 'D'].map(opt => <option key={opt}>{opt}</option>)}
      </select>
    )
  }
  if (entry.question_type === 'truefalse') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={selectStyle}>
        <option value="">-- select --</option>
        <option>True</option>
        <option>False</option>
      </select>
    )
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Your answer"
      style={{
        padding: '5px 9px', fontSize: '13px',
        border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '6px',
        background: disabled ? '#f9f9f9' : '#fff', outline: 'none', width: '160px',
      }}
    />
  )
}

export function PdfQuizTaker({ quiz, pdfUrl, onSubmit, onClose }: PdfQuizTakerProps) {
  const key = [...(quiz.answer_key ?? [])].sort((a, b) => a.question_number - b.question_number)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ earned: number; total: number; score: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function setAnswer(qNum: number, val: string) {
    setAnswers(prev => ({ ...prev, [String(qNum)]: val }))
  }

  const answeredCount = key.filter(k => (answers[String(k.question_number)] ?? '').trim() !== '').length
  const allAnswered = answeredCount === key.length

  async function handleSubmit() {
    if (!allAnswered) return
    setSubmitting(true)
    try {
      const res = await onSubmit(answers)
      setResult(res)
    } finally {
      setSubmitting(false)
    }
  }

  const scoreColor = result ? scoreBarColor(result.score) : '#1D9E75'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Left: PDF viewer */}
      <div style={{ flex: '1 1 58%', borderRight: '0.5px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{quiz.title}</div>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#378ADD' }}>Open in new tab</a>
        </div>
        <iframe
          src={pdfUrl}
          title={quiz.title}
          style={{ flex: 1, width: '100%', border: 'none' }}
        />
      </div>

      {/* Right: Answer form */}
      <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Your Answers</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
            {answeredCount}/{key.length} answered · {quiz.total_points} pts total
          </div>
        </div>

        {result ? (
          /* Score result */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: '16px' }}>
            <div style={{ fontSize: '40px', fontWeight: 700, color: scoreColor }}>
              {result.score}%
            </div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#1a1a1a' }}>
              {result.earned} / {result.total} points
            </div>
            <div style={{ width: '100%', maxWidth: '220px', height: '8px', background: '#F1EFE8', borderRadius: '999px' }}>
              <div style={{ height: '100%', width: result.score + '%', background: scoreColor, borderRadius: '999px' }} />
            </div>

            {/* Per-question breakdown */}
            <div style={{ width: '100%', marginTop: '8px', overflowY: 'auto', maxHeight: '260px' }}>
              {key.map(entry => {
                const given = (answers[String(entry.question_number)] ?? '').trim()
                const correct = entry.correct_answer.trim()
                const isCorrect = given.toLowerCase() === correct.toLowerCase()
                return (
                  <div key={entry.question_number} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: '6px', marginBottom: '4px',
                    background: isCorrect ? '#E1F5EE' : '#FCEBEB',
                  }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a1a' }}>Q{entry.question_number}</span>
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>
                        Your answer: <strong>{given || '—'}</strong>
                      </span>
                      {!isCorrect && (
                        <span style={{ fontSize: '12px', color: '#666', marginLeft: '6px' }}>
                          · Correct: <strong>{correct}</strong>
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isCorrect ? '#0F6E56' : '#A32D2D' }}>
                      {isCorrect ? `+${entry.points}` : '0'} / {entry.points}
                    </span>
                  </div>
                )
              })}
            </div>

            <Button onClick={onClose} style={{ marginTop: '8px' }}>Back to Quizzes</Button>
          </div>
        ) : (
          /* Answer inputs */
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {key.map(entry => (
                <div key={entry.question_number} style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#555', marginBottom: '4px' }}>
                    Q{entry.question_number}
                    <span style={{ fontWeight: 400, color: '#aaa', marginLeft: '6px' }}>{entry.points} pt{entry.points !== 1 ? 's' : ''}</span>
                  </div>
                  <AnswerField
                    entry={entry}
                    value={answers[String(entry.question_number)] ?? ''}
                    onChange={v => setAnswer(entry.question_number, v)}
                    disabled={false}
                  />
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
              >
                {submitting ? 'Submitting…' : `Submit (${answeredCount}/${key.length})`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
