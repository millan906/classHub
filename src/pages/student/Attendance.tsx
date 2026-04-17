import { useAuth } from '../../hooks/useAuth'
import { useMyAttendance } from '../../hooks/useAttendance'
import { useCourses } from '../../hooks/useCourses'
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

  if (loading) return <Spinner />

  const present = records.filter(r => r.status === 'present').length
  const late = records.filter(r => r.status === 'late').length
  const absent = records.filter(r => r.status === 'absent').length
  const excused = records.filter(r => r.status === 'excused').length
  const total = records.length

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Your attendance record across all courses." />

      {/* Summary cards */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { title: 'Present', count: present, ...STATUS_CONFIG.present },
            { title: 'Late', count: late, ...STATUS_CONFIG.late },
            { title: 'Absent', count: absent, ...STATUS_CONFIG.absent },
            { title: 'Excused', count: excused, ...STATUS_CONFIG.excused },
          ].map(item => (
            <div key={item.title} style={{
              flex: 1, minWidth: '80px', padding: '10px 14px', borderRadius: '10px',
              border: '0.5px solid rgba(0,0,0,0.08)', background: item.bg,
            }}>
              <div style={{ fontSize: '20px', fontWeight: 600, color: item.color }}>{item.count}</div>
              <div style={{ fontSize: '11px', color: item.color, opacity: 0.8 }}>{item.title}</div>
            </div>
          ))}
          <div style={{
            flex: 1, minWidth: '80px', padding: '10px 14px', borderRadius: '10px',
            border: '0.5px solid rgba(0,0,0,0.08)', background: '#fff',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              {total > 0 ? Math.round(((present + late) / total) * 100) : 0}%
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>Attendance rate</div>
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '3rem' }}>
          No attendance records yet.
        </div>
      )}

      {/* Session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sessions.map(session => {
          const record = records.find(r => r.session_id === session.id)
          const status = record?.status ?? null
          const course = courses.find(c => c.id === session.course_id)
          const cfg = status ? STATUS_CONFIG[status] : null
          return (
            <div key={session.id} style={{
              background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)',
              borderRadius: '10px', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '1px' }}>{session.label}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  {course ? ` · ${course.name}${course.section ? ` ${course.section}` : ''}` : ''}
                </div>
              </div>
              {cfg ? (
                <span style={{
                  fontSize: '11px', fontWeight: 500, padding: '3px 10px',
                  borderRadius: '999px', background: cfg.bg, color: cfg.color,
                }}>
                  {cfg.label}
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: '#bbb' }}>Not recorded</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
