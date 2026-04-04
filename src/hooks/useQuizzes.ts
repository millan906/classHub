import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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
    await supabase.from('quizzes').delete().eq('id', id)
    await fetchQuizzes()
  }

  async function toggleQuiz(id: string, isOpen: boolean) {
    await supabase.from('quizzes').update({ is_open: isOpen }).eq('id', id)
    await fetchQuizzes()
  }

  async function submitQuiz(
    quizId: string,
    studentId: string,
    answers: Record<string, string>,
    earnedPoints: number,
    totalPoints: number,
    autoSubmitted = false
  ) {
    const { count } = await supabase
      .from('quiz_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('student_id', studentId)
    const attemptNumber = (count ?? 0) + 1
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    await supabase.from('quiz_submissions').insert({
      quiz_id: quizId,
      student_id: studentId,
      answers,
      score,
      earned_points: earnedPoints,
      total_points: totalPoints,
      attempt_number: attemptNumber,
      auto_submitted: autoSubmitted,
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
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
    await supabase.from('quiz_submissions').update({
      essay_scores: essayScores,
      earned_points: earnedPoints,
      score,
    }).eq('id', submissionId)
    await fetchAllSubmissions()
  }

  return { quizzes, submissions, loading, error, fetchMySubmissions, fetchAllSubmissions, createQuiz, updateQuiz, deleteQuiz, toggleQuiz, submitQuiz, uploadFile, fetchFileSubmissions, saveEssayScores }
}
