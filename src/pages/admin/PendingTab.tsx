/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCourses } from '../../hooks/useCourses'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'

interface PendingTabProps {
  institutionId: string | undefined
}

interface PendingStudent {
  id: string
  full_name: string
  email: string
  student_no: string | null
  program: string | null
  section: string | null
  avatar_seed: string | null
  created_at: string
}

export default function PendingTab({ institutionId }: PendingTabProps) {
  const { courses } = useCourses(institutionId)
  const [students, setStudents] = useState<PendingStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchPending() }, [])

  async function fetchPending() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, student_no, program, section, avatar_seed, created_at')
      .eq('status', 'pending')
      .eq('role', 'student')
      .order('created_at', { ascending: true })
    if (!error) setStudents(data ?? [])
    setLoading(false)
  }

  async function approve(student: PendingStudent) {
    const courseId = selectedCourse[student.id]
    if (!courseId) { setError('Select a course before approving.'); return }
    setActionLoading(student.id)
    setError(null)
    try {
      await supabase
        .from('profiles')
        .update({ status: 'approved', ...(institutionId ? { institution_id: institutionId } : {}) })
        .eq('id', student.id)

      await supabase
        .from('course_enrollments')
        .upsert(
          { course_id: courseId, student_id: student.id, invited_by: student.id },
          { onConflict: 'course_id,student_id', ignoreDuplicates: true },
        )

      setStudents(prev => prev.filter(s => s.id !== student.id))
      setApprovingId(null)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to approve student.')
    } finally {
      setActionLoading(null)
    }
  }

  async function dismiss(student: PendingStudent) {
    if (!confirm(`Remove ${student.full_name}'s pending account? They will need to register again.`)) return
    setActionLoading(student.id)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: student.id }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to dismiss student.')
      }
      setStudents(prev => prev.filter(s => s.id !== student.id))
    } catch (err: any) {
      setError(err?.message ?? 'Failed to dismiss student.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <Spinner />

  if (students.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', fontSize: '13px', color: '#888' }}>
        No pending students. Everyone is approved.
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
        {students.length} student{students.length !== 1 ? 's' : ''} waiting for approval
      </div>

      {error && (
        <div style={{
          fontSize: '12px', color: '#A32D2D', background: '#FCEBEB',
          borderRadius: '8px', padding: '8px 12px', marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {students.map(student => {
          const colors = getAvatarColors(student.full_name)
          const isApproving = approvingId === student.id
          const isBusy = actionLoading === student.id

          return (
            <div key={student.id} style={{
              background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)',
              borderRadius: '10px', padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar
                  initials={getInitials(student.full_name)}
                  bg={colors.bg} color={colors.color}
                  size={32} seed={student.avatar_seed}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>{student.email}</div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                    {student.student_no && (
                      <span style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace' }}>
                        {student.student_no}
                      </span>
                    )}
                    {student.program && (
                      <span style={{ fontSize: '11px', color: '#888' }}>{student.program}</span>
                    )}
                    {student.section && (
                      <span style={{ fontSize: '11px', color: '#888' }}>{student.section}</span>
                    )}
                  </div>
                </div>

                {!isApproving && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => { setApprovingId(student.id); setError(null) }}
                      disabled={isBusy}
                      style={{
                        padding: '5px 12px', fontSize: '12px', fontWeight: 500,
                        borderRadius: '7px', border: 'none',
                        background: '#1D9E75', color: '#fff',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.6 : 1,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => dismiss(student)}
                      disabled={isBusy}
                      style={{
                        padding: '5px 12px', fontSize: '12px', fontWeight: 500,
                        borderRadius: '7px',
                        border: '0.5px solid rgba(163,45,45,0.3)',
                        background: 'transparent', color: '#A32D2D',
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                        opacity: isBusy ? 0.6 : 1,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {isBusy ? '...' : 'Dismiss'}
                    </button>
                  </div>
                )}
              </div>

              {/* Course assignment — shown when Approve is clicked */}
              {isApproving && (
                <div style={{
                  marginTop: '10px', paddingTop: '10px',
                  borderTop: '0.5px solid rgba(0,0,0,0.08)',
                  display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
                }}>
                  <select
                    value={selectedCourse[student.id] ?? ''}
                    onChange={e => setSelectedCourse(prev => ({ ...prev, [student.id]: e.target.value }))}
                    style={{
                      padding: '6px 10px', fontSize: '12px', borderRadius: '7px',
                      border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
                      fontFamily: 'Inter, sans-serif', outline: 'none', flex: 1, minWidth: '160px',
                    }}
                  >
                    <option value=''>— Select course —</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => approve(student)}
                    disabled={isBusy || !selectedCourse[student.id]}
                    style={{
                      padding: '6px 14px', fontSize: '12px', fontWeight: 500,
                      borderRadius: '7px', border: 'none',
                      background: '#1D9E75', color: '#fff',
                      cursor: isBusy || !selectedCourse[student.id] ? 'not-allowed' : 'pointer',
                      opacity: isBusy || !selectedCourse[student.id] ? 0.6 : 1,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {isBusy ? 'Approving...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setApprovingId(null)}
                    style={{
                      padding: '6px 12px', fontSize: '12px',
                      borderRadius: '7px', border: '0.5px solid rgba(0,0,0,0.2)',
                      background: 'transparent', color: '#555',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
