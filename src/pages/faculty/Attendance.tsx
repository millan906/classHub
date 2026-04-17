import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useAttendance } from '../../hooks/useAttendance'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type { AttendanceStatus, AttendanceSession } from '../../types'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; bg: string; color: string }> = {
  present:  { label: 'Present',  short: 'P', bg: '#E1F5EE', color: '#0F6E56' },
  late:     { label: 'Late',     short: 'L', bg: '#FEF3CD', color: '#7A4F00' },
  absent:   { label: 'Absent',   short: 'A', bg: '#FCEBEB', color: '#A32D2D' },
  excused:  { label: 'Excused',  short: 'E', bg: '#F1EFE8', color: '#666'    },
}

const STATUS_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

const inputStyle = {
  padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
  border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
  fontFamily: 'Inter, sans-serif', outline: 'none',
}

export default function FacultyAttendance() {
  const { profile } = useAuth()
  const { courses } = useCourses()
  const { students } = useStudents()
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const { sessions, records, loading, createSession, deleteSession, setRecord, bulkSetRecords } = useAttendance(selectedCourseId || null)
  const { enrollments } = useCourseEnrollments(selectedCourseId || null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AttendanceSession | null>(null)

  // Auto-expand the most recent session when sessions load
  useEffect(() => {
    if (sessions.length > 0 && !expandedSessionId) {
      setExpandedSessionId(sessions[0].id)
    }
  }, [sessions])

  const enrolledStudents = enrollments
    .map(e => students.find(s => s.id === e.student_id))
    .filter(Boolean) as typeof students

  async function handleCreateSession() {
    if (!newLabel.trim() || !selectedCourseId || !profile) return
    setSaving(true)
    try {
      const session = await createSession(selectedCourseId, newLabel.trim(), newDate, profile.id)
      // Pre-fill all as absent
      if (enrolledStudents.length > 0) {
        await bulkSetRecords(session.id, enrolledStudents.map(s => s.id), 'absent')
      }
      setExpandedSessionId(session.id)
      setShowNewForm(false)
      setNewLabel('')
      setNewDate(new Date().toISOString().split('T')[0])
    } finally {
      setSaving(false)
    }
  }

  function getRecord(sessionId: string, studentId: string): AttendanceStatus | null {
    return records.find(r => r.session_id === sessionId && r.student_id === studentId)?.status ?? null
  }

  function getSessionStats(sessionId: string) {
    const sessionRecords = records.filter(r => r.session_id === sessionId)
    return {
      present: sessionRecords.filter(r => r.status === 'present').length,
      late: sessionRecords.filter(r => r.status === 'late').length,
      absent: sessionRecords.filter(r => r.status === 'absent').length,
      excused: sessionRecords.filter(r => r.status === 'excused').length,
    }
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete session"
          message={`Delete "${confirmDelete.label}"? All attendance records for this session will be lost.`}
          onConfirm={async () => { await deleteSession(confirmDelete.id); setConfirmDelete(null); setExpandedSessionId(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <PageHeader title="Attendance" subtitle="Track student attendance per session." />

      {/* Course selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedCourseId}
          onChange={e => { setSelectedCourseId(e.target.value); setExpandedSessionId(null) }}
          style={{ ...inputStyle, minWidth: '220px' }}
        >
          <option value="">Select course…</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.section ? ` · Section ${c.section}` : ''}
            </option>
          ))}
        </select>
        {selectedCourseId && (
          <button
            onClick={() => setShowNewForm(v => !v)}
            style={{
              padding: '7px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
              border: 'none', background: '#1D9E75', color: '#fff',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            + New session
          </button>
        )}
      </div>

      {/* New session form */}
      {showNewForm && (
        <div style={{
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
          display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Label / Topic</div>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Week 1 - Introduction"
              style={{ ...inputStyle, width: '260px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Date</div>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            onClick={handleCreateSession}
            disabled={saving || !newLabel.trim()}
            style={{
              padding: '7px 16px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
              border: 'none', background: '#1D9E75', color: '#fff',
              cursor: saving || !newLabel.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !newLabel.trim() ? 0.6 : 1,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => setShowNewForm(false)}
            style={{
              padding: '7px 14px', fontSize: '13px', borderRadius: '8px',
              border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: '#555',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {!selectedCourseId && (
        <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '3rem' }}>
          Select a course to view attendance.
        </div>
      )}

      {selectedCourseId && loading && <Spinner />}

      {selectedCourseId && !loading && sessions.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '3rem' }}>
          No sessions yet. Create your first session above.
        </div>
      )}

      {/* Sessions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sessions.map(session => {
          const stats = getSessionStats(session.id)
          const expanded = expandedSessionId === session.id
          return (
            <div key={session.id} style={{
              background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
              borderRadius: '12px', overflow: 'hidden',
            }}>
              {/* Session header */}
              <div
                onClick={() => setExpandedSessionId(expanded ? null : session.id)}
                style={{
                  padding: '12px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{session.label}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                {/* Stats pills */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {STATUS_ORDER.map(s => {
                    const count = stats[s]
                    if (count === 0) return null
                    const cfg = STATUS_CONFIG[s]
                    return (
                      <span key={s} style={{
                        fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                        borderRadius: '999px', background: cfg.bg, color: cfg.color,
                      }}>
                        {cfg.short} {count}
                      </span>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(session) }}
                    style={{
                      padding: '4px 8px', fontSize: '11px', borderRadius: '6px',
                      border: '0.5px solid rgba(163,45,45,0.3)', background: 'transparent',
                      color: '#A32D2D', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Delete
                  </button>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>{expanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded student list */}
              {expanded && (
                <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', padding: '12px 16px' }}>
                  {enrolledStudents.length === 0 && (
                    <div style={{ fontSize: '13px', color: '#888' }}>No students enrolled in this course.</div>
                  )}
                  {/* Bulk actions */}
                  {enrolledStudents.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#888', marginRight: '4px' }}>Mark all:</span>
                      {STATUS_ORDER.map(s => {
                        const cfg = STATUS_CONFIG[s]
                        return (
                          <button
                            key={s}
                            onClick={() => bulkSetRecords(session.id, enrolledStudents.map(st => st.id), s)}
                            style={{
                              padding: '3px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
                              border: 'none', background: cfg.bg, color: cfg.color,
                              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            }}
                          >
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Student rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {enrolledStudents.map(student => {
                      const status = getRecord(session.id, student.id)
                      const colors = getAvatarColors(student.full_name)
                      return (
                        <div key={student.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 0',
                          borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                        }}>
                          <Avatar
                            initials={getInitials(student.full_name)}
                            bg={colors.bg}
                            color={colors.color}
                            size={28}
                            seed={student.avatar_seed}
                          />
                          <div style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {STATUS_ORDER.map(s => {
                              const cfg = STATUS_CONFIG[s]
                              const active = status === s
                              return (
                                <button
                                  key={s}
                                  onClick={() => setRecord(session.id, student.id, s)}
                                  title={cfg.label}
                                  style={{
                                    width: '30px', height: '30px', borderRadius: '8px',
                                    border: active ? 'none' : '0.5px solid rgba(0,0,0,0.15)',
                                    background: active ? cfg.bg : 'transparent',
                                    color: active ? cfg.color : '#bbb',
                                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                    fontSize: '12px', fontWeight: 600,
                                    transition: 'all 0.1s',
                                  }}
                                >
                                  {cfg.short}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
