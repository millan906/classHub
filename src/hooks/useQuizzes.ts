import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcScore } from '../utils/gradeCalculations'
import { fireQuizOpenEmail } from './useNotifications'
import type { Quiz, QuizSubmission, FileSubmission, QuizFormData } from '../types'

export function useQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQuizzes()
    const channel = supabase
      .channel('quizzes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, fetchQuizzes)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchQuizzes() {
    try {
      setError(null)
      const { data, error: err } = await supabase
        .from('quizzes')
        .select('*, questions:quiz_questions(*)')
        .order('created_at', { ascending: false })
      if (err) throw err
      setQuizzes(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessments')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMySubmissions(studentId: string) {
    const { data } = await supabase.from('quiz_submissions').select('*').eq('student_id', studentId)
    setSubmissions(data || [])
  }

  async function fetchAllSubmissions() {
    const { data } = await supabase.from('quiz_submissions').select('*')
    setSubmissions(data || [])
  }

  async function createQuiz(data: QuizFormData, userId: string): Promise<string> {
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .insert({
        title: data.title,
        course_id: data.courseId,
        slide_id: data.slideId,
        due_date: data.dueDate,
        open_at: data.openAt,
        close_at: data.closeAt,
        time_limit_minutes: data.timeLimitMinutes,
        lockdown_enabled: data.lockdownEnabled,
        max_attempts: data.maxAttempts,
        created_by: userId,
        item_type: data.itemType,
        grade_group_id: data.gradeGroupId,
        allow_file_upload: data.allowFileUpload,
        description: data.description,
      })
      .select()
      .single()
    if (error) throw error

    if (data.questions.length > 0) {
      await supabase.from('quiz_questions').insert(
        data.questions.map((q, i) => ({ ...q, quiz_id: quiz.id, order_index: i }))
      )
    }
    await fetchQuizzes()
    return quiz.id
  }

  async function updateQuiz(quizId: string, data: QuizFormData) {
    await supabase.from('quizzes').update({
      title: data.title,
      course_id: data.courseId,
      slide_id: data.slideId,
      due_date: data.dueDate,
      open_at: data.openAt,
      close_at: data.closeAt,
      open_notif_sent: false,
      reminder_notif_sent: false,
      time_limit_minutes: data.timeLimitMinutes,
      lockdown_enabled: data.lockdownEnabled,
      max_attempts: data.maxAttempts,
      allow_file_upload: data.allowFileUpload,
      description: data.description,
      grade_group_id: data.gradeGroupId,
    }).eq('id', quizId)
    await supabase.from('quiz_questions').delete().eq('quiz_id', quizId)
    if (data.questions.length > 0) {
      await supabase.from('quiz_questions').insert(
        data.questions.map((q, i) => ({ ...q, quiz_id: quizId, order_index: i }))
      )
    }
    await fetchQuizzes()
  }

  async function deleteQuiz(id: string) {
    await supabase.from('quiz_questions').delete().eq('quiz_id', id)
    await supabase.from('grade_columns').delete().eq('linked_quiz_id', id)
    await supabase.from('quizzes').delete().eq('id', id)
    await fetchQuizzes()
  }

  async function toggleQuiz(id: string, isOpen: boolean) {
    const quiz = quizzes.find(q => q.id === id)
    const updates: Record<string, unknown> = { is_open: isOpen }
    // If manually reopening after the deadline has passed, clear close_at so the
    // scheduler doesn't auto-close it again within the next minute.
    if (isOpen && quiz?.close_at && new Date(quiz.close_at) <= new Date()) {
      updates.close_at = null
    }
    await supabase.from('quizzes').update(updates).eq('id', id)
    await fetchQuizzes()

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
            body: `${quiz.item_type ?? 'Assessment'} is now available${courseName ? ` for ${courseName}` : ''}. Head to Assessments to begin.`,
            type: 'quiz_open',
            related_id: id,
          }))
        )
      }
    }

    // Email notification
    if (session) fireQuizOpenEmail(session.access_token, id)
  }

  async function submitQuiz(
    quizId: string,
    studentId: string,
    answers: Record<string, string>,
    earnedPoints: number,
    totalPoints: number,
    autoSubmitted = false,
    keystrokeCount = 0,
    startedAt?: string,
    answerTimestamps?: Record<string, string>,
  ) {
    const { count } = await supabase
      .from('quiz_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('student_id', studentId)
    const attemptNumber = (count ?? 0) + 1
    const score = calcScore(earnedPoints, totalPoints)
    await supabase.from('quiz_submissions').insert({
      quiz_id: quizId,
      student_id: studentId,
      answers,
      score,
      earned_points: earnedPoints,
      total_points: totalPoints,
      attempt_number: attemptNumber,
      auto_submitted: autoSubmitted,
      keystroke_count: keystrokeCount,
      started_at: startedAt ?? null,
      answer_timestamps: answerTimestamps ?? {},
    })
    await fetchMySubmissions(studentId)
  }

  async function uploadFile(quizId: string, studentId: string, file: File) {
    const ext = file.name.split('.').pop()
    const path = `${quizId}/${studentId}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('submissions')
      .upload(path, file, { upsert: true })
    if (upErr) throw upErr
    const { data: { publicUrl } } = supabase.storage.from('submissions').getPublicUrl(path)
    const { error } = await supabase.from('file_submissions').upsert(
      { quiz_id: quizId, student_id: studentId, file_url: publicUrl, file_name: file.name, file_size: file.size },
      { onConflict: 'quiz_id,student_id' }
    )
    if (error) throw error
  }

  async function fetchFileSubmissions(quizId: string): Promise<FileSubmission[]> {
    const { data } = await supabase.from('file_submissions').select('*').eq('quiz_id', quizId)
    return (data || []) as FileSubmission[]
  }

  async function saveEssayScores(
    submissionId: string,
    essayScores: Record<string, number>,
    earnedPoints: number,
    totalPoints: number,
  ) {
    const score = calcScore(earnedPoints, totalPoints)
    await supabase.from('quiz_submissions').update({
      essay_scores: essayScores,
      earned_points: earnedPoints,
      score,
    }).eq('id', submissionId)
    await fetchAllSubmissions()
  }

  async function releaseResults(id: string, visible: boolean) {
    await supabase.from('quizzes').update({ results_visible: visible }).eq('id', id)
    await fetchQuizzes()
  }

  async function copyQuiz(quizId: string, targetCourseId: string, userId: string) {
    const quiz = quizzes.find(q => q.id === quizId)
    if (!quiz) throw new Error('Quiz not found')
    const { data: newQuiz, error } = await supabase
      .from('quizzes')
      .insert({
        title: quiz.title,
        course_id: targetCourseId,
        slide_id: quiz.slide_id ?? null,
        due_date: null,
        open_at: null,
        close_at: null,
        time_limit_minutes: quiz.time_limit_minutes ?? null,
        lockdown_enabled: quiz.lockdown_enabled ?? false,
        max_attempts: quiz.max_attempts ?? 1,
        created_by: userId,
        item_type: quiz.item_type ?? 'quiz',
        grade_group_id: quiz.grade_group_id ?? null,
        allow_file_upload: quiz.allow_file_upload ?? false,
        description: quiz.description ?? null,
        is_open: false,
        results_visible: false,
      })
      .select().single()
    if (error) throw error
    const questions = quiz.questions ?? []
    if (questions.length > 0) {
      await supabase.from('quiz_questions').insert(
        questions.map((q, i) => ({
          quiz_id: newQuiz.id,
          question_text: q.question_text,
          options: q.options,
          correct_option: q.correct_option,
          order_index: i,
          type: q.type ?? 'mcq',
          code_snippet: q.code_snippet ?? null,
          code_language: q.code_language ?? null,
          points: q.points ?? 1,
        }))
      )
    }
    await fetchQuizzes()
    return newQuiz.id
  }

  return { quizzes, submissions, loading, error, fetchMySubmissions, fetchAllSubmissions, createQuiz, updateQuiz, deleteQuiz, toggleQuiz, submitQuiz, uploadFile, fetchFileSubmissions, saveEssayScores, releaseResults, copyQuiz }
}
