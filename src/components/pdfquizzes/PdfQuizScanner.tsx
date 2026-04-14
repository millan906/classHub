import { useState, useRef } from 'react'
import { Button } from '../ui/Button'
import { formInputStyle } from '../../styles/shared'
import type { PdfQuizAnswerKeyEntry } from '../../types'

interface PdfQuizScannerProps {
  quizTitle: string
  objectiveQuestions: PdfQuizAnswerKeyEntry[]  // non-essay questions only
  onConfirm: (answers: Record<string, string>) => Promise<void>
  onCancel: () => void
}

function parseOcrText(text: string, expectedNums: number[]): Record<string, string> {
  const result: Record<string, string> = {}
  // Match patterns like: "1. A", "1) B", "1 T", "1.T", "1)F"
  // Also handle OCR quirks: "l" → "1", "O" → "0"
  const clean = text
    .replace(/[lI]/g, c => /^\d/.test(c) ? c : c) // keep as-is, handled in number match
    .replace(/\bO\b/g, '0')

  const pattern = /(\d+)\s*[.)]\s*([A-Da-dTtFf])\b/g
  let match
  while ((match = pattern.exec(clean)) !== null) {
    const num = parseInt(match[1])
    if (expectedNums.includes(num)) {
      let ans = match[2].toUpperCase()
      // Normalize T/F answers
      if (ans === 'T') ans = 'True'
      if (ans === 'F') ans = 'False'
      result[String(num)] = ans
    }
  }
  return result
}

export function PdfQuizScanner({ quizTitle, objectiveQuestions, onConfirm, onCancel }: PdfQuizScannerProps) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload')
  const [progress, setProgress] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const sortedQ = [...objectiveQuestions].sort((a, b) => a.question_number - b.question_number)
  const expectedNums = sortedQ.map(q => q.question_number)

  async function handleImage(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    setError('')
    setStep('processing')
    setProgress(0)

    try {
      // Lazy-load Tesseract to avoid bundling it unless needed
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })

      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      const parsed = parseOcrText(text, expectedNums)

      // Pre-fill any that OCR didn't catch with empty string
      const full: Record<string, string> = {}
      for (const q of sortedQ) full[String(q.question_number)] = parsed[String(q.question_number)] ?? ''

      setAnswers(full)
      setStep('review')
    } catch (err) {
      setError('OCR failed. Try a clearer photo.')
      setStep('upload')
    }
  }

  function getAnswerOptions(q: PdfQuizAnswerKeyEntry): string[] {
    if (q.question_type === 'mcq') return ['', 'A', 'B', 'C', 'D']
    if (q.question_type === 'truefalse') return ['', 'True', 'False']
    return []  // text: free input
  }

  async function handleConfirm() {
    setSaving(true)
    try { await onConfirm(answers) }
    finally { setSaving(false) }
  }

  const filledCount = Object.values(answers).filter(v => v.trim() !== '').length

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Scan Answer Sheet</div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>{quizTitle} · {sortedQ.length} objective question{sortedQ.length !== 1 ? 's' : ''}</div>

      {step === 'upload' && (
        <div>
          <div style={{
            border: '2px dashed rgba(0,0,0,0.15)', borderRadius: '10px',
            padding: '32px', textAlign: 'center', marginBottom: '12px', cursor: 'pointer',
          }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📷</div>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Take a photo or upload image</div>
            <div style={{ fontSize: '12px', color: '#888' }}>PNG, JPG, HEIC — hold paper flat, good lighting</div>
          </div>

          {/* Camera on mobile, file picker on desktop */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f) }}
          />

          {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '8px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="blue" onClick={() => fileRef.current?.click()}>Choose Image</Button>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px' }}>Reading answer sheet…</div>
          <div style={{ height: '6px', background: '#F1EFE8', borderRadius: '999px', maxWidth: '240px', margin: '0 auto' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#1D9E75', borderRadius: '999px', transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '8px' }}>{progress}%</div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '10px' }}>
            Review extracted answers — correct any misreads before saving.
            <span style={{ marginLeft: '8px', color: '#1D9E75', fontWeight: 500 }}>{filledCount}/{sortedQ.length} filled</span>
          </div>

          {/* 4-per-row answer grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {sortedQ.map(q => {
              const opts = getAnswerOptions(q)
              const val = answers[String(q.question_number)] ?? ''
              const isEmpty = val.trim() === ''
              return (
                <div key={q.question_number} style={{
                  background: isEmpty ? '#FFF8F0' : '#F6FFF9',
                  border: `1px solid ${isEmpty ? '#F7C1C1' : '#A8E6C8'}`,
                  borderRadius: '8px', padding: '8px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', fontWeight: 500 }}>Q{q.question_number}</div>
                  {opts.length > 0 ? (
                    <select value={val}
                      onChange={e => setAnswers(prev => ({ ...prev, [String(q.question_number)]: e.target.value }))}
                      style={{ ...formInputStyle, marginBottom: 0, width: '100%', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                      {opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={val} maxLength={20}
                      onChange={e => setAnswers(prev => ({ ...prev, [String(q.question_number)]: e.target.value }))}
                      style={{ ...formInputStyle, marginBottom: 0, width: '100%', fontSize: '13px', fontWeight: 600, textAlign: 'center' }} />
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={() => setStep('upload')}>← Rescan</Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={onCancel}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirm} disabled={saving}>
                {saving ? 'Saving…' : 'Confirm & Score'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
