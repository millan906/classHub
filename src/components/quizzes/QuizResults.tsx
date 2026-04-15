import React, { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { IntegrityReport } from './IntegrityReport'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { useIntegrityLogs } from '../../hooks/useIntegrityLogs'
import { inputStyle } from '../../styles/shared'
import type { Quiz, QuizQuestion, QuizSubmission, FileSubmission, Profile } from '../../types'

interface QuizResultsProps {
  quiz: Quiz
  submissions: QuizSubmission[]
  enrolled: Profile[]
  fileSubmissions: FileSubmission[]
  onBack: () => void
  onSaveEssayScores: (submissionId: string, studentId: string, essayScores: Record<string, number>, earned: number, total: number) => Promise<void>
}

// ─── Submission detail ────────────────────────────────────────────────────────

function SubmissionDetail({ quiz, submission, student, onSaveEssayScores, onBack }: {
  quiz: Quiz
  submission: QuizSubmission | null
  student: Profile
  onSaveEssayScores: (submissionId: string, studentId: string, essayScores: Record<string, number>, earned: number, total: number) => Promise<void>
  onBack: () => void
}) {
  const questions = quiz.questions ?? []
  const essayQuestions = questions.filter(q => q.type === 'essay')
  const hasEssay = essayQuestions.length > 0

  const [essayPoints, setEssayPoints] = useState<Record<string, string>>(() => {
    const scores = submission?.essay_scores ?? {}
    return Object.fromEntries(essayQuestions.map(q => [q.id, String(scores[q.id] ?? '')]))
  })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  function getAutoEarned(): number {
    if (!submission) return 0
    return questions.reduce((sum, q) => {
      if (q.type === 'essay') return sum
      const pts = q.points ?? 1
      return sum + (submission.answers[q.id] === q.correct_option ? pts : 0)
    }, 0)
  }

  function getTotalPoints(): number {
    return questions.reduce((sum, q) => sum + (q.points ?? 1), 0)
  }

  async function handleSave() {
    if (!submission) return
    setSaving(true)
    const scores: Record<string, number> = {}
    let essayEarned = 0
    for (const q of essayQuestions) {
      const pts = Math.min(parseFloat(essayPoints[q.id] || '0') || 0, q.points ?? 1)
      scores[q.id] = pts
      essayEarned += pts
    }
    const newEarned = getAutoEarned() + essayEarned
    const total = getTotalPoints()
    await onSaveEssayScores(submission.id, student.id, scores, newEarned, total)
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const optionStyles = {
    default:  { bg: '#fff',     border: 'rgba(0,0,0,0.12)', color: '#1a1a1a' },
    selected: { bg: '#E6F1FB', border: '#185FA5',           color: '#185FA5' },
    correct:  { bg: '#E1F5EE', border: '#1D9E75',           color: '#0F6E56' },
    wrong:    { bg: '#FCEBEB', border: '#F7C1C1',           color: '#A32D2D' },
  }

  function getOptionState(q: QuizQuestion, label: string): keyof typeof optionStyles {
    if (!submission) return 'default'
    const selected = submission.answers[q.id]
    if (label === q.correct_option) return 'correct'
    if (selected === label && selected !== q.correct_option) return 'wrong'
    if (selected === label) return 'selected'
    return 'default'
  }

  const colors = getAvatarColors(student.full_name)

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>{quiz.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <Button onClick={onBack}>← Back</Button>
        <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} />
        <div>
          <div style={{ fontSize: '15px', fontWeight: 500 }}>{student.full_name}</div>
          {submission ? (
            <div style={{ fontSize: '12px', color: '#888' }}>
              {submission.earned_points ?? getAutoEarned()} / {submission.total_points ?? getTotalPoints()} pts
              {' · '}{submission.score}%
              {hasEssay && !submission.essay_scores && <span style={{ color: '#7A4F00' }}> · needs grading</span>}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#aaa' }}>Not submitted</div>
          )}
        </div>
      </div>

      {!submission ? (
        <div style={{ fontSize: '13px', color: '#888' }}>This student has not submitted yet.</div>
      ) : (
        <>
          {questions.map((q, i) => {
            const pts = q.points ?? 1
            const isEssay = q.type === 'essay'
            const studentAnswer = submission.answers[q.id]
            const isCorrect = !isEssay && studentAnswer === q.correct_option

            return (
              <div key={q.id} style={{
                background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
                borderRadius: '12px', padding: '12px 14px', marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{i + 1}. {q.question_text}</div>
                  <div style={{ fontSize: '12px', color: '#888', flexShrink: 0, marginLeft: '8px' }}>
                    {isEssay
                      ? `${submission.essay_scores?.[q.id] ?? '?'} / ${pts} pts`
                      : `${isCorrect ? pts : 0} / ${pts} pts`}
                  </div>
                </div>

                {q.type === 'codesnippet' && q.code_snippet && (
                  <pre style={{ background: '#1e1e2e', color: '#cdd6f4', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', overflowX: 'auto', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                    {q.code_snippet}
                  </pre>
                )}

                {isEssay ? (
                  <div>
                    <div style={{
                      padding: '10px 12px', borderRadius: '8px', background: '#F8F7F2',
                      fontSize: '13px', color: '#1a1a1a', lineHeight: '1.6',
                      whiteSpace: 'pre-wrap', marginBottom: '10px', minHeight: '60px',
                    }}>
                      {studentAnswer || <span style={{ color: '#aaa', fontStyle: 'italic' }}>No answer provided</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#555' }}>Points awarded:</span>
                      <input
                        type="number" min="0" max={pts} step="0.5"
                        value={essayPoints[q.id]}
                        onChange={e => setEssayPoints(prev => ({ ...prev, [q.id]: e.target.value }))}
                        style={{ ...inputStyle, width: '64px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#888' }}>/ {pts}</span>
                    </div>
                  </div>
                ) : (
                  q.options.map(opt => {
                    const state = getOptionState(q, opt.label)
                    const s = optionStyles[state]
                    return (
                      <div key={opt.label} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '7px 10px', border: `0.5px solid ${s.border}`,
                        borderRadius: '8px', marginBottom: '5px',
                        fontSize: '13px', background: s.bg, color: s.color,
                      }}>
                        {q.type !== 'truefalse' && (
                          <span style={{ fontWeight: 500, minWidth: '16px' }}>{opt.label.toUpperCase()}.</span>
                        )}
                        {opt.text}
                        {state === 'correct' && <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600 }}>✓ correct</span>}
                        {state === 'wrong' && <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600 }}>✗ wrong</span>}
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}

          {hasEssay && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
              {savedMsg && <span style={{ fontSize: '12px', color: '#1D9E75' }}>Saved!</span>}
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save essay grades'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuizResults({ quiz, submissions, enrolled, fileSubmissions, onBack, onSaveEssayScores }: QuizResultsProps) {
  const PAGE_SIZE = 20
  const showFilesTab = !!(quiz.item_type && quiz.item_type !== 'quiz' && quiz.allow_file_upload)
  const [resultsTab, setResultsTab] = useState<'scores' | 'integrity' | 'files'>('scores')
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const { fetchLogsForQuiz } = useIntegrityLogs()

  useEffect(() => {
    fetchLogsForQuiz(quiz.id).then(logs => {
      if (logs.length > 0) setResultsTab('integrity')
    })
  }, [])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', fontSize: '12px', borderRadius: '8px',
    border: active ? 'none' : '0.5px solid rgba(0,0,0,0.25)',
    background: active ? '#1D9E75' : 'transparent',
    color: active ? '#fff' : '#666',
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  })

  // Show submission detail when a student is selected
  if (selectedStudentId) {
    const student = enrolled.find(s => s.id === selectedStudentId)!
    const latestSub = submissions
      .filter(s => s.student_id === selectedStudentId)
      .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0))[0] ?? null
    return (
      <SubmissionDetail
        quiz={quiz}
        submission={latestSub}
        student={student}
        onSaveEssayScores={onSaveEssayScores}
        onBack={() => setSelectedStudentId(null)}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.1rem' }}>
        <Button onClick={onBack}>← Back</Button>
        <div style={{ fontSize: '17px', fontWeight: 500 }}>Results: {quiz.title}</div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button style={tabStyle(resultsTab === 'scores')} onClick={() => setResultsTab('scores')}>Scores</button>
        <button style={tabStyle(resultsTab === 'integrity')} onClick={() => setResultsTab('integrity')}>Integrity</button>
        {showFilesTab && (
          <button style={tabStyle(resultsTab === 'files')} onClick={() => setResultsTab('files')}>Files</button>
        )}
      </div>

      {resultsTab === 'scores' && (
        <>
          {enrolled.length === 0 && <div style={{ fontSize: '13px', color: '#888' }}>No enrolled students.</div>}
          {enrolled.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(student => {
            const sub = submissions
              .filter(s => s.student_id === student.id)
              .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0))[0]
            const colors = getAvatarColors(student.full_name)
            const hasUngradedEssay = sub && (quiz.questions ?? []).some(q => q.type === 'essay') && !sub.essay_scores
            return (
              <div key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px', background: '#fff',
                  border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', marginBottom: '8px',
                  cursor: 'pointer',
                }}>
                <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
                  {sub ? (
                    <>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {sub.earned_points ?? sub.score} pts · {sub.score}%
                        {hasUngradedEssay && <span style={{ color: '#7A4F00' }}> · essay pending</span>}
                      </div>
                      <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px', marginTop: '4px' }}>
                        <div style={{ height: '100%', width: sub.score + '%', background: '#1D9E75', borderRadius: '999px' }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#aaa' }}>Not submitted</div>
                  )}
                </div>
                {sub && <div style={{ fontSize: '13px', fontWeight: 500 }}>{sub.score}%</div>}
                <div style={{ fontSize: '11px', color: '#888' }}>View →</div>
              </div>
            )
          })}
          {enrolled.length > PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
              >← Prev</button>
              <span style={{ fontSize: '12px', color: '#888' }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, enrolled.length)} of {enrolled.length}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= enrolled.length}
                style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent', cursor: (page + 1) * PAGE_SIZE >= enrolled.length ? 'default' : 'pointer', opacity: (page + 1) * PAGE_SIZE >= enrolled.length ? 0.4 : 1 }}
              >Next →</button>
            </div>
          )}
        </>
      )}

      {resultsTab === 'integrity' && (
        <IntegrityReport quizId={quiz.id} enrolledStudents={enrolled} submissions={submissions} />
      )}

      {resultsTab === 'files' && showFilesTab && (
        <>
          {fileSubmissions.length === 0
            ? <div style={{ fontSize: '13px', color: '#888' }}>No file submissions yet.</div>
            : fileSubmissions.map(fs => {
                const student = enrolled.find(s => s.id === fs.student_id)
                return (
                  <div key={fs.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 14px', background: '#fff',
                    border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', marginBottom: '8px',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{student?.full_name ?? fs.student_id}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {fs.file_name}{fs.file_size ? ` · ${(fs.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>{new Date(fs.submitted_at).toLocaleString()}</div>
                    </div>
                    <a href={fs.file_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none' }}>
                      Download
                    </a>
                  </div>
                )
              })
          }
        </>
      )}
    </div>
  )
}
