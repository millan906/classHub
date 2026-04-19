import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useAttendance } from '../../hooks/useAttendance'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { useAttendanceFlags } from '../../hooks/useAttendanceFlags'
import { ATTENDANCE_CONSECUTIVE_THRESHOLD, ATTENDANCE_ACCUMULATED_THRESHOLD } from '../../constants/attendance'
import { countConsecutiveAbsences, countTotalAbsences } from '../../utils/attendanceFlags'
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
  const { courses } = useCourses(null, profile?.id)
  const { students } = useStudents()
  const [searchParams] = useSearchParams()
  const [selectedCourseId, setSelectedCourseId] = useState<string>(searchParams.get('course') ?? '')
  const { sessions, records, loading, createSession, deleteSession, setRecord, bulkSetRecords } = useAttendance(selectedCourseId || null)
  const { enrollments } = useCourseEnrollments(selectedCourseId || null)
  const { flags, upsertFlag, markActionTaken, markEscalated, resolveFlag } = useAttendanceFlags(selectedCourseId || null)
  const [view, setView] = useState<'sessions' | 'summary'>('sessions')
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AttendanceSession | null>(null)
  const [actionFlagId, setActionFlagId] = useState<string | null>(null)
  const [actionNote, setActionNote] = useState('')

  // Auto-expand the most recent session when sessions load
  useEffect(() => {
    if (sessions.length > 0 && !expandedSessionId) {
      setExpandedSessionId(sessions[0].id)
    }
  }, [sessions])

  // Auto-detect and upsert flags when records/sessions change
  useEffect(() => {
    if (!selectedCourseId || sessions.length === 0 || enrolledStudents.length === 0) return
    const sessionIds = new Set(sessions.map(s => s.id))
    const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    for (const student of enrolledStudents) {
      const sr = records.filter(r => r.student_id === student.id && sessionIds.has(r.session_id))
      const totalAbsent = countTotalAbsences(sr)
      const consecutive = countConsecutiveAbsences(sortedSessions, sr)
      // Add flag if threshold met, remove if no longer met
      const consFlag = flags.find(f => f.student_id === student.id && f.flag_type === 'consecutive_3')
      const accumFlag = flags.find(f => f.student_id === student.id && f.flag_type === 'accumulated_5')
      if (consecutive >= ATTENDANCE_CONSECUTIVE_THRESHOLD) upsertFlag(selectedCourseId, student.id, 'consecutive_3')
      else if (consFlag) resolveFlag(consFlag.id)
      if (totalAbsent >= ATTENDANCE_ACCUMULATED_THRESHOLD) upsertFlag(selectedCourseId, student.id, 'accumulated_5')
      else if (accumFlag) resolveFlag(accumFlag.id)
      // Auto-escalate: action_taken flag + new absence after action date
      for (const flag of flags.filter(f => f.student_id === student.id && f.status === 'action_taken' && f.action_taken_at)) {
        const actionDate = new Date(flag.action_taken_at!)
        const newAbsence = sortedSessions.some(s => {
          if (new Date(s.date + 'T00:00:00') <= actionDate) return false
          return sr.find(r => r.session_id === s.id)?.status === 'absent'
        })
        if (newAbsence) markEscalated(flag.id)
      }
    }
  }, [records, sessions, selectedCourseId])

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
      setNewLabel('')
      setNewDate(new Date().toISOString().split('T')[0])
      setSaveSuccess(true)
      setTimeout(() => { setSaveSuccess(false); setShowNewForm(false) }, 1500)
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
          <>
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#f0f0ee', borderRadius: '8px', padding: '3px', gap: '2px' }}>
              {(['sessions', 'summary'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '5px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
                    border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    background: view === v ? '#fff' : 'transparent',
                    color: view === v ? '#1a1a1a' : '#888',
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            {view === 'sessions' && (
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
          </>
        )}
      </div>

      {/* New session form */}
      {showNewForm && (
        <div style={{
          background: '#fff', border: `0.5px solid ${saveSuccess ? 'rgba(29,158,117,0.4)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
          display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap',
          transition: 'border-color 0.2s',
        }}>
          {saveSuccess ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#0F6E56', fontSize: '13px', fontWeight: 500, padding: '4px 0',
            }}>
              <span style={{ fontSize: '18px' }}>✓</span> Session saved successfully!
            </div>
          ) : (
            <>
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
                {saving ? 'Saving...' : 'Save'}
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
            </>
          )}
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

      {/* Summary view */}
      {view === 'summary' && selectedCourseId && !loading && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Red flag alerts */}
          {flags.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid rgba(163,45,45,0.25)', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ background: '#FCEBEB', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>🚩</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#A32D2D' }}>Attendance Flags</span>
                <span style={{ fontSize: '11px', color: '#A32D2D', opacity: 0.7 }}>— students requiring attention</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {flags.map((flag, fi) => {
                  const student = enrolledStudents.find(s => s.id === flag.student_id)
                  if (!student) return null
                  const colors = getAvatarColors(student.full_name)
                  const isActioning = actionFlagId === flag.id
                  const reasonLabel = flag.flag_type === 'consecutive_3'
                    ? '3 consecutive absences'
                    : '5 accumulated absences'
                  return (
                    <div key={flag.id} style={{
                      padding: '12px 16px',
                      borderBottom: fi < flags.length - 1 ? '0.5px solid rgba(0,0,0,0.07)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} size={28} seed={student.avatar_seed} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
                          <div style={{ fontSize: '11px', color: '#888' }}>{reasonLabel}</div>
                        </div>
                        {/* Status badge */}
                        {flag.status === 'flagged' && (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: '#FCEBEB', color: '#A32D2D' }}>
                            ⚠ Needs action
                          </span>
                        )}
                        {flag.status === 'action_taken' && (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: '#FEF3CD', color: '#7A4F00' }}>
                            ✓ Action taken
                          </span>
                        )}
                        {flag.status === 'escalated' && (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: '#FCEBEB', color: '#A32D2D', border: '1px solid rgba(163,45,45,0.3)' }}>
                            🔴 Endorse to Program Head
                          </span>
                        )}
                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {flag.status === 'flagged' && !isActioning && (
                            <button
                              onClick={() => { setActionFlagId(flag.id); setActionNote('') }}
                              style={{
                                padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px',
                                border: 'none', background: '#1D9E75', color: '#fff',
                                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              Talked to student
                            </button>
                          )}
                          {flag.status === 'escalated' && (
                            <button
                              onClick={() => resolveFlag(flag.id)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent',
                                color: '#888', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              }}
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Action note display */}
                      {flag.status === 'action_taken' && flag.action_note && (
                        <div style={{ marginTop: '6px', marginLeft: '38px', fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
                          Note: {flag.action_note}
                        </div>
                      )}
                      {/* Inline action form */}
                      {isActioning && (
                        <div style={{ marginTop: '8px', marginLeft: '38px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            value={actionNote}
                            onChange={e => setActionNote(e.target.value)}
                            placeholder="Note what was discussed…"
                            autoFocus
                            style={{
                              padding: '6px 10px', fontSize: '12px', borderRadius: '7px',
                              border: '0.5px solid rgba(0,0,0,0.25)', fontFamily: 'Inter, sans-serif',
                              outline: 'none', flex: 1, minWidth: '180px',
                            }}
                          />
                          <button
                            onClick={async () => {
                              await markActionTaken(flag.id, actionNote)
                              setActionFlagId(null)
                            }}
                            style={{
                              padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '7px',
                              border: 'none', background: '#1D9E75', color: '#fff',
                              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setActionFlagId(null)}
                            style={{
                              padding: '6px 10px', fontSize: '12px', borderRadius: '7px',
                              border: '0.5px solid rgba(0,0,0,0.15)', background: 'transparent',
                              cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: '#555',
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
          )}

          {/* Student stats table */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.10)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>Student</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#0F6E56', fontWeight: 600 }}>Present</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#7A4F00', fontWeight: 600 }}>Late</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#A32D2D', fontWeight: 600 }}>Absent</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#666', fontWeight: 600 }}>Excused</th>
                  <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {enrolledStudents.map((student, i) => {
                  const sessionIds = new Set(sessions.map(s => s.id))
                  const sr = records.filter(r => r.student_id === student.id && sessionIds.has(r.session_id))
                  const p = sr.filter(r => r.status === 'present').length
                  const l = sr.filter(r => r.status === 'late').length
                  const a = sr.filter(r => r.status === 'absent').length
                  const e = sr.filter(r => r.status === 'excused').length
                  const total = sessions.length
                  const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 0
                  const colors = getAvatarColors(student.full_name)
                  const studentFlags = flags.filter(f => f.student_id === student.id)
                  const isFlagged = studentFlags.length > 0
                  const isEscalated = studentFlags.some(f => f.status === 'escalated')
                  return (
                    <tr key={student.id} style={{
                      borderBottom: i < enrolledStudents.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none',
                      background: isEscalated ? 'rgba(163,45,45,0.03)' : isFlagged ? 'rgba(252,235,235,0.4)' : 'transparent',
                    }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} size={26} seed={student.avatar_seed} />
                          <span style={{ fontWeight: 500 }}>{student.full_name}</span>
                          {isEscalated && <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '999px', background: '#FCEBEB', color: '#A32D2D' }}>Escalated</span>}
                          {!isEscalated && isFlagged && <span style={{ fontSize: '10px' }}>🚩</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 14px', color: '#0F6E56', fontWeight: 500 }}>{p}</td>
                      <td style={{ textAlign: 'center', padding: '10px 14px', color: '#7A4F00', fontWeight: 500 }}>{l}</td>
                      <td style={{ textAlign: 'center', padding: '10px 14px', color: '#A32D2D', fontWeight: 500 }}>{a}</td>
                      <td style={{ textAlign: 'center', padding: '10px 14px', color: '#666', fontWeight: 500 }}>{e}</td>
                      <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: rate >= 80 ? '#0F6E56' : rate >= 60 ? '#7A4F00' : '#A32D2D' }}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sessions list */}
      {view === 'sessions' && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
      </div>}
    </div>
  )
}
