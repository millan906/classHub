import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Question } from '../types'

const PAGE_SIZE = 20
const QA_SELECT = `*, poster:profiles!posted_by(id, full_name, email, role, status, created_at), answers(*, poster:profiles!posted_by(id, full_name, email, role, status, created_at))`

export function useQA(institutionId?: string | null) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks how many items are currently loaded so realtime refetches the right count
  const loadedCountRef = useRef(PAGE_SIZE)

  async function fetchQuestions(count = PAGE_SIZE) {
    try {
      setError(null)
      const { data, error: err } = await supabase
        .from('questions')
        .select(QA_SELECT)
        .order('created_at', { ascending: false })
        .range(0, count - 1)
      if (err) throw err
      const rows = data || []
      setQuestions(rows)
      setHasMore(rows.length === count)
      loadedCountRef.current = count
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    const from = questions.length
    const to = from + PAGE_SIZE - 1
    try {
      const { data } = await supabase
        .from('questions')
        .select(QA_SELECT)
        .order('created_at', { ascending: false })
        .range(from, to)
      const rows = data || []
      setQuestions(prev => [...prev, ...rows])
      setHasMore(rows.length === PAGE_SIZE)
      loadedCountRef.current = from + rows.length
    } finally {
      setLoadingMore(false)
    }
  }

  async function fetchSingleQuestion(id: string): Promise<Question | null> {
    const { data } = await supabase
      .from('questions')
      .select(QA_SELECT)
      .eq('id', id)
      .single()
    return data as Question | null
  }

  useEffect(() => {
    fetchQuestions()
    const channel = supabase
      .channel(`qa-changes-${institutionId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => fetchQuestions(loadedCountRef.current))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, () => fetchQuestions(loadedCountRef.current))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [institutionId])

  async function postQuestion(title: string, body: string, tag: string, userId: string, isPrivate = false, posterRole?: string) {
    const { data } = await supabase
      .from('questions')
      .insert({ title, body, tag: tag || null, posted_by: userId, is_private: isPrivate })
      .select('id')
      .single()
    if (data) {
      const q = await fetchSingleQuestion(data.id)
      if (q) setQuestions(prev => [q, ...prev])
    }

    // Notify all faculty when a student posts a question
    if (posterRole === 'student' && data) {
      const { data: faculty } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'faculty')
      const facultyIds = (faculty ?? []).map((f: { id: string }) => f.id).filter(id => id !== userId)
      if (facultyIds.length > 0) {
        await supabase.from('notifications').insert(
          facultyIds.map((uid: string) => ({
            user_id: uid,
            title: 'New question in Q&A',
            body: `"${title}"${isPrivate ? ' (private)' : ''} — needs your attention.`,
            type: 'qa_new_question',
            related_id: data.id,
            course_name: null,
          }))
        )
      }
    }
  }

  async function updateQuestion(id: string, title: string, body: string, tag: string, isPrivate?: boolean) {
    const updates: Record<string, unknown> = { title, body, tag: tag || null, updated_at: new Date().toISOString() }
    if (isPrivate !== undefined) updates.is_private = isPrivate
    await supabase.from('questions').update(updates).eq('id', id)
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, title, body, tag: tag || undefined, ...(isPrivate !== undefined ? { is_private: isPrivate } : {}) } as Question : q))
  }

  async function deleteQuestion(id: string) {
    await supabase.from('answers').delete().eq('question_id', id)
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) throw error
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function toggleQuestion(id: string, isAnswered: boolean) {
    await supabase.from('questions').update({ is_answered: isAnswered }).eq('id', id)
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, is_answered: isAnswered } : q))
  }

  async function postAnswer(questionId: string, body: string, userId: string, posterRole?: string) {
    await supabase.from('answers').insert({ question_id: questionId, body, posted_by: userId })
    await supabase.from('questions').update({ is_answered: true }).eq('id', questionId)
    const q = await fetchSingleQuestion(questionId)
    if (q) setQuestions(prev => prev.map(x => x.id === questionId ? q : x))

    const question = questions.find(x => x.id === questionId)
    const questionTitle = question?.title ?? 'your question'

    // Notify the question poster if they're not the one responding
    if (question && question.posted_by !== userId) {
      await supabase.from('notifications').insert({
        user_id: question.posted_by,
        title: 'New response on your question',
        body: `Someone responded to "${questionTitle}". Check the Q&A.`,
        type: 'qa_new_response',
        related_id: questionId,
        course_name: null,
      })
    }

    // If a student is responding, also notify all faculty
    if (posterRole === 'student') {
      const { data: faculty } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'faculty')
      const facultyIds = (faculty ?? []).map((f: { id: string }) => f.id).filter(id => id !== userId)
      if (facultyIds.length > 0) {
        await supabase.from('notifications').insert(
          facultyIds.map((uid: string) => ({
            user_id: uid,
            title: 'Student responded in Q&A',
            body: `New response on "${questionTitle}".`,
            type: 'qa_new_response',
            related_id: questionId,
            course_name: null,
          }))
        )
      }
    }
  }

  async function endorseAnswer(answerId: string) {
    await supabase.from('answers').update({ is_endorsed: true }).eq('id', answerId)
    setQuestions(prev => prev.map(q => ({
      ...q,
      answers: (q.answers ?? []).map(a =>
        a.id === answerId ? { ...a, is_endorsed: true } : a
      ),
    }) as Question))
  }

  return { questions, loading, loadingMore, hasMore, loadMore, error, postQuestion, updateQuestion, deleteQuestion, toggleQuestion, postAnswer, endorseAnswer, refetch: fetchQuestions }

}
