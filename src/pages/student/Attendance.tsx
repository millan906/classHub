import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMyAttendance } from '../../hooks/useAttendance'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
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

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)

function rateAccentColor(rate: number): string {
  if (rate >= 80) return '#1D9E75'
  if (rate >= 60) return '#C87000'
  return '#A32D2D'
}

export default function StudentAttendance() {
  const { profile } = useAuth()
  const { sessions, records, loading } = useMyAttendance(profile?.id ?? null)
  const { courses } = useCourses()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['__all__']))

  if (loading) return <Spinner />

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  // Overall stats (filtered by dropdown)
  const filteredSessions = selectedCourseId
    ? sessions.filter(s => s.course_id === selectedCourseId)
    : sessions
  const filteredRecords = selectedCourseId
    ? records.filter(r => filteredSessions.some(s => s.id === r.session_id))
    : records

  const totalPresent = filteredRecords.filter(r => r.status === 'present').length
  const totalLate    = filteredRecords.filter(r => r.status === 'late').length
  const totalAbsent  = filteredRecords.filter(r => r.status === 'absent').length
  const totalSessions = filteredSessions.length
  const overallRate = totalSessions > 0
    ? Math.round(((totalPresent + totalLate) / totalSessions) * 100)
    : null

  const totalAbsences = countTotalAbsences(filteredRecords)
  const consecutiveAbsences = countConsecutiveAbsences(filteredSessions, filteredRecords)
  const redFlagged = isAttendanceFlagged(filteredSessions, filteredRecords)

  // Per-course data (only courses with sessions, filtered by dropdown)
  const perCourseData = enrolledCourses
    .filter(c => !selectedCourseId || c.id === selectedCourseId)
    .map(course => {
      const courseSessions = sessions
        .filter(s => s.course_id === course.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      const courseRecords = records.filter(r => courseSessions.some(s => s.id === r.session_id))
      const present = courseRecords.filter(r => r.status === 'present').length
      const late    = courseRecords.filter(r => r.status === 'late').length
      const absent  = courseRecords.filter(r => r.status === 'absent').length
      const total   = courseSessions.length
      const attended = present + late
      const rate = total > 0 ? Math.round((attended / total) * 100) : null
      return { course, sessions: courseSessions, records: courseRecords, present, late, absent, total, attended, rate }
    })
    .filter(d => d.total > 0)

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Start first course expanded
  const firstCourseId = perCourseData[0]?.course.id
  function isExpanded(id: string) {
    // Default-expand first course if nothing explicitly toggled
    if (expandedIds.has('__all__')) return id === firstCourseId
    return expandedIds.has(id)
  }
  function handleToggle(id: string) {
    if (expandedIds.has('__all__')) {
      // First interaction: replace __all__ sentinel with explicit set
      const explicit = new Set(id === firstCourseId ? [] : [id])
      setExpandedIds(explicit)
    } else {
      toggleExpand(id)
    }
  }

  return (
    <div>
      <PageHeader title="Attendance" subtitle="All sessions across enrolled courses" />

      {/* Course filter */}
      {enrolledCourses.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', fontSize: '13px',
              borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)',
              background: '#fff', fontFamily: 'Inter, sans-serif',
              color: '#1a1a1a', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All courses</option>
            {enrolledCourses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` · ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Red flag warning */}
      {redFlagged && (
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
              {consecutiveAbsences >= ATTENDANCE_CONSECUTIVE_THRESHOLD
                ? `You have ${consecutiveAbsences} consecutive absences.`
                : `You have ${totalAbsences} total absences.`
              }{' '}Please reach out to your instructor as soon as possible.
            </div>
          </div>
        </div>
      )}

      {/* Summary stat cards */}
      {totalSessions > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Overall rate</div>
            <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1, color: overallRate != null ? rateAccentColor(overallRate) : '#ccc' }}>
              {overallRate != null ? `${overallRate}%` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>this semester</div>
          </div>

          {([
            { count: totalPresent, ...STATUS_CONFIG.present },
            { count: totalLate,    ...STATUS_CONFIG.late    },
            { count: totalAbsent,  ...STATUS_CONFIG.absent  },
          ] as { label: string; count: number; bg: string; color: string }[]).map(item => (
            <div key={item.label} style={{ background: item.bg, border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: item.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', opacity: 0.8 }}>{item.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1, color: item.color }}>{item.count}</div>
              <div style={{ fontSize: '11px', color: item.color, opacity: 0.7, marginTop: '4px' }}>sessions</div>
            </div>
          ))}
        </div>
      )}

      {/* Per course section */}
      {perCourseData.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No attendance records yet</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor hasn't recorded any sessions yet.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Per Course
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {perCourseData.map(({ course, sessions: cs, records: cr, present, attended, total, rate }) => {
              const expanded = isExpanded(course.id)
              const accentColor = rate != null ? rateAccentColor(rate) : '#ccc'

              return (
                <div
                  key={course.id}
                  style={{
                    background: '#fff',
                    border: '0.5px solid rgba(0,0,0,0.1)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    borderLeft: `3px solid ${accentColor}`,
                  }}
                >
                  {/* Course header */}
                  <div
                    onClick={() => handleToggle(course.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>
                          {isUUID(course.id) ? course.name : course.id}
                        </span>
                        {course.section && (
                          <span style={{ fontSize: '12px', color: '#888' }}>{course.section}</span>
                        )}
                      </div>
                      {!isUUID(course.id) && (
                        <div style={{ fontSize: '12px', color: '#888' }}>{course.name}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: accentColor, lineHeight: 1 }}>
                          {rate != null ? `${rate}%` : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                          {attended} of {total} present
                        </div>
                      </div>
                      <span style={{ color: '#bbb', fontSize: '13px', flexShrink: 0 }}>
                        {expanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Session rows */}
                  {expanded && (
                    <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
                      {/* Column headers */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 16px',
                        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#aaa' }}>Session</span>
                        <div style={{ display: 'flex', gap: '32px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#aaa' }}>Date</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#aaa' }}>Status</span>
                        </div>
                      </div>

                      {cs.map((session, i) => {
                        const record = cr.find(r => r.session_id === session.id)
                        const status = record?.status ?? null
                        const cfg = status ? STATUS_CONFIG[status] : null
                        const dateStr = new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        return (
                          <div
                            key={session.id}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '10px 16px',
                              borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {session.label}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
                              <span style={{ fontSize: '13px', color: '#888', minWidth: '48px', textAlign: 'right' }}>{dateStr}</span>
                              {cfg
                                ? <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '999px', background: cfg.bg, color: cfg.color, minWidth: '70px', textAlign: 'center' }}>{cfg.label}</span>
                                : <span style={{ fontSize: '11px', color: '#bbb', minWidth: '70px', textAlign: 'center' }}>Not recorded</span>
                              }
                            </div>
                          </div>
                        )
                      })}

                      {/* Course footer summary */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 16px',
                        borderTop: '0.5px solid rgba(0,0,0,0.07)',
                        background: '#FAFAF8',
                      }}>
                        <span style={{ fontSize: '12px', color: '#aaa' }}>{total} session{total !== 1 ? 's' : ''} recorded</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: accentColor }}>{present} / {total}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Footer note */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '24px', paddingBottom: '8px' }}>
        Maximum allowable absences per course is typically 20% of total sessions · consult your student handbook
      </div>
    </div>
  )
}
