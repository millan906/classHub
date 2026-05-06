import { useState } from 'react'
import { Button } from '../ui/Button'
import type { GradeColumn } from '../../hooks/useGradeBook'
import type { QuizException } from '../../types'

interface Props {
  col: GradeColumn
  maxAttempts: number
  students: { id: string; full_name: string }[]
  submissionCounts: Record<string, number>   // studentId → attempts used
  exceptions: QuizException[]
  onGrant: (studentId: string, reason: string) => Promise<void>
  onRevoke: (studentId: string) => Promise<void>
  onClose: () => void
}

export function ExceptionsPanel({
  col, maxAttempts, students, submissionCounts, exceptions, onGrant, onRevoke, onClose,
}: Props) {
  const [saving, setSaving] = useState<string | null>(null) // studentId being saved
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({})
  const exceptionMap = new Map(exceptions.map(e => [e.student_id, e]))

  async function handleGrant(studentId: string) {
    setSaving(studentId)
    try { await onGrant(studentId, reasonMap[studentId] ?? '') } finally { setSaving(null) }
  }
  async function handleRevoke(studentId: string) {
    setSaving(studentId)
    try { await onRevoke(studentId) } finally { setSaving(null) }
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Student Exceptions — {col.title}</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            Grant extra attempts for specific students. Does not affect the rest of the class.
          </div>
        </div>
        <Button onClick={onClose} style={{ fontSize: '11px' }}>Done</Button>
      </div>

      {students.length === 0 && (
        <div style={{ fontSize: '12px', color: '#aaa' }}>No enrolled students.</div>
      )}

      {students.map(s => {
        const exc = exceptionMap.get(s.id)
        const used = submissionCounts[s.id] ?? 0
        const effective = maxAttempts + (exc?.extra_attempts ?? 0)
        const isSaving = saving === s.id

        return (
          <div key={s.id} style={{
            display: 'flex', flexDirection: 'column', gap: '6px',
            padding: '10px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Avatar */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: '#E6F1FB', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#1a5fa8',
              }}>
                {s.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>

              {/* Name + attempt count */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.full_name}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  {used} / {effective} attempt{effective !== 1 ? 's' : ''} used
                  {exc && (
                    <span style={{ marginLeft: '6px', color: '#1D9E75', fontWeight: 600 }}>
                      +{exc.extra_attempts} granted
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              {exc ? (
                <Button
                  variant="danger"
                  onClick={() => { void handleRevoke(s.id) }}
                  disabled={isSaving}
                  style={{ fontSize: '11px' }}
                >
                  {isSaving ? '…' : 'Revoke'}
                </Button>
              ) : (
                <Button
                  onClick={() => { void handleGrant(s.id) }}
                  disabled={isSaving}
                  style={{ fontSize: '11px' }}
                >
                  {isSaving ? '…' : 'Grant attempt'}
                </Button>
              )}
            </div>

            {/* Reason */}
            {exc ? (
              exc.reason && (
                <div style={{ fontSize: '11px', color: '#555', paddingLeft: '42px' }}>
                  <span style={{ color: '#aaa' }}>Reason: </span>{exc.reason}
                </div>
              )
            ) : (
              <input
                type="text"
                placeholder="Reason (e.g. medical, technical issue)…"
                value={reasonMap[s.id] ?? ''}
                onChange={e => setReasonMap(prev => ({ ...prev, [s.id]: e.target.value }))}
                style={{
                  marginLeft: '42px', fontSize: '11px', padding: '5px 8px',
                  border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '6px',
                  fontFamily: 'inherit', outline: 'none', color: '#333',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
