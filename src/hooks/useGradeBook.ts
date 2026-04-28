import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { GradeGroup, GradeColumn, GradeEntry } from '../types'

// Re-export so existing imports of these types from this file continue to work
// during the transition. Consumers should migrate to importing from '../types'.
export type { GradeGroup, GradeColumn, GradeEntry }

export function useGradeBook(courseId?: string | null) {
  const [groups, setGroups] = useState<GradeGroup[]>([])
  const [columns, setColumns] = useState<GradeColumn[]>([])
  const [entries, setEntries] = useState<GradeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('gradebook-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grade_groups' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grade_columns' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grade_entries' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [courseId])

  async function fetchAll() {
    try {
      setError(null)
      let groupsQuery = supabase.from('grade_groups').select('*').order('created_at', { ascending: true })
      if (courseId) {
        groupsQuery = groupsQuery.or(`course_id.is.null,course_id.eq.${courseId}`) as typeof groupsQuery
      }
      let colsQuery = supabase.from('grade_columns').select('*').order('created_at', { ascending: true })
      if (courseId) {
        colsQuery = colsQuery.or(`course_id.is.null,course_id.eq.${courseId}`) as typeof colsQuery
      }
      const [groupsRes, colsRes, entsRes] = await Promise.all([
        groupsQuery,
        colsQuery,
        supabase.from('grade_entries').select('*'),
      ])
      if (groupsRes.error) throw groupsRes.error
      if (colsRes.error) throw colsRes.error
      if (entsRes.error) throw entsRes.error
      setGroups(groupsRes.data || [])
      setColumns(colsRes.data || [])
      setEntries(entsRes.data || [])
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to load grade book')
    } finally {
      setLoading(false)
    }
  }

  async function addGroup(name: string, weightPercent: number, userId: string) {
    const { data, error } = await supabase.from('grade_groups').insert({
      name, weight_percent: weightPercent, created_by: userId, course_id: courseId ?? null,
    }).select('*').single()
    if (error) throw error
    setGroups(prev => [...prev, data])
  }

  async function updateGroup(id: string, name: string, weightPercent: number) {
    const { error } = await supabase.from('grade_groups').update({
      name, weight_percent: weightPercent,
    }).eq('id', id)
    if (error) throw error
    setGroups(prev => prev.map(g => g.id === id ? { ...g, name, weight_percent: weightPercent } : g))
  }

  async function deleteGroup(id: string) {
    const { error } = await supabase.from('grade_groups').delete().eq('id', id)
    if (error) throw error
    // Cascade cleanup in local state (DB cascades via FK)
    const colIds = columns.filter(c => c.group_id === id).map(c => c.id)
    setGroups(prev => prev.filter(g => g.id !== id))
    setColumns(prev => prev.filter(c => c.group_id !== id))
    setEntries(prev => prev.filter(e => !colIds.includes(e.column_id)))
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
      course_id: courseId ?? null,
    }).select('*').single()
    if (error) throw error
    setColumns(prev => [...prev, data])
    return data.id
  }

  async function findOrCreateLinkedColumn(
    quizId: string,
    quizTitle: string,
    groupId: string,
    maxScore: number,
    userId: string,
    quizCourseId?: string | null,
  ): Promise<GradeColumn> {
    // Use limit(1) instead of maybeSingle() so duplicate linked columns
    // (created by concurrent sync runs) never cause a query error that
    // silently falls through and creates yet another duplicate.
    const { data: rows } = await supabase
      .from('grade_columns')
      .select('*')
      .eq('linked_quiz_id', quizId)
      .order('created_at', { ascending: true })
      .limit(1)
    const existing = rows?.[0] ?? null
    if (existing) {
      if (!existing.course_id && quizCourseId) {
        await supabase.from('grade_columns').update({ course_id: quizCourseId }).eq('id', existing.id)
        const updated = { ...existing, course_id: quizCourseId } as GradeColumn
        setColumns(prev => prev.map(c => c.id === existing.id ? updated : c))
        return updated
      }
      return existing as GradeColumn
    }
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
        course_id: quizCourseId ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    setColumns(prev => [...prev, created])
    return created as GradeColumn
  }

  async function updateColumnMaxScore(id: string, maxScore: number) {
    const { error } = await supabase.from('grade_columns').update({ max_score: maxScore }).eq('id', id)
    if (error) throw error
    setColumns(prev => prev.map(c => c.id === id ? { ...c, max_score: maxScore } : c))
  }

  async function releaseColumn(id: string, released: boolean) {
    const { error } = await supabase.from('grade_columns').update({ is_released: released }).eq('id', id)
    if (error) throw error
    setColumns(prev => prev.map(c => c.id === id ? { ...c, is_released: released } : c))
  }

  async function deleteColumn(id: string) {
    const { error } = await supabase.from('grade_columns').delete().eq('id', id)
    if (error) throw error
    setColumns(prev => prev.filter(c => c.id !== id))
    setEntries(prev => prev.filter(e => e.column_id !== id))
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

  async function batchUpsertEntries(rows: { column_id: string; student_id: string; score: number | null }[]) {
    if (rows.length === 0) return
    const { data, error } = await supabase
      .from('grade_entries')
      .upsert(rows, { onConflict: 'column_id,student_id' })
      .select()
    if (error) throw error
    setEntries(prev => {
      const next = [...prev]
      for (const row of (data ?? [])) {
        const idx = next.findIndex(e => e.column_id === row.column_id && e.student_id === row.student_id)
        if (idx >= 0) next[idx] = row
        else next.push(row)
      }
      return next
    })
  }

  return {
    groups, columns, entries, loading, error,
    addGroup, updateGroup, deleteGroup,
    addColumn, findOrCreateLinkedColumn, updateColumnMaxScore, releaseColumn, deleteColumn,
    upsertEntry, batchUpsertEntries,
    refetch: fetchAll,
  }
}
