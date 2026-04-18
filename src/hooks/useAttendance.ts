import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { AttendanceSession, AttendanceRecord, AttendanceStatus } from '../types'

export function useAttendance(courseId: string | null) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (courseId) fetchAll(courseId)
    else setLoading(false)
  }, [courseId])

  async function fetchAll(cId: string) {
    setLoading(true)
    const sessRes = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('course_id', cId)
      .order('date', { ascending: false })
    const sessionIds = (sessRes.data || []).map((s: { id: string }) => s.id)
    const recRes = sessionIds.length > 0
      ? await supabase.from('attendance_records').select('*').in('session_id', sessionIds)
      : { data: [] }
    setSessions(sessRes.data || [])
    setRecords(recRes.data || [])
    setLoading(false)
  }

  async function createSession(courseId: string, label: string, date: string, userId: string) {
    const { data, error } = await supabase.from('attendance_sessions').insert({
      course_id: courseId, label, date, created_by: userId,
    }).select('*').single()
    if (error) throw error
    setSessions(prev => [data, ...prev])
    return data as AttendanceSession
  }

  async function deleteSession(sessionId: string) {
    await supabase.from('attendance_sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    setRecords(prev => prev.filter(r => r.session_id !== sessionId))
  }

  async function setRecord(sessionId: string, studentId: string, status: AttendanceStatus) {
    const { data, error } = await supabase.from('attendance_records').upsert(
      { session_id: sessionId, student_id: studentId, status },
      { onConflict: 'session_id,student_id' }
    ).select('*').single()
    if (error) throw error
    setRecords(prev => {
      const idx = prev.findIndex(r => r.session_id === sessionId && r.student_id === studentId)
      if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
      return [...prev, data]
    })
  }

  async function bulkSetRecords(sessionId: string, studentIds: string[], status: AttendanceStatus) {
    const rows = studentIds.map(student_id => ({ session_id: sessionId, student_id, status }))
    const { data, error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'session_id,student_id' }).select('*')
    if (error) throw error
    setRecords(prev => {
      const without = prev.filter(r => r.session_id !== sessionId || !studentIds.includes(r.student_id))
      return [...without, ...(data || [])]
    })
  }

  return { sessions, records, loading, createSession, deleteSession, setRecord, bulkSetRecords, refetch: () => courseId && fetchAll(courseId) }
}

// For students: their own attendance across all their courses
export function useMyAttendance(studentId: string | null) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentId) fetchMine(studentId)
    else setLoading(false)
  }, [studentId])

  async function fetchMine(sId: string) {
    setLoading(true)
    const { data: recs } = await supabase.from('attendance_records').select('*').eq('student_id', sId)
    const sessionIds = (recs || []).map((r: AttendanceRecord) => r.session_id)
    let sessData: AttendanceSession[] = []
    if (sessionIds.length > 0) {
      const { data } = await supabase.from('attendance_sessions').select('*').in('id', sessionIds).order('date', { ascending: false })
      sessData = data || []
    }
    setRecords(recs || [])
    setSessions(sessData)
    setLoading(false)
  }

  return { sessions, records, loading }
}
