import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type FlagType = 'consecutive_3' | 'accumulated_5'
export type FlagStatus = 'flagged' | 'action_taken' | 'escalated'

export interface AttendanceFlag {
  id: string
  course_id: string
  student_id: string
  flag_type: FlagType
  status: FlagStatus
  action_note: string | null
  action_taken_at: string | null
  escalated_at: string | null
  created_at: string
}

export function useAttendanceFlags(courseId: string | null) {
  const [flags, setFlags] = useState<AttendanceFlag[]>([])

  async function fetchFlags(cId: string) {
    const { data } = await supabase
      .from('attendance_flags')
      .select('*')
      .eq('course_id', cId)
    setFlags((data || []) as AttendanceFlag[])
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!courseId) { setFlags([]); return }
    fetchFlags(courseId)
  }, [courseId])

  async function upsertFlag(cId: string, studentId: string, flagType: FlagType) {
    // Only insert if not already present (ignoreDuplicates)
    const { data } = await supabase
      .from('attendance_flags')
      .upsert(
        { course_id: cId, student_id: studentId, flag_type: flagType },
        { onConflict: 'course_id,student_id,flag_type', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle()
    if (data) {
      setFlags(prev => {
        const exists = prev.find(f => f.student_id === studentId && f.flag_type === flagType)
        return exists ? prev : [...prev, data as AttendanceFlag]
      })
    }
  }

  async function markActionTaken(flagId: string, note: string) {
    const { data } = await supabase
      .from('attendance_flags')
      .update({ status: 'action_taken', action_note: note, action_taken_at: new Date().toISOString() })
      .eq('id', flagId)
      .select()
      .single()
    if (data) setFlags(prev => prev.map(f => f.id === flagId ? data as AttendanceFlag : f))
  }

  async function markEscalated(flagId: string) {
    const { data } = await supabase
      .from('attendance_flags')
      .update({ status: 'escalated', escalated_at: new Date().toISOString() })
      .eq('id', flagId)
      .select()
      .single()
    if (data) setFlags(prev => prev.map(f => f.id === flagId ? data as AttendanceFlag : f))
  }

  async function resolveFlag(flagId: string) {
    await supabase.from('attendance_flags').delete().eq('id', flagId)
    setFlags(prev => prev.filter(f => f.id !== flagId))
  }

  return { flags, upsertFlag, markActionTaken, markEscalated, resolveFlag }
}
