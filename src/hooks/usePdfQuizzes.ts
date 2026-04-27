import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcScore } from '../utils/gradeCalculations'
import { withTimeout } from '../utils/withTimeout'
import { fireQuizOpenEmail } from './useNotifications'
import type { PdfQuiz, PdfQuizSubmission, PdfQuizFormData, Profile } from '../types'

export function usePdfQuizzes() {
  const [pdfQuizzes, setPdfQuizzes] = useState<PdfQuiz[]>([])
  const [submissions, setSubmissions] = useState<PdfQuizSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPdfQuizzes()
    const channel = supabase
      .channel('pdf-quizzes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pdf_quizzes' }, fetchPdfQuizzes)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchPdfQuizzes() {
    try {
      setError(null)
      const { data, error: err } = await supabase
        .from('pdf_quizzes')
        .select('*, answer_key:pdf_quiz_answer_key(*), essay_rubrics:pdf_quiz_essay_rubric(*)')
        .order('created_at', { ascending: false })
      if (err) throw err
      setPdfQuizzes(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF quizzes')
    } finally {
      setLoading(false)
    }
  }

  async function fetchAllSubmissions() {
    const { data } = await supabase.from('pdf_quiz_submissions').select('*')
    setSubmissions(data || [])
  }

  async function fetchMySubmissions(studentId: string) {
    const { data } = await supabase
      .from('pdf_quiz_submissions').select('*').eq('student_id', studentId)
    setSubmissions(data || [])
  }

  async function createPdfQuiz(file: File | undefined, formData: PdfQuizFormData, userId: string): Promise<string> {
    let pdfPath: string | null = null

    if (file) {
      const ext = file.name.split('.').pop()
      pdfPath = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await withTimeout(120_000, supabase.storage
        .from('pdf-quizzes').upload(pdfPath, file, { upsert: false }))
      if (uploadErr) throw uploadErr
    }

    const totalPoints = formData.answerKey.reduce((s, k) => s + k.points, 0)

    const { data: quiz, error: insertErr } = await supabase
      .from('pdf_quizzes')
      .insert({
        title: formData.title,
        course_id: formData.courseId,
        grade_group_id: formData.gradeGroupId,
        instructions: formData.instructions,
        pdf_path: pdfPath,
        due_date: formData.dueDate,
        open_at: formData.openAt,
        close_at: formData.closeAt,
        max_attempts: formData.maxAttempts,
        num_questions: formData.answerKey.length,
        total_points: totalPoints,
        created_by: userId,
      })
      .select().single()
    if (insertErr) throw insertErr

    if (formData.answerKey.length > 0) {
      await supabase.from('pdf_quiz_answer_key').insert(
        formData.answerKey.map(k => ({ ...k, pdf_quiz_id: quiz.id }))
      )
    }

    await saveRubricRows(quiz.id, formData.rubrics)
    await fetchPdfQuizzes()
    return quiz.id
  }

  async function updatePdfQuiz(id: string, formData: PdfQuizFormData, newFile?: File, userId?: string) {
    const existing = pdfQuizzes.find(q => q.id === id)
    let pdfPath = existing?.pdf_path ?? ''

    if (newFile && userId) {
      const ext = newFile.name.split('.').pop()
      const path = `${userId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await withTimeout(120_000, supabase.storage
        .from('pdf-quizzes').upload(path, newFile, { upsert: false }))
      if (uploadErr) throw uploadErr
      if (existing?.pdf_path) await supabase.storage.from('pdf-quizzes').remove([existing.pdf_path])
      pdfPath = path
    }

    const totalPoints = formData.answerKey.reduce((s, k) => s + k.points, 0)

    await supabase.from('pdf_quizzes').update({
      title: formData.title,
      course_id: formData.courseId,
      grade_group_id: formData.gradeGroupId,
      pdf_path: pdfPath,
      due_date: formData.dueDate,
      open_at: formData.openAt,
      close_at: formData.closeAt,
      open_notif_sent: false,
      reminder_notif_sent: false,
      max_attempts: formData.maxAttempts,
      num_questions: formData.answerKey.length,
      total_points: totalPoints,
      instructions: formData.instructions,
    }).eq('id', id)
    await supabase.from('grade_columns').update({ title: formData.title }).eq('linked_quiz_id', id)

    await supabase.from('pdf_quiz_answer_key').delete().eq('pdf_quiz_id', id)
    if (formData.answerKey.length > 0) {
      await supabase.from('pdf_quiz_answer_key').insert(
        formData.answerKey.map(k => ({ ...k, pdf_quiz_id: id }))
      )
    }

    await supabase.from('pdf_quiz_essay_rubric').delete().eq('pdf_quiz_id', id)
    await saveRubricRows(id, formData.rubrics)
    await fetchPdfQuizzes()
  }

  async function saveRubricRows(
    quizId: string,
    rubrics: PdfQuizFormData['rubrics'],
  ) {
    const rows = rubrics.flatMap(r =>
      r.categories.map((cat, i) => ({
        pdf_quiz_id: quizId,
        question_number: r.question_number,
        category_name: cat.category_name,
        max_points: cat.max_points,
        order_index: i,
      }))
    )
    if (rows.length > 0) await supabase.from('pdf_quiz_essay_rubric').insert(rows)
  }

  async function deletePdfQuiz(id: string) {
    const quiz = pdfQuizzes.find(q => q.id === id)
    if (quiz?.pdf_path) await supabase.storage.from('pdf-quizzes').remove([quiz.pdf_path])
    await supabase.from('grade_columns').delete().eq('linked_quiz_id', id)
    await supabase.from('pdf_quizzes').delete().eq('id', id)
    await fetchPdfQuizzes()
  }

  async function togglePdfQuiz(id: string, isOpen: boolean) {
    const quiz = pdfQuizzes.find(q => q.id === id)
    const updates: Record<string, unknown> = { is_open: isOpen }
    if (isOpen && quiz?.close_at && new Date(quiz.close_at) <= new Date()) {
      updates.close_at = null
    }
    await supabase.from('pdf_quizzes').update(updates).eq('id', id)
    await fetchPdfQuizzes()
    if (!isOpen) return // only notify students when opening
    const { data: { session } } = await supabase.auth.getSession()

    // In-app notification
    if (quiz?.course_id) {
      const [{ data: enrollments }, { data: course }] = await Promise.all([
        supabase.from('course_enrollments').select('student_id').eq('course_id', quiz.course_id),
        supabase.from('courses').select('name, section').eq('id', quiz.course_id).single(),
      ])
      const ids = (enrollments ?? []).map((e: { student_id: string }) => e.student_id).filter(Boolean)
      const courseName = course ? `${course.name}${course.section ? ` · Section ${course.section}` : ''}` : ''
      if (ids.length > 0) {
        await supabase.from('notifications').insert(
          ids.map(uid => ({
            user_id: uid,
            title: `${quiz.title} is now open`,
            body: `Paper assessment is now available${courseName ? ` for ${courseName}` : ''}. Head to Assessments to begin.`,
            type: 'quiz_open',
            related_id: id,
          }))
        )
      }
    }

    // Email notification
    if (session) fireQuizOpenEmail(session.access_token, id, true)
  }

  // Used by students taking the quiz online
  async function submitPdfQuiz(
    quizId: string,
    studentId: string,
    answers: Record<string, string>,
  ): Promise<{ earned: number; total: number; score: number }> {
    const quiz = pdfQuizzes.find(q => q.id === quizId)
    const key = (quiz?.answer_key ?? []).filter(k => k.question_type !== 'essay')
    const { earned } = scoreObjective(key, answers)
    const total = quiz?.total_points ?? 0
    const score = calcScore(earned, total)

    const { data: prior } = await supabase
      .from('pdf_quiz_submissions').select('id')
      .eq('pdf_quiz_id', quizId).eq('student_id', studentId)
    const attemptNumber = (prior?.length ?? 0) + 1

    await supabase.from('pdf_quiz_submissions').insert({
      pdf_quiz_id: quizId, student_id: studentId,
      answers, earned_points: earned, score, attempt_number: attemptNumber,
    })
    await fetchMySubmissions(studentId)
    return { earned, total, score }
  }

  // Used by faculty after scanning a student's paper answer sheet
  async function saveScannedAnswers(
    quizId: string,
    studentId: string,
    answers: Record<string, string>,
  ): Promise<PdfQuizSubmission> {
    const quiz = pdfQuizzes.find(q => q.id === quizId)
    const objKey = (quiz?.answer_key ?? []).filter(k => k.question_type !== 'essay')
    const { earned } = scoreObjective(objKey, answers)

    // total for now is just objective (essay not yet graded)
    const total = quiz?.total_points ?? 0
    const score = calcScore(earned, total)

    const { data: prior } = await supabase
      .from('pdf_quiz_submissions').select('id')
      .eq('pdf_quiz_id', quizId).eq('student_id', studentId)
    const attemptNumber = (prior?.length ?? 0) + 1

    const { data: sub, error } = await supabase
      .from('pdf_quiz_submissions')
      .insert({
        pdf_quiz_id: quizId, student_id: studentId,
        answers, earned_points: earned, score, attempt_number: attemptNumber,
      })
      .select().single()
    if (error) throw error

    await fetchAllSubmissions()
    return sub as PdfQuizSubmission
  }

  // Used by faculty to manually score essay questions
  async function saveEssayScores(
    submissionId: string,
    quizId: string,
    _studentId: string,
    essayScores: Record<string, Record<string, number>>,
  ) {
    const quiz = pdfQuizzes.find(q => q.id === quizId)
    const rubrics = quiz?.essay_rubrics ?? []

    // Recalculate earned: objective score from existing answers + new essay score
    const { data: existing } = await supabase
      .from('pdf_quiz_submissions').select('*').eq('id', submissionId).single()

    const objKey = (quiz?.answer_key ?? []).filter(k => k.question_type !== 'essay')
    const { earned: objEarned } = scoreObjective(objKey, existing?.answers ?? {})

    let essayEarned = 0
    for (const qNum of Object.keys(essayScores)) {
      for (const rubricId of Object.keys(essayScores[qNum])) {
        const rubric = rubrics.find(r => r.id === rubricId)
        const earned = Math.min(essayScores[qNum][rubricId], rubric?.max_points ?? 0)
        essayEarned += earned
      }
    }

    const totalEarned = objEarned + essayEarned
    const total = quiz?.total_points ?? 0
    const score = total > 0 ? Math.round((totalEarned / total) * 100) : 0

    await supabase.from('pdf_quiz_submissions').update({
      essay_scores: essayScores,
      earned_points: totalEarned,
      score,
    }).eq('id', submissionId)

    await fetchAllSubmissions()
    return { earned: totalEarned, total, score }
  }

  // Create a submission with ONLY essay scores (student has no objective answers)
  async function createEssaySubmission(
    quizId: string,
    studentId: string,
    essayScores: Record<string, Record<string, number>>,
  ) {
    const quiz = pdfQuizzes.find(q => q.id === quizId)
    const rubrics = quiz?.essay_rubrics ?? []

    let essayEarned = 0
    for (const qNum of Object.keys(essayScores)) {
      for (const rubricId of Object.keys(essayScores[qNum])) {
        const rubric = rubrics.find(r => r.id === rubricId)
        essayEarned += Math.min(essayScores[qNum][rubricId], rubric?.max_points ?? 0)
      }
    }

    const total = quiz?.total_points ?? 0
    const score = total > 0 ? Math.round((essayEarned / total) * 100) : 0

    const { data: prior } = await supabase
      .from('pdf_quiz_submissions').select('id')
      .eq('pdf_quiz_id', quizId).eq('student_id', studentId)
    const attemptNumber = (prior?.length ?? 0) + 1

    await supabase.from('pdf_quiz_submissions').insert({
      pdf_quiz_id: quizId, student_id: studentId,
      answers: {}, essay_scores: essayScores,
      earned_points: essayEarned, score, attempt_number: attemptNumber,
    })
    await fetchAllSubmissions()
    return { earned: essayEarned, total, score }
  }

  function scoreObjective(
    key: PdfQuizAnswerKeyEntry[],
    answers: Record<string, string>,
  ): { earned: number } {
    let earned = 0
    for (const entry of key) {
      const given = (answers[String(entry.question_number)] ?? '').trim().toLowerCase()
      const correct = entry.correct_answer.trim().toLowerCase()
      if (given === correct) earned += entry.points
    }
    return { earned }
  }

  function getPdfUrl(pdfPath: string | null): string | null {
    if (!pdfPath) return null
    return supabase.storage.from('pdf-quizzes').getPublicUrl(pdfPath).data.publicUrl
  }

  async function downloadScoresCsv(pdfQuiz: PdfQuiz, quizSubmissions: PdfQuizSubmission[], students: Profile[]) {
    const rubrics = pdfQuiz.essay_rubrics ?? []
    const essayQNums = [...new Set(rubrics.map(r => r.question_number))].sort((a, b) => a - b)

    const rubricCols = essayQNums.flatMap(qNum => {
      const cats = rubrics.filter(r => r.question_number === qNum).sort((a, b) => a.order_index - b.order_index)
      return cats.map(c => `Q${qNum} – ${c.category_name} (/${c.max_points})`)
    })

    const headers = [
      'Last Name', 'First Name', 'Email',
      'Earned Points', `Total Points (${pdfQuiz.total_points})`, 'Score %',
      'Attempts', 'Submitted At',
      ...rubricCols,
    ]

    const rows = students.map(student => {
      const subs = quizSubmissions.filter(s => s.student_id === student.id)
      const best = subs.length > 0
        ? subs.reduce((b, s) => s.earned_points > b.earned_points ? s : b)
        : null

      const essayCols = essayQNums.flatMap(qNum => {
        const cats = rubrics.filter(r => r.question_number === qNum).sort((a, b) => a.order_index - b.order_index)
        return cats.map(c => best?.essay_scores?.[String(qNum)]?.[c.id] ?? '')
      })

      return [
        student.last_name, student.first_name, student.email,
        best ? best.earned_points : '',
        pdfQuiz.total_points,
        best ? `${best.score}%` : '',
        subs.length,
        best ? new Date(best.submitted_at).toLocaleString() : '',
        ...essayCols,
      ]
    })

    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Scores')
    XLSX.writeFile(wb, `${pdfQuiz.title.replace(/[^a-z0-9]/gi, '_')}_scores.csv`, { bookType: 'csv' })
  }

  async function releaseResults(id: string, visible: boolean) {
    await supabase.from('pdf_quizzes').update({ results_visible: visible }).eq('id', id)
    await fetchPdfQuizzes()
  }

  async function copyPdfQuiz(quizId: string, targetCourseId: string, userId: string) {
    const quiz = pdfQuizzes.find(q => q.id === quizId)
    if (!quiz) throw new Error('PDF Quiz not found')
    const { data: newQuiz, error } = await supabase
      .from('pdf_quizzes')
      .insert({
        title: quiz.title,
        course_id: targetCourseId,
        grade_group_id: quiz.grade_group_id,
        instructions: quiz.instructions ?? null,
        pdf_path: quiz.pdf_path,
        due_date: null,
        open_at: null,
        close_at: null,
        max_attempts: quiz.max_attempts,
        num_questions: quiz.num_questions,
        total_points: quiz.total_points,
        created_by: userId,
        is_open: false,
        results_visible: false,
      })
      .select().single()
    if (error) throw error
    const key = quiz.answer_key ?? []
    if (key.length > 0) {
      await supabase.from('pdf_quiz_answer_key').insert(
        key.map(k => ({
          pdf_quiz_id: newQuiz.id,
          question_number: k.question_number,
          question_type: k.question_type,
          correct_answer: k.correct_answer,
          points: k.points,
        }))
      )
    }
    const rubrics = quiz.essay_rubrics ?? []
    if (rubrics.length > 0) {
      await supabase.from('pdf_quiz_essay_rubric').insert(
        rubrics.map(r => ({
          pdf_quiz_id: newQuiz.id,
          question_number: r.question_number,
          category_name: r.category_name,
          max_points: r.max_points,
          order_index: r.order_index,
        }))
      )
    }
    await fetchPdfQuizzes()
    return newQuiz.id
  }

  return {
    pdfQuizzes, submissions, loading, error,
    fetchAllSubmissions, fetchMySubmissions,
    createPdfQuiz, updatePdfQuiz, deletePdfQuiz, togglePdfQuiz,
    submitPdfQuiz, saveScannedAnswers, saveEssayScores, createEssaySubmission,
    getPdfUrl, downloadScoresCsv, releaseResults, copyPdfQuiz,
  }
}

// Re-export type used in scoreObjective so callers can import from hook
import type { PdfQuizAnswerKeyEntry } from '../types'
