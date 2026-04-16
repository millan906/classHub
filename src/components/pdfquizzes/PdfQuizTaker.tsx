import { useState, useRef } from 'react'
import { Button } from '../ui/Button'
import { scoreBarColor } from '../../utils/scoreColors'
import type { PdfQuiz, PdfQuizAnswerKeyEntry } from '../../types'

interface PdfQuizTakerProps {
  quiz: PdfQuiz
  pdfUrl: string | null
  onSubmit: (answers: Record<string, string>) => Promise<{ earned: number; total: number; score: number }>
  onClose: () => void
}

function parseOcrText(text: string, expectedNums: number[]): Record<string, string> {
  const result: Record<string, string> = {}
  const pattern = /(\d+)\s*[.)]\s*([A-Da-dTtFf])\b/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    const num = parseInt(match[1])
    if (expectedNums.includes(num)) {
      let ans = match[2].toUpperCase()
      if (ans === 'T') ans = 'True'
      if (ans === 'F') ans = 'False'
      result[String(num)] = ans
    }
  }
  return result
}

function AnswerField({
  entry, value, onChange, disabled,
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
  const objectiveKey = key.filter(k => k.question_type !== 'essay')
  const expectedNums = objectiveKey.map(k => k.question_number)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ earned: number; total: number; score: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // OCR scan state
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanError, setScanError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  async function handleScanImage(file: File) {
    if (!file.type.startsWith('image/')) { setScanError('Please select an image file.'); return }
    if (file.size > 10 * 1024 * 1024) { setScanError('Image too large. Maximum size is 10 MB.'); return }
    setScanError('')
    setScanning(true)
    setScanProgress(0)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setScanProgress(Math.round(m.progress * 100))
        },
      })
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      const parsed = parseOcrText(text, expectedNums)
      // Merge into existing answers — only fill objective questions
      setAnswers(prev => {
        const next = { ...prev }
        for (const q of objectiveKey) {
          const k = String(q.question_number)
          if (parsed[k]) next[k] = parsed[k]
        }
        return next
      })
    } catch {
      setScanError('OCR failed. Try a clearer photo.')
    } finally {
      setScanning(false)
    }
  }

  const scoreColor = result ? scoreBarColor(result.score) : '#1D9E75'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Left: PDF viewer (only if PDF exists) */}
      {pdfUrl && (
        <div style={{ flex: '1 1 58%', borderRight: '0.5px solid rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{quiz.title}</div>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#378ADD' }}>Open in new tab</a>
          </div>
          <iframe src={pdfUrl} title={quiz.title} style={{ flex: 1, width: '100%', border: 'none' }} />
        </div>
      )}

      {/* Answer form */}
      <div style={{ flex: pdfUrl ? '0 0 42%' : '1 1 100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Your Answers</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
            {answeredCount}/{key.length} answered · {quiz.total_points} pts total
          </div>
          {quiz.instructions && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#555', lineHeight: '1.6', whiteSpace: 'pre-wrap', background: '#F8F7F2', borderRadius: '7px', padding: '8px 10px' }}>
              {quiz.instructions}
            </div>
          )}
        </div>

        {result ? (
          /* Score result */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', gap: '16px' }}>
            <div style={{ fontSize: '40px', fontWeight: 700, color: scoreColor }}>{result.score}%</div>
            <div style={{ fontSize: '16px', fontWeight: 500 }}>{result.earned} / {result.total} points</div>
            <div style={{ width: '100%', maxWidth: '220px', height: '8px', background: '#F1EFE8', borderRadius: '999px' }}>
              <div style={{ height: '100%', width: result.score + '%', background: scoreColor, borderRadius: '999px' }} />
            </div>
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
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>Q{entry.question_number}</span>
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
          <>
            {/* Scan banner */}
            {objectiveKey.length > 0 && !scanning && (
              <div style={{
                margin: '10px 16px 0', padding: '10px 12px',
                background: '#E6F1FB', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#185FA5' }}>Have a paper answer sheet?</div>
                  <div style={{ fontSize: '11px', color: '#378ADD' }}>Take a photo to auto-fill your answers</div>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    fontSize: '12px', fontWeight: 600, padding: '6px 12px',
                    background: '#185FA5', color: '#fff', border: 'none',
                    borderRadius: '7px', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  📷 Scan
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleScanImage(f) }}
                />
              </div>
            )}

            {/* OCR progress */}
            {scanning && (
              <div style={{ margin: '10px 16px 0', padding: '10px 12px', background: '#F6FFF9', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#0F6E56', marginBottom: '6px' }}>Reading answer sheet… {scanProgress}%</div>
                <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                  <div style={{ height: '100%', width: `${scanProgress}%`, background: '#1D9E75', borderRadius: '999px', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {scanError && (
              <div style={{ margin: '6px 16px 0', fontSize: '12px', color: '#A32D2D' }}>{scanError}</div>
            )}

            {/* Answer inputs */}
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
                    disabled={scanning}
                  />
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 16px', borderTop: '0.5px solid rgba(0,0,0,0.08)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexShrink: 0 }}>
              <Button onClick={onClose}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!allAnswered || submitting || scanning}
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
