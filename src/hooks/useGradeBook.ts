import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface GradeGroup {
  id: string
  name: string
  weight_percent: number
  created_by: string
  created_at: string
}

export interface GradeColumn {
  id: string
  title: string
  category: string | null
  max_score: number
  group_id: string
  entry_type: 'manual' | 'quiz_linked'
  linked_quiz_id: string | null
  description: string | null
  created_by: string
  created_at: string
}

export interface GradeEntry {
  id: string
  column_id: string
  student_id: string
  score: number | null
}

export function useGradeBook() {
  const [groups, setGroups] = useState<GradeGroup[]>([])
  const [columns, setColumns] = useState<GradeColumn[]>([])
  const [entries, setEntries] = useState<GradeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    try {
      setError(null)
      const [groupsRes, colsRes, entsRes] = await Promise.all([
        supabase.from('grade_groups').select('*').order('created_at', { ascending: true }),
        supabase.from('grade_columns').select('*').order('created_at', { ascending: true }),
        supabase.from('grade_entries').select('*'),
      ])
      if (groupsRes.error) throw groupsRes.error
      if (colsRes.error) throw colsRes.error
      if (entsRes.error) throw entsRes.error
      setGroups(groupsRes.data || [])
      setColumns(colsRes.data || [])
      setEntries(entsRes.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load grade book')
    } finally {
      setLoading(false)
    }
  }

  async function addGroup(name: string, weightPercent: number, userId: string) {
    const { error } = await supabase.from('grade_groups').insert({
      name, weight_percent: weightPercent, created_by: userId,
    })
    if (error) throw error
    await fetchAll()
  }

  async function updateGroup(id: string, name: string, weightPercent: number) {
    const { error } = await supabase.from('grade_groups').update({
      name, weight_percent: weightPercent,
    }).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function deleteGroup(id: string) {
    const { error } = await supabase.from('grade_groups').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function addColumn(
    title: string,
    groupId: string,
    maxScore: number,
    userId: string,
    description?: string | null,
    entryType: 'manual' | 'quiz_linked' = 'manual',
    linkedQuizId: string | null = null,
  ): Promise<string> {
    const { data, error } = await supabase.from('grade_columns').insert({
      title,
      group_id: groupId,
      max_score: maxScore,
      created_by: userId,
      entry_type: entryType,
      category: null,
      linked_quiz_id: linkedQuizId,
      description: description ?? null,
    }).select('id').single()
    if (error) throw error
    await fetchAll()
    return data.id
  }

  async function findOrCreateLinkedColumn(
    quizId: string,
    quizTitle: string,
    groupId: string,
    maxScore: number,
    userId: string,
  ): Promise<GradeColumn> {
    const { data: existing } = await supabase
      .from('grade_columns')
      .select('*')
      .eq('linked_quiz_id', quizId)
      .maybeSingle()
    if (existing) return existing as GradeColumn
    const { data: created, error } = await supabase
      .from('grade_columns')
      .insert({
        title: quizTitle,
        group_id: groupId,
        max_score: maxScore,
        created_by: userId,
        entry_type: 'quiz_linked',
        category: null,
        linked_quiz_id: quizId,
        description: null,
      })
      .select('*')
      .single()
    if (error) throw error
    await fetchAll()
    return created as GradeColumn
  }

  async function updateColumnMaxScore(id: string, maxScore: number) {
    const { error } = await supabase.from('grade_columns').update({ max_score: maxScore }).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function deleteColumn(id: string) {
    const { error } = await supabase.from('grade_columns').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function upsertEntry(columnId: string, studentId: string, score: number | null) {
    const { data, error } = await supabase
      .from('grade_entries')
      .upsert(
        { column_id: columnId, student_id: studentId, score },
        { onConflict: 'column_id,student_id' },
      )
      .select()
      .single()
    if (error) throw error
    setEntries(prev => {
      const idx = prev.findIndex(e => e.column_id === columnId && e.student_id === studentId)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [...prev, data]
    })
  }

  return {
    groups, columns, entries, loading, error,
    addGroup, updateGroup, deleteGroup,
    addColumn, findOrCreateLinkedColumn, updateColumnMaxScore, deleteColumn,
    upsertEntry,
    refetch: fetchAll,
  }
}
