import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { PdfQuiz, PdfQuizSubmission } from '../../types'

interface PdfQuizCardProps {
  quiz: PdfQuiz
  submissions?: PdfQuizSubmission[]
  totalStudents?: number
  isFaculty?: boolean
  onToggle?: (id: string, isOpen: boolean) => void
  onEdit?: (quiz: PdfQuiz) => void
  onDelete?: (quiz: PdfQuiz) => void
  onViewResults?: (quiz: PdfQuiz) => void
  onTake?: (quiz: PdfQuiz) => void
  mySubmission?: PdfQuizSubmission
  attemptsUsed?: number
}

export function PdfQuizCard({
  quiz, submissions, totalStudents = 0, isFaculty,
  onToggle, onEdit, onDelete, onViewResults, onTake,
  mySubmission, attemptsUsed,
}: PdfQuizCardProps) {
  const submittedCount = submissions?.length ?? 0
  const submissionPct = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0
  const progressPct = isFaculty ? submissionPct : (mySubmission?.score ?? 0)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '1rem 1.1rem', background: '#fff',
      border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', marginBottom: '8px',
    }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '8px',
        background: quiz.is_open ? '#FAEEDA' : '#E6F1FB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', flexShrink: 0,
      }}>
        📄
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{quiz.title}</div>
        <div style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>
          {quiz.num_questions} question{quiz.num_questions !== 1 ? 's' : ''}
          {' · '}{quiz.total_points} pts
          {isFaculty ? ` · ${submittedCount}/${totalStudents} submitted` : ''}
          {quiz.due_date ? ` · Due ${new Date(quiz.due_date).toLocaleDateString()}` : ''}
          {quiz.max_attempts > 1 ? ` · ${quiz.max_attempts} attempts` : ''}
        </div>
        {(isFaculty || mySubmission) && (
          <div style={{ height: '5px', background: '#F1EFE8', borderRadius: '999px', marginTop: '6px' }}>
            <div style={{ height: '100%', width: progressPct + '%', background: '#1D9E75', borderRadius: '999px' }} />
          </div>
        )}
      </div>

      <Badge label={quiz.is_open ? 'Open' : 'Closed'} color={quiz.is_open ? 'amber' : 'green'} />

      {isFaculty && (
        <>
          <Button onClick={() => onEdit?.(quiz)}>Edit</Button>
          <Button onClick={() => onToggle?.(quiz.id, !quiz.is_open)}>
            {quiz.is_open ? 'Close' : 'Open'}
          </Button>
          <Button onClick={() => onViewResults?.(quiz)}>Results</Button>
          <Button variant="danger" onClick={() => onDelete?.(quiz)}>Delete</Button>
        </>
      )}

      {!isFaculty && (
        <>
          {quiz.is_open && (attemptsUsed ?? 0) < quiz.max_attempts && (
            <Button variant="primary" onClick={() => onTake?.(quiz)}>
              {(attemptsUsed ?? 0) === 0 ? 'Start' : 'Retake'}
            </Button>
          )}
          {mySubmission && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F6E56' }}>
                {mySubmission.earned_points} / {quiz.total_points} pts
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>
                {attemptsUsed ?? 0}/{quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? 's' : ''}
              </div>
            </div>
          )}
          {!mySubmission && !quiz.is_open && (
            <Badge label="Closed" color="green" />
          )}
          {(attemptsUsed ?? 0) >= quiz.max_attempts && mySubmission && (
            <Badge label="Done" color="green" />
          )}
        </>
      )}
    </div>
  )
}
