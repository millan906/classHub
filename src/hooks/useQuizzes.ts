import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calcScore } from '../utils/gradeCalculations'
import { withTimeout } from '../utils/withTimeout'
import { extractSubmissionPath } from '../utils/submissionUrl'
import { fireQuizOpenEmail } from './useNotifications'
import type { Quiz, QuizSubmission, FileSubmission, QuizFormData, QuizException } from '../types'

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
      setError((err as { message?: string })?.message ?? 'Failed to load assessments')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMySubmissions(studentId: string) {
    const { data, error: err } = await supabase.from('quiz_submissions').select('*').eq('student_id', studentId)
    if (err) { setError(err.message); return }
    setSubmissions(data || [])
  }

  async function fetchAllSubmissions() {
    const { data, error: err } = await supabase.from('quiz_submissions').select('*')
    if (err) { setError(err.message); return }
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
        attachment_url: data.attachmentUrl,
        attachment_name: data.attachmentName,
        randomize_questions: data.randomizeQuestions,
        file_max_points: data.fileMaxPoints,
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
      attachment_url: data.attachmentUrl,
      attachment_name: data.attachmentName,
      randomize_questions: data.randomizeQuestions,
      file_max_points: data.fileMaxPoints,
    }).eq('id', quizId)
    await supabase.from('grade_columns').update({ title: data.title }).eq('linked_quiz_id', quizId)
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
    setQuizzes(prev => prev.filter(q => q.id !== id))
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
    setQuizzes(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))

    if (quiz?.course_id) {
      const [{ data: enrollments }, { data: course }] = await Promise.all([
        supabase.from('course_enrollments').select('student_id').eq('course_id', quiz.course_id),
        supabase.from('courses').select('name, section').eq('id', quiz.course_id).single(),
      ])
      const ids = (enrollments ?? []).map((e: { student_id: string }) => e.student_id).filter(Boolean)
      const courseName = course ? `${course.name}${course.section ? ` · Section ${course.section}` : ''}` : ''
      const typeLabel = quiz.item_type
        ? quiz.item_type.charAt(0).toUpperCase() + quiz.item_type.slice(1)
        : 'Assessment'

      if (ids.length > 0) {
        if (isOpen) {
          const dueStr = quiz.due_date
            ? ` · Due ${new Date(quiz.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : ''
          await supabase.from('notifications').insert(
            ids.map(uid => ({
              user_id: uid,
              title: `${quiz.title} is now open`,
              body: `${typeLabel} is now available${dueStr}. Head to Assessments to begin.`,
              type: 'quiz_open',
              related_id: id,
              course_name: courseName || null,
            }))
          )
        } else {
          await supabase.from('notifications').insert(
            ids.map(uid => ({
              user_id: uid,
              title: `${quiz.title} is now closed`,
              body: `${typeLabel} is no longer accepting submissions.`,
              type: 'quiz_close',
              related_id: id,
              course_name: courseName || null,
            }))
          )
        }
      }
    }

    if (!isOpen) return

    // Email notification on open — refresh session first to ensure a non-expired token
    const { data: { session } } = await supabase.auth.getSession()
    const { data: { session: freshSession } } = await supabase.auth.refreshSession()
    const emailSession = freshSession ?? session
    if (emailSession) fireQuizOpenEmail(emailSession.access_token, id)
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
    // ── Validation ────────────────────────────────────────────────────────────
    const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB
    const ALLOWED_MIME = new Set([
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    ])
    const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'])

    if (file.size > MAX_SIZE_BYTES)
      throw new Error('File is too large. Maximum allowed size is 25 MB.')

    if (!ALLOWED_MIME.has(file.type))
      throw new Error('Invalid file type. Only PDF and image files are allowed.')

    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(fileExt))
      throw new Error('Invalid file extension. Only PDF and image files are allowed.')

    // ── Magic bytes: verify the file header matches its claimed type ──────────
    // Reads only the first 12 bytes — no need to load the whole file.
    const header = await file.slice(0, 12).arrayBuffer()
    const bytes = new Uint8Array(header)
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

    const isPdf  = hex.startsWith('25504446')                    // %PDF
    const isJpeg = hex.startsWith('ffd8ff')                      // JPEG SOI
    const isPng  = hex.startsWith('89504e470d0a1a0a')            // PNG
    const isGif  = hex.startsWith('47494638')                    // GIF8
    const isWebp = hex.startsWith('52494646') && hex.slice(16, 24) === '57454250' // RIFF....WEBP

    const magicOk = isPdf || isJpeg || isPng || isGif || isWebp
    // HEIC/HEIF don't have simple magic bytes — skip magic check for them
    const isHeic = fileExt === 'heic' || fileExt === 'heif'
    if (!magicOk && !isHeic)
      throw new Error('File content does not match its declared type. Upload rejected.')

    // ── PDF embedded script check ─────────────────────────────────────────────
    // Scans the first 64 KB of a PDF for embedded JavaScript markers.
    // Full JS execution in a PDF requires /JS or /JavaScript in the object tree.
    if (isPdf) {
      const chunk = await file.slice(0, 64 * 1024).text()
      const dangerous = ['/JS ', '/JS\n', '/JS(', '/JavaScript', '/OpenAction', '/AA ']
      if (dangerous.some(marker => chunk.includes(marker)))
        throw new Error('This PDF contains embedded scripts and cannot be submitted.')
    }
    // ─────────────────────────────────────────────────────────────────────────

    const ext = fileExt
    const path = `${quizId}/${crypto.randomUUID()}.${ext}`
    // Delete previous submission file if one exists
    const existing = await fetchMyFileSubmission(quizId, studentId)
    if (existing?.file_url) {
      const oldPath = extractSubmissionPath(existing.file_url)
      if (oldPath) await supabase.storage.from('submissions').remove([oldPath])
    }
    const { error: upErr } = await withTimeout(60_000, supabase.storage
      .from('submissions')
      .upload(path, file, { upsert: false }))
    if (upErr) throw upErr
    const { error } = await supabase.from('file_submissions').upsert(
      { quiz_id: quizId, student_id: studentId, file_url: path, file_name: file.name, file_size: file.size },
      { onConflict: 'quiz_id,student_id' }
    )
    if (error) throw error
  }

  async function uploadAttachment(file: File): Promise<{ url: string; name: string }> {
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await withTimeout(60_000, supabase.storage
      .from('attachments')
      .upload(path, file, { upsert: false }))
    if (upErr) throw upErr
    const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(path)
    return { url: publicUrl, name: file.name }
  }

  async function fetchFileSubmissions(quizId: string): Promise<FileSubmission[]> {
    const { data } = await supabase.from('file_submissions').select('*').eq('quiz_id', quizId)
    return (data || []) as FileSubmission[]
  }

  async function fetchMyFileSubmission(quizId: string, studentId: string): Promise<FileSubmission | null> {
    const { data } = await supabase.from('file_submissions').select('*').eq('quiz_id', quizId).eq('student_id', studentId).maybeSingle()
    return data as FileSubmission | null
  }

  async function saveEssayScores(
    submissionId: string,
    essayScores: Record<string, number>,
    earnedPoints: number,
    totalPoints: number,
  ) {
    const score = calcScore(earnedPoints, totalPoints)
    const { data, error } = await supabase.from('quiz_submissions').update({
      essay_scores: essayScores,
      earned_points: earnedPoints,
      score,
    }).eq('id', submissionId).select()
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Score update was blocked — you may not have permission to grade this submission.')
    await fetchAllSubmissions()
  }

  async function releaseResults(id: string, visible: boolean) {
    await supabase.from('quizzes').update({ results_visible: visible }).eq('id', id)
    await fetchQuizzes()
  }

  async function fetchMyExceptions(studentId: string): Promise<QuizException[]> {
    const { data } = await supabase
      .from('quiz_exceptions')
      .select('*')
      .eq('student_id', studentId)
    return (data ?? []) as QuizException[]
  }

  async function fetchExceptionsForQuiz(quizId: string): Promise<QuizException[]> {
    const { data } = await supabase
      .from('quiz_exceptions')
      .select('*')
      .eq('quiz_id', quizId)
    return (data ?? []) as QuizException[]
  }

  async function grantException(quizId: string, studentId: string, extraAttempts: number, grantedBy: string): Promise<void> {
    const { error } = await supabase
      .from('quiz_exceptions')
      .upsert(
        { quiz_id: quizId, student_id: studentId, extra_attempts: extraAttempts, granted_by: grantedBy },
        { onConflict: 'quiz_id,student_id' },
      )
    if (error) throw error
  }

  async function revokeException(quizId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from('quiz_exceptions')
      .delete()
      .eq('quiz_id', quizId)
      .eq('student_id', studentId)
    if (error) throw error
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
        grade_group_id: null, // must not carry over — group belongs to the source course
        allow_file_upload: quiz.allow_file_upload ?? false,
        description: quiz.description ?? null,
        is_open: false,
        results_visible: false,
        randomize_questions: quiz.randomize_questions ?? false,
        file_max_points: quiz.file_max_points ?? null,
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

  return { quizzes, submissions, loading, error, fetchMySubmissions, fetchAllSubmissions, createQuiz, updateQuiz, deleteQuiz, toggleQuiz, submitQuiz, uploadFile, uploadAttachment, fetchFileSubmissions, fetchMyFileSubmission, saveEssayScores, releaseResults, copyQuiz, fetchMyExceptions, fetchExceptionsForQuiz, grantException, revokeException }
}
