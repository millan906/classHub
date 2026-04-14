import { useState } from 'react'
import { Button } from '../ui/Button'
import { scoreBarColor } from '../../utils/scoreColors'
import { printAnswerSheet } from '../../utils/answerSheetPrint'
import { PdfQuizScanner } from './PdfQuizScanner'
import { EssayScorer } from './EssayScorer'
import type { PdfQuiz, PdfQuizSubmission, Profile } from '../../types'

interface PdfQuizResultsProps {
  quiz: PdfQuiz
  submissions: PdfQuizSubmission[]
  enrolled: Profile[]
  onBack: () => void
  onDownloadCsv: () => void
  onScanAnswers: (studentId: string, answers: Record<string, string>) => Promise<void>
  onSaveEssayScores: (
    submissionId: string | null,
    studentId: string,
    essayScores: Record<string, Record<string, number>>,
  ) => Promise<void>
}

type ActivePanel = { type: 'scan' | 'essay'; studentId: string } | null

export function PdfQuizResults({
  quiz, submissions, enrolled, onBack, onDownloadCsv, onScanAnswers, onSaveEssayScores,
}: PdfQuizResultsProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const key = [...(quiz.answer_key ?? [])].sort((a, b) => a.question_number - b.question_number)
  const objectiveQuestions = key.filter(k => k.question_type !== 'essay')
  const hasEssay = key.some(k => k.question_type === 'essay')
  const submittedCount = new Set(submissions.map(s => s.student_id)).size

  function getBestSub(studentId: string): PdfQuizSubmission | null {
    const subs = submissions.filter(s => s.student_id === studentId)
    return subs.length > 0 ? subs.reduce((b, s) => s.earned_points > b.earned_points ? s : b) : null
  }

  // Inline panel for scan / essay
  if (activePanel) {
    const student = enrolled.find(s => s.id === activePanel.studentId)!
    const best = getBestSub(activePanel.studentId)

    if (activePanel.type === 'scan') {
      return (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <Button onClick={() => setActivePanel(null)}>← Back to Results</Button>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>
            {student.last_name}, {student.first_name}
          </div>
          <PdfQuizScanner
            quizTitle={quiz.title}
            objectiveQuestions={objectiveQuestions}
            onConfirm={async answers => {
              await onScanAnswers(activePanel.studentId, answers)
              setActivePanel(null)
            }}
            onCancel={() => setActivePanel(null)}
          />
        </div>
      )
    }

    if (activePanel.type === 'essay') {
      return (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <Button onClick={() => setActivePanel(null)}>← Back to Results</Button>
          </div>
          <EssayScorer
            quiz={quiz}
            submission={best}
            student={student}
            onSave={async (subId, essayScores) => {
              await onSaveEssayScores(subId, activePanel.studentId, essayScores)
              setActivePanel(null)
            }}
            onCancel={() => setActivePanel(null)}
          />
        </div>
      )
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <Button onClick={onBack}>← Back</Button>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '17px', fontWeight: 600 }}>{quiz.title}</div>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>
            {submittedCount}/{enrolled.length} submitted · {quiz.total_points} pts · {key.length} questions
          </div>
        </div>
        <Button onClick={() => printAnswerSheet(quiz)}>Print Answer Sheet</Button>
        <Button variant="blue" onClick={onDownloadCsv}>Download CSV</Button>
      </div>

      {enrolled.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888' }}>No enrolled students.</div>
      )}

      {enrolled.map(student => {
        const best = getBestSub(student.id)
        const subs = submissions.filter(s => s.student_id === student.id)
        const pct = best?.score ?? null
        const barColor = scoreBarColor(pct)
        const hasEssayScored = best && Object.keys(best.essay_scores ?? {}).length > 0
        const isScanned = !!best
        const isFullyGraded = isScanned && (!hasEssay || hasEssayScored)

        // Status label
        let statusLabel: string
        let statusColor: string
        let statusBg: string
        if (!isScanned) {
          statusLabel = '⬜ Not scanned'
          statusColor = '#aaa'
          statusBg = '#f4f4f4'
        } else if (hasEssay && !hasEssayScored) {
          statusLabel = '⏳ Essay pending'
          statusColor = '#D4900A'
          statusBg = '#FEF3CD'
        } else {
          statusLabel = '✓ Logged'
          statusColor = '#0F6E56'
          statusBg = '#E1F5EE'
        }

        return (
          <div key={student.id} style={{
            background: '#fff',
            border: `0.5px solid ${isFullyGraded ? '#A8E6C8' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: '12px', marginBottom: '8px', overflow: 'hidden',
          }}>
            {/* Student summary */}
            <div style={{ padding: '12px 16px' }}>
              {/* Top row: name + status badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {student.last_name}, {student.first_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email}</div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 10px',
                  borderRadius: '999px', background: statusBg, color: statusColor,
                  flexShrink: 0,
                }}>
                  {statusLabel}
                </span>
              </div>

              {/* Score + progress bar */}
              {best ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      {subs.length} scan{subs.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: barColor }}>
                      {best.earned_points} / {quiz.total_points} pts
                      <span style={{ fontSize: '11px', fontWeight: 400, color: '#888', marginLeft: '6px' }}>({best.score}%)</span>
                    </span>
                  </div>
                  {pct !== null && (
                    <div style={{ height: '5px', background: '#F1EFE8', borderRadius: '999px', marginBottom: '10px' }}>
                      <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: '999px' }} />
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '10px' }}>No paper scanned yet.</div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {objectiveQuestions.length > 0 && (
                  <Button onClick={() => setActivePanel({ type: 'scan', studentId: student.id })}>
                    {isScanned ? '🔄 Re-scan' : '📷 Scan'}
                  </Button>
                )}
                {hasEssay && (
                  <Button
                    variant={best && !hasEssayScored ? 'primary' : 'default'}
                    onClick={() => setActivePanel({ type: 'essay', studentId: student.id })}
                  >
                    ✏️ {hasEssayScored ? 'Edit Essay' : 'Score Essay'}
                  </Button>
                )}
              </div>
            </div>

            {/* Objective answer breakdown */}
            {best && objectiveQuestions.length > 0 && (
              <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', padding: '8px 16px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {objectiveQuestions.map(entry => {
                  const given = (best.answers[String(entry.question_number)] ?? '').trim()
                  const correct = entry.correct_answer.trim()
                  const isCorrect = given.toLowerCase() === correct.toLowerCase()
                  return (
                    <div key={entry.question_number} style={{
                      fontSize: '11px', padding: '2px 7px', borderRadius: '5px',
                      background: given === '' ? '#f4f4f4' : isCorrect ? '#E1F5EE' : '#FCEBEB',
                      color: given === '' ? '#aaa' : isCorrect ? '#0F6E56' : '#A32D2D',
                    }}>
                      Q{entry.question_number}: {given || '—'} {given !== '' && (isCorrect ? '✓' : `✗(${correct})`)}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Essay score breakdown */}
            {best && hasEssayScored && (
              <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', padding: '8px 16px' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', fontWeight: 500 }}>Essay Scores</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {(quiz.answer_key ?? []).filter(k => k.question_type === 'essay').map(q => {
                    const cats = (quiz.essay_rubrics ?? []).filter(r => r.question_number === q.question_number)
                    const qEarned = cats.reduce((s, c) => s + (best.essay_scores?.[String(q.question_number)]?.[c.id] ?? 0), 0)
                    return (
                      <div key={q.question_number} style={{
                        fontSize: '11px', padding: '2px 7px', borderRadius: '5px',
                        background: '#E6F1FB', color: '#185FA5',
                      }}>
                        Q{q.question_number}: {qEarned}/{q.points} pts
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
