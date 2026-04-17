import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Question } from '../types'

export function useQA(institutionId?: string | null) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchQuestions() {
    let query = supabase
      .from('questions')
      .select(`*, poster:profiles!posted_by(id, full_name, email, role, status, created_at), answers(*, poster:profiles!posted_by(id, full_name, email, role, status, created_at))`)
      .order('created_at', { ascending: false })
    if (institutionId) query = query.eq('institution_id', institutionId) as typeof query
    const { data } = await query
    setQuestions(data || [])
    setLoading(false)
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

  async function postQuestion(title: string, body: string, tag: string, userId: string) {
    await supabase.from('questions').insert({ title, body, tag: tag || null, posted_by: userId, institution_id: institutionId ?? null })
    await fetchQuestions()
  }

  async function updateQuestion(id: string, title: string, body: string, tag: string) {
    await supabase.from('questions').update({ title, body, tag: tag || null, updated_at: new Date().toISOString() }).eq('id', id)
    await fetchQuestions()
  }

  async function deleteQuestion(id: string) {
    await supabase.from('answers').delete().eq('question_id', id)
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) console.error('Delete question error:', error)
    await fetchQuestions()
  }

  async function toggleQuestion(id: string, isAnswered: boolean) {
    await supabase.from('questions').update({ is_answered: isAnswered }).eq('id', id)
    await fetchQuestions()
  }

  async function postAnswer(questionId: string, body: string, userId: string) {
    await supabase.from('answers').insert({ question_id: questionId, body, posted_by: userId })
    await supabase.from('questions').update({ is_answered: true }).eq('id', questionId)
    await fetchQuestions()
  }

  async function endorseAnswer(answerId: string) {
    await supabase.from('answers').update({ is_endorsed: true }).eq('id', answerId)
    await fetchQuestions()
  }

  return { questions, loading, postQuestion, updateQuestion, deleteQuestion, toggleQuestion, postAnswer, endorseAnswer, refetch: fetchQuestions }
}
