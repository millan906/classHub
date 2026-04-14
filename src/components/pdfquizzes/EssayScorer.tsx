import { useState } from 'react'
import { Button } from '../ui/Button'
import { formInputStyle } from '../../styles/shared'
import type { PdfQuiz, PdfQuizSubmission, Profile } from '../../types'

interface EssayScorerProps {
  quiz: PdfQuiz
  submission: PdfQuizSubmission | null  // existing submission (from scan) or null
  student: Profile
  onSave: (
    submissionId: string | null,
    essayScores: Record<string, Record<string, number>>,
  ) => Promise<void>
  onCancel: () => void
}

export function EssayScorer({ quiz, submission, student, onSave, onCancel }: EssayScorerProps) {
  const rubrics = quiz.essay_rubrics ?? []
  const essayQuestions = (quiz.answer_key ?? [])
    .filter(k => k.question_type === 'essay')
    .sort((a, b) => a.question_number - b.question_number)

  // Build initial scores from existing submission or zeros
  const [scores, setScores] = useState<Record<string, Record<string, number>>>(() => {
    const init: Record<string, Record<string, number>> = {}
    for (const q of essayQuestions) {
      init[String(q.question_number)] = {}
      const cats = rubrics.filter(r => r.question_number === q.question_number)
      for (const cat of cats) {
        init[String(q.question_number)][cat.id] =
          submission?.essay_scores?.[String(q.question_number)]?.[cat.id] ?? 0
      }
    }
    return init
  })

  const [saving, setSaving] = useState(false)

  function setScore(qNum: number, rubricId: string, value: number, max: number) {
    const clamped = Math.max(0, Math.min(value, max))
    setScores(prev => ({
      ...prev,
      [String(qNum)]: { ...prev[String(qNum)], [rubricId]: clamped },
    }))
  }

  function earnedForQuestion(qNum: number): number {
    const qScores = scores[String(qNum)] ?? {}
    return Object.values(qScores).reduce((s, v) => s + (Number(v) || 0), 0)
  }

  function maxForQuestion(qNum: number): number {
    return rubrics
      .filter(r => r.question_number === qNum)
      .reduce((s, r) => s + r.max_points, 0)
  }

  const totalEssayEarned = essayQuestions.reduce((s, q) => s + earnedForQuestion(q.question_number), 0)
  const totalEssayMax = essayQuestions.reduce((s, q) => s + maxForQuestion(q.question_number), 0)

  async function handleSave() {
    setSaving(true)
    try { await onSave(submission?.id ?? null, scores) }
    finally { setSaving(false) }
  }

  if (essayQuestions.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
        No essay questions in this quiz.
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>Essay Scoring</div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
        {student.last_name}, {student.first_name}
      </div>

      {essayQuestions.map(q => {
        const cats = rubrics
          .filter(r => r.question_number === q.question_number)
          .sort((a, b) => a.order_index - b.order_index)
        const earned = earnedForQuestion(q.question_number)
        const max = maxForQuestion(q.question_number)
        const pct = max > 0 ? Math.round((earned / max) * 100) : 0
        const barColor = pct >= 75 ? '#1D9E75' : pct >= 50 ? '#f59e0b' : '#ef4444'

        return (
          <div key={q.question_number} style={{
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '10px', padding: '14px 16px', marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Question {q.question_number}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: barColor }}>
                {earned} / {max} pts
              </div>
            </div>

            {/* Score progress bar */}
            <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px', marginBottom: '12px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '999px', transition: 'width 0.2s' }} />
            </div>

            {cats.length === 0 && (
              <div style={{ fontSize: '12px', color: '#aaa' }}>No rubric categories defined.</div>
            )}

            {cats.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500 }}>{cat.category_name}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>Max {cat.max_points} pts</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    min={0}
                    max={cat.max_points}
                    value={scores[String(q.question_number)]?.[cat.id] ?? 0}
                    onChange={e => setScore(q.question_number, cat.id, Number(e.target.value), cat.max_points)}
                    style={{ ...formInputStyle, marginBottom: 0, width: '64px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '12px', color: '#888' }}>/ {cat.max_points}</span>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {/* Essay total summary */}
      <div style={{
        background: '#F6FFF9', border: '0.5px solid #A8E6C8',
        borderRadius: '8px', padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '14px',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 500 }}>Essay Total</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F6E56' }}>
          {totalEssayEarned} / {totalEssayMax} pts
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Essay Scores'}
        </Button>
      </div>
    </div>
  )
}
