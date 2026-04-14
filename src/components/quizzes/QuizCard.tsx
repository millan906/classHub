import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { Quiz, QuizSubmission } from '../../types'

interface QuizCardProps {
  quiz: Quiz
  submissions?: QuizSubmission[]
  totalStudents?: number
  isFaculty?: boolean
  onToggle?: (id: string, isOpen: boolean) => void
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

export function QuizCard({ quiz, submissions, totalStudents = 0, isFaculty, onToggle, onViewResults, onEdit, onDelete, onTake, mySubmission, attemptsUsed }: QuizCardProps) {
  const questionCount = quiz.questions?.length ?? 0
  const submittedCount = submissions?.length ?? 0
  const submissionPct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0
  const progressPct = isFaculty ? submissionPct : (mySubmission?.score ?? 0)
  const typeIcon = TYPE_ICONS[quiz.item_type ?? 'quiz'] ?? '📝'
  const actionLabel = quiz.item_type && quiz.item_type !== 'quiz' ? 'Open' :
    (attemptsUsed ?? 0) === 0 ? 'Take quiz' : 'Retake'

  return (
    <div style={{
      padding: '0.875rem 1rem', background: '#fff',
      border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', marginBottom: '8px',
    }}>
      {/* Top row: icon + info + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: quiz.is_open ? '#FAEEDA' : '#E6F1FB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '17px', flexShrink: 0,
        }}>
          {typeIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{quiz.title}</div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>
            {questionCount} question{questionCount !== 1 ? 's' : ''}
            {isFaculty ? ` · ${submittedCount}/${totalStudents} submitted` : ''}
            {quiz.due_date ? ` · Due ${new Date(quiz.due_date).toLocaleDateString()}` : ''}
            {quiz.max_attempts && quiz.max_attempts > 1 ? ` · ${quiz.max_attempts} attempts` : ''}
          </div>
          {(isFaculty || mySubmission) && (
            <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px', marginTop: '6px' }}>
              <div style={{ height: '100%', width: progressPct + '%', background: '#1D9E75', borderRadius: '999px' }} />
            </div>
          )}
        </div>
        <Badge label={quiz.is_open ? 'Open' : 'Closed'} color={quiz.is_open ? 'amber' : 'green'} />
      </div>

      {/* Bottom row: action buttons */}
      {isFaculty && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          <Button onClick={() => onEdit?.(quiz)}>Edit</Button>
          <Button onClick={() => onToggle?.(quiz.id, !quiz.is_open)}>
            {quiz.is_open ? 'Close' : 'Open'}
          </Button>
          <Button onClick={() => onViewResults?.(quiz)}>Results</Button>
          <Button variant="danger" onClick={() => onDelete?.(quiz)}>Delete</Button>
        </div>
      )}
      {!isFaculty && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
          {quiz.is_open && (attemptsUsed ?? 0) < (quiz.max_attempts ?? 1) && (
            <Button variant="primary" onClick={() => onTake?.(quiz)}>
              {actionLabel}
            </Button>
          )}
          {mySubmission && (
            <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F6E56' }}>
                {mySubmission.earned_points ?? mySubmission.score} {mySubmission.total_points ? `/ ${mySubmission.total_points} pts` : '%'}
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                {attemptsUsed ?? 0}/{quiz.max_attempts ?? 1} attempt{(quiz.max_attempts ?? 1) !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          {!mySubmission && !quiz.is_open && (
            <Badge label="Closed" color="green" />
          )}
          {(attemptsUsed ?? 0) >= (quiz.max_attempts ?? 1) && mySubmission && (
            <Badge label="Done" color="green" />
          )}
        </div>
      )}
    </div>
  )
}
