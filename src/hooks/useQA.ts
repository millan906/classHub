import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Question, Answer } from '../types'

export function useQA() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchQuestions() }, [])

  async function fetchQuestions() {
    const { data } = await supabase
      .from('questions')
      .select(`*, poster:profiles!posted_by(id, full_name, email, role, status, created_at), answers(*, poster:profiles!posted_by(id, full_name, email, role, status, created_at))`)
      .order('created_at', { ascending: false })
    setQuestions(data || [])
    setLoading(false)
  }

  async function postQuestion(title: string, body: string, tag: string, userId: string) {
    await supabase.from('questions').insert({ title, body, tag: tag || null, posted_by: userId })
    await fetchQuestions()
  }

  async function updateQuestion(id: string, title: string, body: string, tag: string) {
    await supabase.from('questions').update({ title, body, tag: tag || null }).eq('id', id)
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

  return { questions, loading, postQuestion, updateQuestion, toggleQuestion, postAnswer, endorseAnswer, refetch: fetchQuestions }
}
