import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import { useLockdown } from '../../hooks/useLockdown'
import type { Quiz, QuizQuestion } from '../../types'

const INACTIVITY_THRESHOLD_MS = 60_000

interface QuizTakerProps {
  quiz: Quiz
  onSubmit: (answers: Record<string, string>, earnedPoints: number, totalPoints: number, autoSubmitted?: boolean) => Promise<void>
  onCancel: () => void
  onLogEvent?: (eventType: string, severity: 'low' | 'medium' | 'high') => void
  onFileUpload?: (file: File) => Promise<void>
  existingFile?: { file_name: string; file_url: string }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuizTimer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds)
  const called = useRef(false)

  useEffect(() => {
    if (remaining <= 0) {
      if (!called.current) { called.current = true; onExpire() }
      return
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isLow = remaining < 300
  return (
    <div style={{
      padding: '4px 12px', borderRadius: '8px', fontVariantNumeric: 'tabular-nums',
      background: isLow ? '#FCEBEB' : '#FEF3CD',
      color: isLow ? '#A32D2D' : '#7A4F00',
      fontSize: '13px', fontWeight: 600,
    }}>
      {mins}:{secs.toString().padStart(2, '0')}
    </div>
  )
}

function LockdownModal({ onCancel, onAccept }: { onCancel: () => void; onAccept: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', maxWidth: '440px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px', textAlign: 'center' }}>🔒</div>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>Lockdown quiz</div>
        <ul style={{ fontSize: '13px', color: '#444', paddingLeft: '20px', lineHeight: '1.8', marginBottom: '20px' }}>
          <li>Fullscreen mode will be enforced</li>
          <li>Right-click, copy, and paste are disabled</li>
          <li>Switching tabs will be logged</li>
          <li>Losing focus will be logged</li>
          <li>Exiting fullscreen will be flagged as high risk</li>
        </ul>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onAccept}>I understand, begin quiz</Button>
        </div>
      </div>
    </div>
  )
}

function FullscreenWarningModal({ onReturn }: { onReturn: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px 28px', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', marginBottom: '8px' }}>⚠️</div>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Fullscreen exited</div>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
          This event has been logged. Please return to fullscreen to continue.
        </div>
        <Button variant="primary" onClick={onReturn}>Return to fullscreen</Button>
      </div>
    </div>
  )
}

function SubmitResult({ earnedPoints, autoTotal, allEssay, hasEssay }: {
  earnedPoints: number
  autoTotal: number
  allEssay: boolean
  hasEssay: boolean
}) {
  if (allEssay) {
    return (
      <div style={{
        padding: '16px 18px', borderRadius: '8px', background: '#FEF3CD',
        color: '#7A4F00', border: '0.5px solid #E5C100',
      }}>
        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Submitted</div>
        <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
          Your answers have been submitted successfully. Your instructor will review and grade your work — check back later for your score.
        </div>
      </div>
    )
  }

  const pass = autoTotal > 0 ? earnedPoints / autoTotal >= 0.5 : false
  return (
    <div style={{
      padding: '12px 14px', borderRadius: '8px',
      background: hasEssay ? '#FEF3CD' : pass ? '#E1F5EE' : '#FCEBEB',
      color: hasEssay ? '#7A4F00' : pass ? '#085041' : '#A32D2D',
      fontSize: '13px', fontWeight: 500,
      border: `0.5px solid ${hasEssay ? '#E5C100' : pass ? '#1D9E75' : '#F7C1C1'}`,
    }}>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '2px' }}>
        {earnedPoints} / {autoTotal} pts
        {hasEssay && <span style={{ fontSize: '13px', fontWeight: 400 }}> (auto-graded)</span>}
      </div>
      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
        {autoTotal > 0 ? Math.round((earnedPoints / autoTotal) * 100) : 0}%
      </div>
      {hasEssay
        ? 'Your essay answers have been submitted and are pending instructor review. Your final score will be updated once graded.'
        : pass ? 'Great job! You passed.' : 'Keep reviewing and try again.'}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuizTaker({ quiz, onSubmit, onCancel, onLogEvent, onFileUpload, existingFile }: QuizTakerProps) {
  const questions = quiz.questions ?? []
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [, setTotalPoints] = useState(0)
  const hasEssay = questions.some(q => q.type === 'essay')
  const allEssay = questions.length > 0 && questions.every(q => q.type === 'essay')
  const autoTotal = questions.reduce((sum, q) => q.type !== 'essay' ? sum + (q.points ?? 1) : sum, 0)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const lockdownEnabled = quiz.lockdown_enabled ?? false
  const [lockdownAccepted, setLockdownAccepted] = useState(!lockdownEnabled)
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false)
  const active = lockdownEnabled && lockdownAccepted
  const submittedRef = useRef(false)
  const lastActivityRef = useRef(Date.now())
  const activeRef = useRef(active)
  activeRef.current = active

  function handleEvent(type: string, severity: 'low' | 'medium' | 'high') {
    if (onLogEvent) onLogEvent(type, severity)
    if (type === 'fullscreen_exit' && !submittedRef.current) setShowFullscreenWarning(true)
  }

  const handleEventRef = useRef(handleEvent)
  handleEventRef.current = handleEvent

  useLockdown(active, handleEvent)

  useEffect(() => {
    const onVisibility = () => { if (document.hidden && !submittedRef.current && !activeRef.current) handleEventRef.current('tab_switch', 'medium') }
    const onBlur = () => { if (!submittedRef.current && !activeRef.current) handleEventRef.current('focus_loss', 'low') }
    const onActivity = () => { lastActivityRef.current = Date.now() }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('mousemove', onActivity)
    document.addEventListener('keydown', onActivity)
    document.addEventListener('mousedown', onActivity)

    const inactivityInterval = setInterval(() => {
      if (!submittedRef.current && Date.now() - lastActivityRef.current >= INACTIVITY_THRESHOLD_MS) {
        handleEventRef.current('no_activity', 'low')
        lastActivityRef.current = Date.now()
      }
    }, 10_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onActivity)
      document.removeEventListener('keydown', onActivity)
      document.removeEventListener('mousedown', onActivity)
      clearInterval(inactivityInterval)
    }
  }, [])

  function selectAnswer(questionId: string, option: string) {
    if (submitted) return
    setAnswers(a => ({ ...a, [questionId]: option }))
  }

  async function handleSubmit(auto = false) {
    if (submitting) return
    setSubmitting(true)
    let earned = 0
    let total = 0
    for (const q of questions) {
      const pts = q.points ?? 1
      total += pts
      if (q.type !== 'essay' && answers[q.id] === q.correct_option) earned += pts
    }
    setEarnedPoints(earned)
    setTotalPoints(total)
    submittedRef.current = true
    setSubmitted(true)
    try {
      if (pendingFile && onFileUpload) await onFileUpload(pendingFile)
      await onSubmit(answers, earned, total, auto)
    } finally {
      setSubmitting(false)
    }
  }

  function getOptionState(q: QuizQuestion, label: string): 'default' | 'selected' | 'correct' | 'wrong' {
    if (!submitted) return answers[q.id] === label ? 'selected' : 'default'
    if (label === q.correct_option) return 'correct'
    if (answers[q.id] === label && answers[q.id] !== q.correct_option) return 'wrong'
    return 'default'
  }

  const optionStyles = {
    default:  { bg: '#fff',     border: 'rgba(0,0,0,0.12)', color: '#1a1a1a' },
    selected: { bg: '#E1F5EE', border: '#1D9E75',            color: '#0F6E56' },
    correct:  { bg: '#E1F5EE', border: '#1D9E75',            color: '#0F6E56' },
    wrong:    { bg: '#FCEBEB', border: '#F7C1C1',            color: '#A32D2D' },
  }

  if (lockdownEnabled && !lockdownAccepted) {
    return <LockdownModal onCancel={onCancel} onAccept={() => setLockdownAccepted(true)} />
  }

  return (
    <div>
      {active && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, marginBottom: '12px' }}>
          🔒 Lockdown mode active — fullscreen enforced, tab switching is monitored
        </div>
      )}

      {showFullscreenWarning && (
        <FullscreenWarningModal onReturn={() => {
          document.documentElement.requestFullscreen?.().catch(() => {})
          setShowFullscreenWarning(false)
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
        <div style={{ fontSize: '17px', fontWeight: 500 }}>{quiz.title}</div>
        {quiz.time_limit_minutes && !submitted && (
          <QuizTimer totalSeconds={quiz.time_limit_minutes * 60} onExpire={() => handleSubmit(true)} />
        )}
      </div>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.1rem' }}>{questions.length} questions</div>

      {quiz.description && (
        <div style={{ background: '#F8F7F2', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#444', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '14px' }}>
          {quiz.description}
        </div>
      )}

      {questions.map((q, i) => (
        <div key={q.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{i + 1}. {q.question_text}</div>
            <span style={{ fontSize: '11px', color: '#888', flexShrink: 0, marginLeft: '8px' }}>
              {q.points ?? 1} pt{(q.points ?? 1) !== 1 ? 's' : ''}
            </span>
          </div>

          {q.type === 'codesnippet' && q.code_snippet && (
            <pre style={{ background: '#1e1e2e', color: '#cdd6f4', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
              {q.code_snippet}
            </pre>
          )}

          {q.type === 'essay' ? (
            <>
              <textarea
                value={answers[q.id] ?? ''}
                onChange={e => !submitted && setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                disabled={submitted}
                placeholder="Type your answer here…"
                rows={5}
                style={{
                  width: '100%', padding: '10px', fontSize: '13px',
                  border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px',
                  fontFamily: 'Inter, sans-serif', lineHeight: '1.5', resize: 'vertical',
                  boxSizing: 'border-box', outline: 'none', color: '#1a1a1a',
                  background: submitted ? '#F8F7F2' : '#fff',
                }}
              />
              {submitted && (
                <div style={{ fontSize: '11px', color: '#7A4F00', marginTop: '4px' }}>
                  Pending faculty review
                </div>
              )}
            </>
          ) : (
            q.options.map(opt => {
              const state = getOptionState(q, opt.label)
              const s = optionStyles[state]
              return (
                <div key={opt.label} onClick={() => selectAnswer(q.id, opt.label)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', border: `0.5px solid ${s.border}`,
                  borderRadius: '8px', marginBottom: '6px',
                  cursor: submitted ? 'default' : 'pointer',
                  fontSize: '13px', background: s.bg, color: s.color,
                }}>
                  {q.type !== 'truefalse' && <span style={{ fontWeight: 500, minWidth: '16px' }}>{opt.label.toUpperCase()}.</span>}
                  {opt.text}
                </div>
              )
            })
          )}
        </div>
      ))}

      {quiz.item_type && quiz.item_type !== 'quiz' && quiz.allow_file_upload && !submitted && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
            File Upload {existingFile ? '(replace existing)' : ''}
          </div>
          {existingFile && (
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
              Current: <a href={existingFile.file_url} target="_blank" rel="noreferrer" style={{ color: '#185FA5' }}>{existingFile.file_name}</a>
            </div>
          )}
          <input type="file" accept="video/*,application/pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip"
            onChange={e => setPendingFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: '13px' }} />
          {pendingFile && (
            <div style={{ fontSize: '12px', color: '#0F6E56', marginTop: '6px' }}>
              Selected: {pendingFile.name} ({(pendingFile.size / 1024 / 1024).toFixed(1)} MB)
            </div>
          )}
        </div>
      )}

      {!submitted && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => handleSubmit(false)} disabled={submitting}>
            {submitting ? 'Submitting...' : (quiz.item_type && quiz.item_type !== 'quiz') ? 'Submit' : 'Submit quiz'}
          </Button>
        </div>
      )}

      {submitted && (
        <>
          <SubmitResult earnedPoints={earnedPoints} autoTotal={autoTotal} allEssay={allEssay} hasEssay={hasEssay} />
          {hasEssay && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button variant="primary" onClick={onCancel}>Back to quizzes</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
