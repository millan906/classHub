import React, { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { inputStyle } from '../../styles/shared'
import type { GradeGroup, GradeColumn, GradeEntry } from '../../hooks/useGradeBook'
import type { Profile } from '../../types'

interface ManualEntriesSectionProps {
  columns: GradeColumn[]
  groups: GradeGroup[]
  enrolled: Profile[]
  entries: GradeEntry[]
  onSaveScore: (columnId: string, studentId: string, score: number | null) => Promise<void>
  onDeleteColumn: (columnId: string) => Promise<void>
}

export function ManualEntriesSection({ columns, groups, enrolled, entries, onSaveScore, onDeleteColumn }: ManualEntriesSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GradeColumn | null>(null)

  const manualColumns = columns.filter(c => c.entry_type === 'manual')
  if (manualColumns.length === 0) return null

  return (
    <div style={{ marginTop: '24px' }}>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete entry"
          message={`Delete "${confirmDelete.title}"? All student scores for this entry will be removed.`}
          onConfirm={async () => { await onDeleteColumn(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <div style={{ fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Manual Entries
      </div>
      {manualColumns.map(col => {
        const group = groups.find(g => g.id === col.group_id)
        const isExpanded = expandedId === col.id
        return (
          <div key={col.id} style={{
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px', marginBottom: '8px', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{col.title}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                  {group ? group.name : 'No group'} · Max {col.max_score} pts
                </div>
              </div>
              <button
                onClick={() => setExpandedId(isExpanded ? null : col.id)}
                style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent', cursor: 'pointer', color: '#444', fontFamily: 'Inter, sans-serif' }}
              >
                {isExpanded ? 'Hide scores' : 'Enter scores'}
              </button>
              <button
                onClick={() => setConfirmDelete(col)}
                style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '0.5px solid rgba(220,50,50,0.3)', background: 'transparent', cursor: 'pointer', color: '#c0392b', fontFamily: 'Inter, sans-serif' }}
              >
                Delete
              </button>
            </div>
            {isExpanded && (
              <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', padding: '10px 14px' }}>
                {col.description && (
                  <div style={{ fontSize: '13px', color: '#444', background: '#F8F7F2', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    {col.description}
                  </div>
                )}
                {enrolled.length === 0 && <div style={{ fontSize: '12px', color: '#aaa' }}>No enrolled students.</div>}
                {enrolled.map(student => {
                  const entry = entries.find(e => e.column_id === col.id && e.student_id === student.id)
                  return (
                    <ManualScoreRow
                      key={student.id}
                      student={student}
                      colors={getAvatarColors(student.full_name)}
                      maxScore={col.max_score}
                      currentScore={entry?.score ?? null}
                      onSave={score => onSaveScore(col.id, student.id, score)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ManualScoreRow ───────────────────────────────────────────────────────────

interface ManualScoreRowProps {
  student: Pick<Profile, 'id' | 'full_name'>
  colors: { bg: string; color: string }
  maxScore: number
  currentScore: number | null
  onSave: (score: number | null) => Promise<void>
}

function ManualScoreRow({ student, colors, maxScore, currentScore, onSave }: ManualScoreRowProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(currentScore !== null ? String(currentScore) : '')

  useEffect(() => {
    setVal(currentScore !== null ? String(currentScore) : '')
  }, [currentScore])

  async function commit() {
    setEditing(false)
    const n = val.trim() === '' ? null : parseFloat(val)
    if (n === currentScore) return
    if (val.trim() !== '' && (isNaN(n!) || n! < 0)) { setVal(currentScore !== null ? String(currentScore) : ''); return }
    await onSave(n)
  }

  const pct = currentScore !== null ? Math.round((currentScore / maxScore) * 100) : null
  const barColor = pct === null ? '#E5E5E5' : pct >= 75 ? '#1D9E75' : pct >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
      <Avatar initials={getInitials(student.full_name)} bg={colors.bg} color={colors.color} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{student.full_name}</div>
        {pct !== null && (
          <div style={{ height: '3px', background: '#F1EFE8', borderRadius: '999px', marginTop: '4px' }}>
            <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: '999px', transition: 'width 0.2s' }} />
          </div>
        )}
      </div>
      {editing ? (
        <input
          autoFocus
          style={{ ...inputStyle, width: '70px', textAlign: 'right' }}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setEditing(false); setVal(currentScore !== null ? String(currentScore) : '') }
          }}
        />
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{ fontSize: '13px', fontWeight: 500, minWidth: '70px', textAlign: 'right', cursor: 'pointer', padding: '3px 7px', borderRadius: '6px', border: '0.5px solid transparent', color: currentScore !== null ? '#1a1a1a' : '#aaa' }}
          onMouseEnter={e => (e.currentTarget.style.border = '0.5px solid rgba(0,0,0,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.border = '0.5px solid transparent')}
        >
          {currentScore !== null ? `${currentScore} / ${maxScore}` : '— / ' + maxScore}
        </div>
      )}
    </div>
  )
}
