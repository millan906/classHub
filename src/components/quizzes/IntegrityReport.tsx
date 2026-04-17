import { useEffect, useState } from 'react'
import { useIntegrityLogs } from '../../hooks/useIntegrityLogs'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import type { Profile, QuizSubmission, IntegrityLog } from '../../types'

interface IntegrityReportProps {
  quizId: string
  enrolledStudents: Profile[]
  submissions: QuizSubmission[]
}

type RiskLevel = 'high_risk' | 'flagged' | 'clean'

function getRiskLevel(logs: IntegrityLog[]): RiskLevel {
  const fullscreenExits = logs.filter(l => l.event_type === 'fullscreen_exit').length
  const tabSwitches = logs.filter(l => l.event_type === 'tab_switch').length
  const focusLosses = logs.filter(l => l.event_type === 'focus_loss').length
  if (fullscreenExits > 0 || tabSwitches >= 3) return 'high_risk'
  if (tabSwitches > 0 || focusLosses >= 2) return 'flagged'
  return 'clean'
}

const riskBadge: Record<RiskLevel, { label: string; bg: string; color: string }> = {
  high_risk: { label: 'High Risk', bg: '#FCEBEB', color: '#A32D2D' },
  flagged:   { label: 'Flagged',   bg: '#FEF3CD', color: '#7A4F00' },
  clean:     { label: 'Clean',     bg: '#E1F5EE', color: '#0F6E56' },
}

const riskDot: Record<RiskLevel, string> = {
  high_risk: '#A32D2D',
  flagged:   '#D4900A',
  clean:     '#1D9E75',
}

const severityColors: Record<string, string> = {
  high:   '#A32D2D',
  medium: '#D4900A',
  low:    '#888',
}

function summarizeEvents(logs: IntegrityLog[]): string {
  const parts: string[] = []
  const tabs = logs.filter(l => l.event_type === 'tab_switch').length
  const focus = logs.filter(l => l.event_type === 'focus_loss').length
  const fs = logs.filter(l => l.event_type === 'fullscreen_exit').length
  const inactive = logs.filter(l => l.event_type === 'no_activity').length
  if (tabs > 0) parts.push(`Tab switched ${tabs}x`)
  if (focus > 0) parts.push(`Focus lost ${focus}x`)
  if (fs > 0) parts.push(`Fullscreen exited ${fs}x`)
  if (inactive > 0) parts.push(`Inactive ${inactive}x`)
  return parts.join(' · ') || 'No events'
}

export function IntegrityReport({ quizId, enrolledStudents, submissions }: IntegrityReportProps) {
  const { fetchLogsForQuiz } = useIntegrityLogs()
  const [logs, setLogs] = useState<IntegrityLog[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchLogsForQuiz(quizId).then(setLogs)
  }, [quizId])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const studentsWhoTook = enrolledStudents.filter(s => submissions.some(sub => sub.student_id === s.id))
  const studentsWhoDidnt = enrolledStudents.filter(s => !submissions.some(sub => sub.student_id === s.id))

  const studentRisks = studentsWhoTook.map(s => {
    const studentLogs = logs.filter(l => l.student_id === s.id)
    const risk = getRiskLevel(studentLogs)
    const sub = submissions.find(sub => sub.student_id === s.id)
    return { student: s, logs: studentLogs, risk, sub }
  })

  const flaggedCount = studentRisks.filter(r => r.risk !== 'clean').length
  const cleanCount = studentRisks.filter(r => r.risk === 'clean').length

  const metricCard = (label: string, value: string | number, bg?: string) => (
    <div style={{
      flex: 1, padding: '12px 16px', borderRadius: '12px',
      border: '0.5px solid rgba(0,0,0,0.12)',
      background: bg || '#fff',
    }}>
      <div style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a1a' }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{label}</div>
    </div>
  )

  return (
    <div>
      {/* Metric cards */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {metricCard('Students took quiz', studentsWhoTook.length)}
        {metricCard('Flagged students', flaggedCount, flaggedCount > 0 ? '#FEF3CD' : undefined)}
        {metricCard('Clean submissions', cleanCount, '#E1F5EE')}
      </div>

      {/* Per-student rows */}
      {studentRisks.map(({ student, logs: sLogs, risk, sub }) => {
        const colors = getAvatarColors(student.full_name)
        const badge = riskBadge[risk]
        const dot = riskDot[risk]
        const expanded = expandedIds.has(student.id)
        return (
          <div key={student.id} style={{
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px', padding: '10px 12px', marginBottom: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: dot, flexShrink: 0,
              }} />
              <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                  {summarizeEvents(sLogs)}
                  {sub ? ` · Score: ${sub.score}%` : ''}
                </div>
                {sub && (
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                    {sub.submitted_at && (
                      <span>Submitted {new Date(sub.submitted_at).toLocaleTimeString()}</span>
                    )}
                    {sub.submitted_at && sub.started_at && (() => {
                      const mins = Math.round((new Date(sub.submitted_at).getTime() - new Date(sub.started_at).getTime()) / 60000)
                      return <span> · {mins} min{mins !== 1 ? 's' : ''}</span>
                    })()}
                    {sub.keystroke_count != null && (
                      <span> · {sub.keystroke_count} keystrokes</span>
                    )}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                borderRadius: '999px', background: badge.bg, color: badge.color,
              }}>
                {badge.label}
              </span>
              {risk !== 'clean' && (
                <button
                  onClick={() => toggleExpand(student.id)}
                  style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '8px',
                    border: '0.5px solid rgba(0,0,0,0.25)', background: 'transparent',
                    cursor: 'pointer', color: '#666', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {expanded ? 'Hide log' : 'View log'}
                </button>
              )}
            </div>
            {expanded && sLogs.length > 0 && (
              <div style={{
                marginTop: '10px', paddingTop: '10px',
                borderTop: '0.5px solid rgba(0,0,0,0.08)',
              }}>
                {sLogs.map(log => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontSize: '12px', marginBottom: '4px',
                  }}>
                    <span style={{ color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(log.occurred_at).toLocaleTimeString()}
                    </span>
                    <span style={{
                      padding: '1px 6px', borderRadius: '4px',
                      background: log.severity === 'high' ? '#FCEBEB' : log.severity === 'medium' ? '#FEF3CD' : '#F5F5F3',
                      color: severityColors[log.severity], fontSize: '11px', fontWeight: 500,
                    }}>
                      {log.severity.toUpperCase()}
                    </span>
                    <span style={{ color: '#444' }}>{log.event_type.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Students who didn't take quiz */}
      {studentsWhoDidnt.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>No submission</div>
          {studentsWhoDidnt.map(s => {
            const colors = getAvatarColors(s.full_name)
            return (
              <div key={s.id} style={{
                background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
                borderRadius: '12px', padding: '10px 12px', marginBottom: '8px',
                display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6,
              }}>
                <Avatar initials={getInitials(s.full_name)} bg={colors.bg} color={colors.color} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.full_name}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>No submission</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {enrolledStudents.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888' }}>No enrolled students.</div>
      )}
    </div>
  )
}
