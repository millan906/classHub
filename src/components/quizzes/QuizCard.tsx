import { useState } from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { Quiz, QuizSubmission, Course } from '../../types'

interface QuizCardProps {
  quiz: Quiz
  submissions?: QuizSubmission[]
  totalStudents?: number
  isFaculty?: boolean
  courses?: Course[]
  onToggle?: (id: string, isOpen: boolean) => void
  onReleaseResults?: (id: string, visible: boolean) => void
  onCopy?: (quizId: string, targetCourseId: string) => Promise<void>
  onViewResults?: (quiz: Quiz) => void
  onEdit?: (quiz: Quiz) => void
  onDelete?: (quiz: Quiz) => void
  onTake?: (quiz: Quiz) => void
  mySubmission?: QuizSubmission
  attemptsUsed?: number
}

const TYPE_ICONS: Record<string, string> = {
  quiz: '📝', lab: '🧪', assignment: '📋', project: '📁', exam: '📄'
}

export function QuizCard({ quiz, submissions, totalStudents = 0, isFaculty, courses = [], onToggle, onReleaseResults, onCopy, onViewResults, onEdit, onDelete, onTake, mySubmission, attemptsUsed }: QuizCardProps) {
  const [copying, setCopying] = useState(false)
  const [copyTarget, setCopyTarget] = useState('')
  const [copyLoading, setCopyLoading] = useState(false)
  const otherCourses = courses.filter(c => c.id !== quiz.course_id)
  const questionCount = quiz.questions?.length ?? 0
  const submittedCount = submissions?.length ?? 0
  const submissionPct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0
  const progressPct = isFaculty ? submissionPct : (mySubmission?.score ?? 0)
  const typeIcon = TYPE_ICONS[quiz.item_type ?? 'quiz'] ?? '📝'
  const itemType = quiz.item_type ?? 'quiz'
  const isFirstAttempt = (attemptsUsed ?? 0) === 0
  const START_LABELS: Record<string, string> = {
    quiz: 'Start Quiz', lab: 'Start Lab', assignment: 'Submit',
    project: 'Submit', exam: 'Start Exam',
  }
  const RETRY_LABELS: Record<string, string> = {
    assignment: 'Resubmit', project: 'Resubmit',
  }
  const actionLabel = isFirstAttempt
    ? (START_LABELS[itemType] ?? 'Start')
    : (RETRY_LABELS[itemType] ?? 'Retake')

  return (
    <div style={{
      padding: '1rem 1.25rem', background: '#fff',
      border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '14px', marginBottom: '10px',
    }}>
      {/* Top row: icon + info + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: quiz.is_open ? '#FAEEDA' : '#E6F1FB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
        }}>
          {typeIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{quiz.title}</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>
            {questionCount} question{questionCount !== 1 ? 's' : ''}
            {isFaculty ? ` · ${submittedCount}/${totalStudents} submitted` : ''}
            {quiz.due_date ? ` · Due ${new Date(quiz.due_date).toLocaleDateString()}` : ''}
            {quiz.max_attempts && quiz.max_attempts > 1 ? ` · ${quiz.max_attempts} attempts` : ''}
          </div>
          {(isFaculty || mySubmission) && (
            <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px', marginTop: '8px' }}>
              <div style={{ height: '100%', width: progressPct + '%', background: '#1D9E75', borderRadius: '999px' }} />
            </div>
          )}
        </div>
        <Badge label={quiz.is_open ? 'Open' : 'Closed'} color={quiz.is_open ? 'amber' : 'green'} />
      </div>

      {/* Bottom row: action buttons */}
      {isFaculty && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button onClick={() => onEdit?.(quiz)}>Edit</Button>
          <Button onClick={() => onToggle?.(quiz.id, !quiz.is_open)}>
            {quiz.is_open ? 'Close' : 'Open'}
          </Button>
          <Button onClick={() => onViewResults?.(quiz)}>Submissions</Button>
          <Button
            onClick={() => onReleaseResults?.(quiz.id, !quiz.results_visible)}
            style={{ background: quiz.results_visible ? '#E1F5EE' : undefined, color: quiz.results_visible ? '#0F6E56' : undefined }}
          >
            {quiz.results_visible ? 'Results visible' : 'Release results'}
          </Button>
          {otherCourses.length > 0 && !copying && (
            <Button onClick={() => { setCopying(true); setCopyTarget(otherCourses[0].id) }}>Copy to...</Button>
          )}
          {copying && (
            <>
              <select
                value={copyTarget}
                onChange={e => setCopyTarget(e.target.value)}
                style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.2)' }}
              >
                {otherCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
                ))}
              </select>
              <Button
                variant="primary"
                disabled={copyLoading}
                onClick={async () => {
                  setCopyLoading(true)
                  try { await onCopy?.(quiz.id, copyTarget) } finally {
                    setCopyLoading(false); setCopying(false)
                  }
                }}
              >
                {copyLoading ? 'Copying...' : 'Copy'}
              </Button>
              <Button onClick={() => setCopying(false)}>Cancel</Button>
            </>
          )}
          <Button variant="danger" onClick={() => onDelete?.(quiz)}>Delete</Button>
        </div>
      )}
      {!isFaculty && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '8px' }}>
          {quiz.is_open && (attemptsUsed ?? 0) < (quiz.max_attempts ?? 1) && (
            <Button variant="primary" onClick={() => onTake?.(quiz)}>
              {actionLabel}
            </Button>
          )}
          {mySubmission && (
            <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
              {quiz.results_visible
                ? <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F6E56' }}>
                    {mySubmission.earned_points ?? mySubmission.score} {mySubmission.total_points ? `/ ${mySubmission.total_points} pts` : '%'}
                  </div>
                : <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>Results pending</div>
              }
              <div style={{ fontSize: '11px', color: '#888' }}>
                {attemptsUsed ?? 0}/{quiz.max_attempts ?? 1} attempt{(quiz.max_attempts ?? 1) !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          {!mySubmission && !quiz.is_open && (
            <Badge label="Closed" color="green" />
          )}
          {(attemptsUsed ?? 0) >= (quiz.max_attempts ?? 1) && mySubmission && (
            <Badge label="Submitted" color="green" />
          )}
        </div>
      )}
    </div>
  )
}
