import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useSlides } from '../../hooks/useSlides'
import { useStudents } from '../../hooks/useStudents'
import { useCourses } from '../../hooks/useCourses'
import { TYPE_ORDER } from '../../constants/itemTypes'
import { useGradeBook } from '../../hooks/useGradeBook'
import { usePdfQuizzes } from '../../hooks/usePdfQuizzes'
import { PageHeader } from '../../components/ui/Card'
import { Spinner, PageError } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { QuizCard } from '../../components/quizzes/QuizCard'
import { QuizBuilder } from '../../components/quizzes/QuizBuilder'
import { QuizResults } from '../../components/quizzes/QuizResults'
import { ManualEntriesSection } from '../../components/quizzes/ManualEntriesSection'
import { PdfQuizCard } from '../../components/pdfquizzes/PdfQuizCard'
import { PdfQuizBuilder } from '../../components/pdfquizzes/PdfQuizBuilder'
import { PdfQuizResults } from '../../components/pdfquizzes/PdfQuizResults'
import type { Quiz, FileSubmission, QuizFormData, PdfQuiz, PdfQuizFormData } from '../../types'

export default function FacultyQuizzes() {
  const { profile } = useAuth()
  const { quizzes, submissions, loading, error, createQuiz, updateQuiz, deleteQuiz, toggleQuiz, fetchAllSubmissions, fetchFileSubmissions, saveEssayScores } = useQuizzes()
  const { slides } = useSlides()
  const { students } = useStudents()
  const { courses } = useCourses()
  const { groups, columns, entries, addColumn, findOrCreateLinkedColumn, updateColumnMaxScore, deleteColumn, upsertEntry } = useGradeBook()
  const { pdfQuizzes, submissions: pdfSubmissions, fetchAllSubmissions: fetchAllPdfSubmissions, uploadAndCreate, updatePdfQuiz, deletePdfQuiz, togglePdfQuiz, saveScannedAnswers, saveEssayScores: savePdfEssayScores, createEssaySubmission, downloadScoresCsv } = usePdfQuizzes()
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null)
  const [viewingResults, setViewingResults] = useState<Quiz | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Quiz | null>(null)
  const [fileSubmissions, setFileSubmissions] = useState<FileSubmission[]>([])
  const [filterCourseId, setFilterCourseId] = useState<string>('all')
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set())
  const [showPdfBuilder, setShowPdfBuilder] = useState(false)
  const [editingPdfQuiz, setEditingPdfQuiz] = useState<PdfQuiz | null>(null)
  const [viewingPdfResults, setViewingPdfResults] = useState<PdfQuiz | null>(null)
  const [confirmDeletePdf, setConfirmDeletePdf] = useState<PdfQuiz | null>(null)
  const [pdfSectionCollapsed, setPdfSectionCollapsed] = useState(false)

  useEffect(() => { fetchAllSubmissions() }, [])
  useEffect(() => { fetchAllPdfSubmissions() }, [])

  useEffect(() => {
    if (!viewingResults) return
    if (viewingResults.allow_file_upload) {
      fetchFileSubmissions(viewingResults.id).then(setFileSubmissions)
    } else {
      setFileSubmissions([])
    }

    if (!viewingResults.grade_group_id || !profile) return

    const quiz = viewingResults
    const questions = quiz.questions ?? []
    const hasEssay = questions.some(q => q.type === 'essay')
    const correctMax = questions.length > 0
      ? questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0)
      : 100
    const quizSubs = submissions.filter(s => s.quiz_id === quiz.id)

    async function syncToGradebook() {
      try {
        const col = await findOrCreateLinkedColumn(
          quiz.id, quiz.title, quiz.grade_group_id!, correctMax, profile!.id,
        )
        if (col.max_score !== correctMax) await updateColumnMaxScore(col.id, correctMax)
        await Promise.all(
          quizSubs
            .filter(sub => !hasEssay || sub.essay_scores)
            .map(sub => upsertEntry(col.id, sub.student_id, sub.earned_points ?? 0))
        )
      } catch (err) {
        console.error('[GradeBook] syncToGradebook failed:', err)
      }
    }
    syncToGradebook()
  }, [viewingResults?.id])

  const enrolled = students.filter(s => s.status === 'approved')

  function computeMaxScore(data: QuizFormData): number {
    return data.questions.length > 0
      ? data.questions.reduce((sum, q) => sum + (q.points ?? 1), 0)
      : 100
  }

  async function handleCreate(data: QuizFormData) {
    if (!profile) return
    const quizId = await createQuiz(data, profile.id)
    if (data.gradeGroupId) {
      await addColumn(data.title, data.gradeGroupId, computeMaxScore(data), profile.id, data.description, 'quiz_linked', quizId)
    }
    setShowBuilder(false)
  }

  async function handleUpdate(quizId: string, data: QuizFormData) {
    await updateQuiz(quizId, data)
    if (data.gradeGroupId && profile) {
      const maxScore = computeMaxScore(data)
      try {
        const col = await findOrCreateLinkedColumn(
          quizId, data.title, data.gradeGroupId, maxScore, profile.id,
        )
        if (col.max_score !== maxScore) {
          await updateColumnMaxScore(col.id, maxScore)
        }
      } catch (err) {
        console.error('[GradeBook] handleUpdate sync failed:', err)
      }
    }
    setEditingQuiz(null)
  }

  async function handleSaveEssayScores(
    submissionId: string,
    studentId: string,
    essayScores: Record<string, number>,
    earned: number,
    total: number,
  ) {
    await saveEssayScores(submissionId, essayScores, earned, total)
    if (!viewingResults || !profile || !viewingResults.grade_group_id) return

    try {
      // Use a live DB query — never rely on potentially-stale columns state.
      const col = await findOrCreateLinkedColumn(
        viewingResults.id, viewingResults.title, viewingResults.grade_group_id, total > 0 ? total : 100, profile.id,
      )
      if (col.max_score !== total && total > 0) await updateColumnMaxScore(col.id, total)
      await upsertEntry(col.id, studentId, earned)
    } catch (err) {
      console.error('[GradeBook] handleSaveEssayScores failed:', err)
    }
  }

  async function handleCreatePdf(file: File | undefined, formData: PdfQuizFormData) {
    if (!profile || !file) return
    const quizId = await uploadAndCreate(file, formData, profile.id)
    if (formData.gradeGroupId) {
      const totalPoints = formData.answerKey.reduce((s, k) => s + k.points, 0)
      await addColumn(formData.title, formData.gradeGroupId, totalPoints, profile.id, null, 'quiz_linked', quizId)
    }
    setShowPdfBuilder(false)
  }

  async function handleUpdatePdf(file: File | undefined, formData: PdfQuizFormData) {
    if (!editingPdfQuiz || !profile) return
    await updatePdfQuiz(editingPdfQuiz.id, formData, file, profile.id)
    setEditingPdfQuiz(null)
  }

  async function syncPdfToGradebook(quiz: PdfQuiz, studentId: string, earned: number) {
    if (!quiz.grade_group_id || !profile) return
    try {
      const col = await findOrCreateLinkedColumn(
        quiz.id, quiz.title, quiz.grade_group_id, quiz.total_points, profile.id,
      )
      if (col.max_score !== quiz.total_points) await updateColumnMaxScore(col.id, quiz.total_points)
      await upsertEntry(col.id, studentId, earned)
    } catch (err) {
      console.error('[GradeBook] PDF quiz sync failed:', err)
    }
  }

  async function handlePdfScanAnswers(studentId: string, answers: Record<string, string>) {
    if (!viewingPdfResults) return
    const sub = await saveScannedAnswers(viewingPdfResults.id, studentId, answers)
    // Only log to gradebook if there are no essay questions.
    // If there are essays, hold off until essay scores are saved.
    const hasEssay = (viewingPdfResults.answer_key ?? []).some(k => k.question_type === 'essay')
    if (!hasEssay) {
      await syncPdfToGradebook(viewingPdfResults, studentId, sub.earned_points)
    }
  }

  async function handlePdfEssayScores(
    submissionId: string | null,
    studentId: string,
    essayScores: Record<string, Record<string, number>>,
  ) {
    if (!viewingPdfResults) return
    let earned: number
    if (submissionId) {
      const result = await savePdfEssayScores(submissionId, viewingPdfResults.id, studentId, essayScores)
      earned = result.earned
    } else {
      const result = await createEssaySubmission(viewingPdfResults.id, studentId, essayScores)
      earned = result.earned
    }
    await syncPdfToGradebook(viewingPdfResults, studentId, earned)
  }

  if (loading) return <Spinner />
  if (error) return <PageError message={error} />

  if (viewingPdfResults) {
    const quizSubs = pdfSubmissions.filter(s => s.pdf_quiz_id === viewingPdfResults.id)
    return (
      <PdfQuizResults
        quiz={viewingPdfResults}
        submissions={quizSubs}
        enrolled={enrolled}
        onBack={() => setViewingPdfResults(null)}
        onDownloadCsv={() => downloadScoresCsv(viewingPdfResults, quizSubs, enrolled)}
        onScanAnswers={handlePdfScanAnswers}
        onSaveEssayScores={handlePdfEssayScores}
      />
    )
  }

  if (showPdfBuilder || editingPdfQuiz) {
    return (
      <div>
        <PageHeader
          title={editingPdfQuiz ? 'Edit PDF Quiz' : 'New PDF Quiz'}
          subtitle="Upload a PDF and define the answer key."
        />
        <PdfQuizBuilder
          courses={courses}
          groups={groups}
          onSave={editingPdfQuiz ? handleUpdatePdf : handleCreatePdf}
          onCancel={() => { setShowPdfBuilder(false); setEditingPdfQuiz(null) }}
          initialQuiz={editingPdfQuiz ?? undefined}
        />
      </div>
    )
  }

  if (viewingResults) {
    const quizSubs = submissions.filter(s => s.quiz_id === viewingResults.id)
    return (
      <QuizResults
        quiz={viewingResults}
        submissions={quizSubs}
        enrolled={enrolled}
        fileSubmissions={fileSubmissions}
        onBack={() => setViewingResults(null)}
        onSaveEssayScores={handleSaveEssayScores}
      />
    )
  }

  if (editingQuiz) {
    return (
      <div>
        <PageHeader title="Edit" subtitle="Update your item." />
        <QuizBuilder
          slides={slides}
          courses={courses}
          groups={groups}
          onCreate={handleCreate}
          onCancel={() => setEditingQuiz(null)}
          initialQuiz={editingQuiz}
          onUpdate={handleUpdate}
        />
      </div>
    )
  }

  if (showBuilder) {
    return (
      <div>
        <PageHeader title="Create" subtitle="Build a quiz or log a lab, assignment, project, or exam." />
        <QuizBuilder
          slides={slides}
          courses={courses}
          groups={groups}
          onCreate={handleCreate}
          onCancel={() => setShowBuilder(false)}
        />
      </div>
    )
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete quiz"
          message={`Delete "${confirmDelete.title}"? This will also remove all student submissions and cannot be undone.`}
          onConfirm={async () => { await deleteQuiz(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {confirmDeletePdf && (
        <ConfirmDialog
          title="Delete PDF quiz"
          message={`Delete "${confirmDeletePdf.title}"? This will also remove the PDF file and all student submissions and cannot be undone.`}
          onConfirm={async () => { await deletePdfQuiz(confirmDeletePdf.id); setConfirmDeletePdf(null) }}
          onCancel={() => setConfirmDeletePdf(null)}
        />
      )}

      <PageHeader title="Assessments" subtitle="Create and manage quizzes, assignments, exams, and grade entries." />

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px', flexWrap: 'wrap' }}>
        <select
          value={filterCourseId}
          onChange={e => setFilterCourseId(e.target.value)}
          style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer' }}
        >
          <option value="all">All Courses</option>
          <option value="none">No Course</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · Section ${c.section}` : ''}</option>
          ))}
        </select>
        <Button variant="primary" onClick={() => setShowBuilder(true)}>+ Create</Button>
      </div>

      {(() => {
        const filtered = quizzes.filter(q => {
          if (filterCourseId === 'all') return true
          if (filterCourseId === 'none') return !q.course_id
          return q.course_id === filterCourseId
        })

        const grouped = TYPE_ORDER.map(({ type, label }) => ({
          type, label,
          items: filtered.filter(q => (q.item_type ?? 'quiz') === type),
        })).filter(g => g.items.length > 0)

        if (grouped.length === 0) {
          return <div style={{ fontSize: '13px', color: '#888' }}>No assessments yet.</div>
        }

        return grouped.map(({ type, label, items }) => {
          const isCollapsed = collapsedTypes.has(type)
          const toggle = () => setCollapsedTypes(prev => {
            const next = new Set(prev)
            if (next.has(type)) { next.delete(type) } else { next.add(type) }
            return next
          })
          return (
            <div key={type} style={{ marginBottom: '16px' }}>
              <button
                onClick={toggle}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 0', marginBottom: '8px', width: '100%', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '11px', color: '#888', transition: 'transform 0.15s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>({items.length})</span>
              </button>

              {!isCollapsed && items.map(quiz => {
                const quizCourse = quiz.course_id ? courses.find(c => c.id === quiz.course_id) : null
                return (
                  <div key={quiz.id}>
                    {quizCourse && filterCourseId === 'all' && (
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: '#E6F1FB', color: '#185FA5', display: 'inline-block' }}>
                          {quizCourse.name}{quizCourse.section ? ` · Section ${quizCourse.section}` : ''}
                        </span>
                      </div>
                    )}
                    <QuizCard
                      quiz={quiz}
                      submissions={submissions.filter(s => s.quiz_id === quiz.id)}
                      totalStudents={enrolled.length}
                      isFaculty
                      onToggle={toggleQuiz}
                      onEdit={setEditingQuiz}
                      onDelete={setConfirmDelete}
                      onViewResults={setViewingResults}
                    />
                  </div>
                )
              })}
            </div>
          )
        })
      })()}

      {/* PDF Quizzes section */}
      <div style={{ marginTop: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <button
            onClick={() => setPdfSectionCollapsed(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
          >
            <span style={{ fontSize: '11px', color: '#888', display: 'inline-block', transition: 'transform 0.15s', transform: pdfSectionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PDF Quizzes</span>
            <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 400 }}>
              ({pdfQuizzes.filter(q => filterCourseId === 'all' || (filterCourseId === 'none' ? !q.course_id : q.course_id === filterCourseId)).length})
            </span>
          </button>
          <Button variant="primary" onClick={() => setShowPdfBuilder(true)}>+ New PDF Quiz</Button>
        </div>

        {!pdfSectionCollapsed && (() => {
          const filtered = pdfQuizzes.filter(q => {
            if (filterCourseId === 'all') return true
            if (filterCourseId === 'none') return !q.course_id
            return q.course_id === filterCourseId
          })
          if (filtered.length === 0) {
            return <div style={{ fontSize: '13px', color: '#888' }}>No PDF quizzes yet.</div>
          }
          return filtered.map(quiz => {
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
                  totalStudents={enrolled.length}
                  isFaculty
                  onToggle={togglePdfQuiz}
                  onEdit={setEditingPdfQuiz}
                  onDelete={setConfirmDeletePdf}
                  onViewResults={setViewingPdfResults}
                />
              </div>
            )
          })
        })()}
      </div>

      <ManualEntriesSection
        columns={columns}
        groups={groups}
        enrolled={enrolled}
        entries={entries}
        onSaveScore={upsertEntry}
        onDeleteColumn={deleteColumn}
      />
    </div>
  )
}
