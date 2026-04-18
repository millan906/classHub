import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMyAttendance } from '../../hooks/useAttendance'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useIsMobile } from '../../hooks/useIsMobile'
import { ATTENDANCE_CONSECUTIVE_THRESHOLD } from '../../constants/attendance'
import { countConsecutiveAbsences, countTotalAbsences, isAttendanceFlagged } from '../../utils/attendanceFlags'
import { PageHeader } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import type { AttendanceStatus } from '../../types'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; bg: string; color: string }> = {
  present:  { label: 'Present',  bg: '#E1F5EE', color: '#0F6E56' },
  late:     { label: 'Late',     bg: '#FEF3CD', color: '#7A4F00' },
  absent:   { label: 'Absent',   bg: '#FCEBEB', color: '#A32D2D' },
  excused:  { label: 'Excused',  bg: '#F1EFE8', color: '#666'    },
}

export default function StudentAttendance() {
  const { profile } = useAuth()
  const { sessions, records, loading } = useMyAttendance(profile?.id ?? null)
  const { courses } = useCourses()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const isMobile = useIsMobile()
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  if (loading) return <Spinner />

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  const filteredSessions = selectedCourseId
    ? sessions.filter(s => s.course_id === selectedCourseId)
    : sessions
  const filteredRecords = selectedCourseId
    ? records.filter(r => filteredSessions.some(s => s.id === r.session_id))
    : records

  const present = filteredRecords.filter(r => r.status === 'present').length
  const late = filteredRecords.filter(r => r.status === 'late').length
  const absent = filteredRecords.filter(r => r.status === 'absent').length
  const excused = filteredRecords.filter(r => r.status === 'excused').length
  const total = filteredRecords.length

  const totalAbsent = countTotalAbsences(filteredRecords)
  const consecutive = countConsecutiveAbsences(filteredSessions, filteredRecords)
  const isRedFlagged = isAttendanceFlagged(filteredSessions, filteredRecords)

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Your attendance record across all courses." />

      {/* Course filter */}
      {enrolledCourses.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{
              padding: '8px 12px', fontSize: '13px', borderRadius: '8px',
              border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
              fontFamily: 'Inter, sans-serif', outline: 'none',
              width: isMobile ? '100%' : 'auto', minWidth: isMobile ? undefined : '200px',
            }}
          >
            <option value="">All courses</option>
            {enrolledCourses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` · Section ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Red flag warning */}
      {isRedFlagged && (
        <div style={{
          background: '#FCEBEB', border: '1px solid rgba(163,45,45,0.25)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '14px',
          display: 'flex', gap: '12px', alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>⚠️</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#A32D2D', marginBottom: '3px' }}>
              Attendance Warning
            </div>
            <div style={{ fontSize: '12px', color: '#A32D2D', lineHeight: 1.5 }}>
              {consecutive >= ATTENDANCE_CONSECUTIVE_THRESHOLD
                ? `You have ${consecutive} consecutive absences.`
                : `You have ${totalAbsent} total absences.`
              } Please reach out to your instructor as soon as possible to discuss this matter.
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {[
            { title: 'Present',  count: present,  ...STATUS_CONFIG.present },
            { title: 'Late',     count: late,     ...STATUS_CONFIG.late },
            { title: 'Absent',   count: absent,   ...STATUS_CONFIG.absent },
            { title: 'Excused',  count: excused,  ...STATUS_CONFIG.excused },
          ].map(item => (
            <div key={item.title} style={{
              padding: '10px 12px', borderRadius: '10px',
              border: '0.5px solid rgba(0,0,0,0.08)', background: item.bg,
            }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: item.color }}>{item.count}</div>
              <div style={{ fontSize: '11px', color: item.color, opacity: 0.8 }}>{item.title}</div>
            </div>
          ))}
          <div style={{
            padding: '10px 12px', borderRadius: '10px',
            border: '0.5px solid rgba(0,0,0,0.08)', background: '#fff',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              {Math.round(((present + late) / total) * 100)}%
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>Rate</div>
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '3rem' }}>
          No attendance records yet.
        </div>
      )}

      {/* Session list */}
      {filteredSessions.length > 0 && (
        isMobile
          ? (
            /* Mobile: stacked card layout */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredSessions.map((session) => {
                const record = records.find(r => r.session_id === session.id)
                const status = record?.status ?? null
                const course = courses.find(c => c.id === session.course_id)
                const cfg = status ? STATUS_CONFIG[status] : null
                return (
                  <div key={session.id} style={{
                    background: '#fff', borderRadius: '10px',
                    border: '0.5px solid rgba(0,0,0,0.09)', padding: '12px 14px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>
                        {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {course && !selectedCourseId && ` · ${course.name}${course.section ? ` ${course.section}` : ''}`}
                      </div>
                    </div>
                    {cfg
                      ? <span style={{ fontSize: '11px', fontWeight: 500, padding: '4px 12px', borderRadius: '999px', background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                      : <span style={{ fontSize: '11px', color: '#bbb', flexShrink: 0 }}>Not recorded</span>
                    }
                  </div>
                )
              })}
            </div>
          ) : (
            /* Desktop: table layout */
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.10)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>Topic</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>Course</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '11px', color: '#888', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session, i) => {
                    const record = records.find(r => r.session_id === session.id)
                    const status = record?.status ?? null
                    const course = courses.find(c => c.id === session.course_id)
                    const cfg = status ? STATUS_CONFIG[status] : null
                    return (
                      <tr key={session.id} style={{ borderBottom: i < filteredSessions.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : undefined }}>
                        <td style={{ padding: '10px 14px', color: '#bbb', fontSize: '12px' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{session.label}</td>
                        <td style={{ padding: '10px 14px', color: '#888' }}>
                          {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#888' }}>
                          {course ? `${course.name}${course.section ? ` ${course.section}` : ''}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {cfg ? (
                            <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '999px', background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#bbb' }}>Not recorded</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  )
}
