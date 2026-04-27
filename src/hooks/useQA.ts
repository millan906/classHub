import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Question } from '../types'

export function useQA(institutionId?: string | null) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchQuestions() {
    try {
      setError(null)
      const { data, error: err } = await supabase
        .from('questions')
        .select(`*, poster:profiles!posted_by(id, full_name, email, role, status, created_at), answers(*, poster:profiles!posted_by(id, full_name, email, role, status, created_at))`)
        .order('created_at', { ascending: false })
      if (err) throw err
      setQuestions(data || [])
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSingleQuestion(id: string): Promise<Question | null> {
    const { data } = await supabase
      .from('questions')
      .select(`*, poster:profiles!posted_by(id, full_name, email, role, status, created_at), answers(*, poster:profiles!posted_by(id, full_name, email, role, status, created_at))`)
      .eq('id', id)
      .single()
    return data as Question | null
  }

  useEffect(() => {
    fetchQuestions()
    const channel = supabase
      .channel(`qa-changes-${institutionId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, fetchQuestions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, fetchQuestions)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [institutionId])

  async function postQuestion(title: string, body: string, tag: string, userId: string, isPrivate = false) {
    const { data } = await supabase
      .from('questions')
      .insert({ title, body, tag: tag || null, posted_by: userId, is_private: isPrivate })
      .select('id')
      .single()
    if (data) {
      const q = await fetchSingleQuestion(data.id)
      if (q) setQuestions(prev => [q, ...prev])
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

  async function postAnswer(questionId: string, body: string, userId: string) {
    await supabase.from('answers').insert({ question_id: questionId, body, posted_by: userId })
    await supabase.from('questions').update({ is_answered: true }).eq('id', questionId)
    // Re-fetch just this question to get the new answer with poster join
    const q = await fetchSingleQuestion(questionId)
    if (q) setQuestions(prev => prev.map(x => x.id === questionId ? q : x))
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

  return { questions, loading, error, postQuestion, updateQuestion, deleteQuestion, toggleQuestion, postAnswer, endorseAnswer, refetch: fetchQuestions }
}
