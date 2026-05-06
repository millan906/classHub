import { useState } from 'react'
import { Button } from '../ui/Button'
import { PdfQuizCard } from './PdfQuizCard'
import type { PdfQuiz, PdfQuizSubmission, Course, Profile } from '../../types'

interface Props {
  pdfQuizzes: PdfQuiz[]
  pdfSubmissions: PdfQuizSubmission[]
  filterCourseId: string
  courses: Course[]
  enrolledForCourse: (courseId: string | null | undefined) => Profile[]
  onToggle: (id: string, open: boolean) => Promise<void>
  onReleaseResults: (id: string) => Promise<void>
  onCopy: (quizId: string, targetCourseId: string) => Promise<void>
  onEdit: (quiz: PdfQuiz) => void
  onDelete: (quiz: PdfQuiz) => void
  onViewResults: (quiz: PdfQuiz) => void
  onNew: () => void
}

export function PdfQuizSection({
  pdfQuizzes, pdfSubmissions, filterCourseId, courses,
  enrolledForCourse, onToggle, onReleaseResults, onCopy,
  onEdit, onDelete, onViewResults, onNew,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const filtered = pdfQuizzes.filter(q => {
    if (filterCourseId === 'all') return true
    if (filterCourseId === 'none') return !q.course_id
    return q.course_id === filterCourseId
  })

  return (
    <div style={{ marginTop: '24px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <button
          onClick={() => setCollapsed(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          <span style={{ fontSize: '11px', color: '#888', display: 'inline-block', transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PDF Quizzes</span>
          <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>({filtered.length})</span>
        </button>
        <Button variant="primary" onClick={onNew}>+ New PDF Quiz</Button>
      </div>

      {!collapsed && (
        filtered.length === 0
          ? <div style={{ fontSize: '13px', color: '#888' }}>No PDF quizzes yet.</div>
          : filtered.map(quiz => {
              const quizCourse = quiz.course_id ? courses.find(c => c.id === quiz.course_id) : null
              const quizSubs = pdfSubmissions.filter(s => s.pdf_quiz_id === quiz.id)
              return (
                <div key={quiz.id}>
                  {quizCourse && filterCourseId === 'all' && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: '#E6F1FB', color: '#185FA5', display: 'inline-block' }}>
                        {quizCourse.name}{quizCourse.section ? ` · Section ${quizCourse.section}` : ''}
                      </span>
                    </div>
                  )}
                  <PdfQuizCard
                    quiz={quiz}
                    submissions={quizSubs}
                    totalStudents={enrolledForCourse(quiz.course_id).length}
                    isFaculty
                    courses={courses}
                    onToggle={onToggle}
                    onReleaseResults={onReleaseResults}
                    onCopy={onCopy}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewResults={onViewResults}
                  />
                </div>
              )
            })
      )}
    </div>
  )
}
