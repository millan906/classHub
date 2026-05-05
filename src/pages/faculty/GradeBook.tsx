import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuizzes } from '../../hooks/useQuizzes'
import { supabase } from '../../lib/supabase'
import { useStudents } from '../../hooks/useStudents'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useCourses } from '../../hooks/useCourses'
import { useAllEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inputStyle } from '../../styles/shared'
import { computeWeightedGrade, extractEarned } from '../../utils/gradeCalculations'
import { TYPE_CONFIG } from '../../components/quizzes/QuizBuilder'
import type { GradeGroup, GradeColumn } from '../../hooks/useGradeBook'
import type { QuizException } from '../../types'

const thStyle: React.CSSProperties = {
  padding: '8px 10px', fontWeight: 500, fontSize: '11px',
  color: '#888', textAlign: 'center', whiteSpace: 'nowrap',
  borderBottom: '0.5px solid rgba(0,0,0,0.1)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'center', fontSize: '13px',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(pct: number | null): string {
  if (pct === null) return '#ccc'
  if (pct >= 75) return '#0F6E56'
  if (pct >= 50) return '#D4900A'
  return '#A32D2D'
}

// ─── ScoreCell ────────────────────────────────────────────────────────────────

function ScoreCell({
  value, maxScore, readOnly, onSave,
}: {
  value: number | null
  maxScore: number
  readOnly?: boolean
  onSave?: (v: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    if (readOnly) return
    setDraft(value !== null ? String(value) : '')
    setEditing(true)
  }

  async function commit() {
    setEditing(false)
    if (!onSave) return
    const n = parseFloat(draft)
    await onSave(isNaN(n) ? null : Math.max(0, Math.min(n, maxScore)))
  }

  const pct = value !== null && maxScore > 0 ? Math.round((value / maxScore) * 100) : null

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { void commit() }}
        onKeyDown={e => {
          if (e.key === 'Enter') void commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{ ...inputStyle, width: '52px', textAlign: 'center' }}
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      title={pct !== null ? `${pct}%` : undefined}
      style={{
        color: gradeColor(pct),
        fontWeight: value !== null ? 600 : 400,
        cursor: readOnly ? 'default' : 'pointer',
        padding: '2px 4px', borderRadius: '4px',
        display: 'inline-block', minWidth: '36px', textAlign: 'center',
      }}
    >
      {value !== null ? `${value}` : '—'}
    </span>
  )
}

// ─── Group management panel ───────────────────────────────────────────────────

function ManageGroupsPanel({
  groups,
  onAdd,
  onUpdate,
  onDelete,
  onClose,
}: {
  groups: GradeGroup[]
  onAdd: (name: string, weight: number) => Promise<void>
  onUpdate: (id: string, name: string, weight: number) => Promise<void>
  onDelete: (group: GradeGroup) => void
  onClose: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const totalWeight = groups.reduce((s, g) => s + g.weight_percent, 0)
  const weightOk = Math.round(totalWeight) === 100

  function startEdit(g: GradeGroup) {
    setEditingId(g.id)
    setEditName(g.name)
    setEditWeight(String(g.weight_percent))
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await onUpdate(id, editName.trim(), parseFloat(editWeight) || 0)
    setSaving(false)
    setEditingId(null)
  }

  async function saveNew() {
    if (!newName.trim()) return
    setSaving(true)
    setAddError('')
    try {
      await onAdd(newName.trim(), parseFloat(newWeight) || 0)
      setAddingNew(false)
      setNewName('')
      setNewWeight('')
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', padding: '14px 16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Manage Groups</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px',
            borderRadius: '999px',
            background: weightOk ? '#E1F5EE' : '#FEF3CD',
            color: weightOk ? '#0F6E56' : '#7A4F00',
          }}>
            Total: {totalWeight}% {weightOk ? '✓' : '— should be 100%'}
          </span>
          <Button onClick={onClose} style={{ fontSize: '11px' }}>Done</Button>
        </div>
      </div>

      {groups.map(g => (
        <div key={g.id} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)',
        }}>
          {editingId === g.id ? (
            <>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ ...inputStyle, flex: 2 }} />
              <input value={editWeight} onChange={e => setEditWeight(e.target.value)}
                style={{ ...inputStyle, width: '60px' }} type="number" min="0" max="100" />
              <span style={{ fontSize: '11px', color: '#888' }}>%</span>
              <Button variant="primary" onClick={() => saveEdit(g.id)} disabled={saving} style={{ fontSize: '11px' }}>
                Save
              </Button>
              <Button onClick={() => setEditingId(null)} style={{ fontSize: '11px' }}>Cancel</Button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, fontSize: '13px' }}>{g.name}</div>
              <div style={{ fontSize: '12px', color: '#888', minWidth: '48px', textAlign: 'right' }}>
                {g.weight_percent}%
              </div>
              <Button onClick={() => startEdit(g)} style={{ fontSize: '11px' }}>Edit</Button>
              <Button variant="danger" onClick={() => onDelete(g)} style={{ fontSize: '11px' }}>Delete</Button>
            </>
          )}
        </div>
      ))}

      {addingNew ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Group name" style={{ ...inputStyle, flex: 2 }} />
            <input value={newWeight} onChange={e => setNewWeight(e.target.value)}
              placeholder="Weight" style={{ ...inputStyle, width: '60px' }} type="number" min="0" max="100" />
            <span style={{ fontSize: '11px', color: '#888' }}>%</span>
            <Button variant="primary" onClick={saveNew} disabled={saving || !newName.trim()} style={{ fontSize: '11px' }}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
            <Button onClick={() => { setAddingNew(false); setAddError('') }} style={{ fontSize: '11px' }}>Cancel</Button>
          </div>
          {addError && <div style={{ fontSize: '11px', color: '#A32D2D', marginTop: '4px' }}>{addError}</div>}
        </>
      ) : (
        <Button onClick={() => setAddingNew(true)} style={{ fontSize: '11px', marginTop: '10px' }}>
          + Add group
        </Button>
      )}
    </div>
  )
}

// ─── Add column form ──────────────────────────────────────────────────────────

function AddColumnForm({
  groups,
  onAdd,
  onCancel,
}: {
  groups: GradeGroup[]
  onAdd: (title: string, groupId: string, maxScore: number) => Promise<void>
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '')
  const [maxScore, setMaxScore] = useState('100')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!title.trim() || !groupId) return
    setSaving(true)
    setError('')
    try {
      await onAdd(title.trim(), groupId, parseFloat(maxScore) || 100)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add column')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', padding: '12px 14px', marginBottom: '12px',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>New column</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>Column name</div>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Lab 2, Midterm Exam"
            style={{ ...inputStyle, width: '160px' }}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>Group</div>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} style={inputStyle}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>Max points</div>
          <input
            value={maxScore}
            onChange={e => setMaxScore(e.target.value)}
            style={{ ...inputStyle, width: '72px' }}
            type="number" min="1"
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button variant="primary" onClick={() => { void handleSave() }} disabled={saving || !title.trim() || !groupId} style={{ fontSize: '12px' }}>
            {saving ? 'Adding...' : 'Add'}
          </Button>
          <Button onClick={onCancel} style={{ fontSize: '12px' }}>Cancel</Button>
        </div>
      </div>
      {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '6px' }}>{error}</div>}
    </div>
  )
}

// ─── Download helpers ─────────────────────────────────────────────────────────

interface GradeBookExportParams {
  students: { id: string; full_name: string }[]
  groups: GradeGroup[]
  columns: GradeColumn[]
  getColumnScore: (sid: string, col: GradeColumn) => number | null
  getWeightedGrade: (sid: string) => number | null
  filename?: string
}

function buildRows({ students, groups, columns, getColumnScore, getWeightedGrade }: GradeBookExportParams) {
  const headers = [
    'Student Name',
    ...groups.flatMap(g => columns.filter(c => c.group_id === g.id).map(c => `${c.title} (/${c.max_score})`)),
    'Final Grade',
  ]

  const rows = students.map(s => {
    const cells: (string | number)[] = [s.full_name]
    for (const g of groups) {
      for (const c of columns.filter(col => col.group_id === g.id)) {
        const v = getColumnScore(s.id, c)
        cells.push(v !== null ? v : '—')
      }
    }
    const fg = getWeightedGrade(s.id)
    cells.push(fg !== null ? `${fg}%` : '—')
    return cells
  })

  return { headers, rows }
}

async function downloadXLSX(params: GradeBookExportParams) {
  const XLSX = await import('xlsx')
  const { headers, rows } = buildRows(params)
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 26 }, ...headers.slice(1).map(() => ({ wch: 14 }))]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Grade Book')
  XLSX.writeFile(wb, `${params.filename ?? 'gradebook'}.xlsx`)
}

function downloadCSV(params: GradeBookExportParams) {
  const { headers, rows } = buildRows(params)
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const content = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${params.filename ?? 'gradebook'}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// ─── ExceptionsPanel ──────────────────────────────────────────────────────────

function ExceptionsPanel({
  col,
  maxAttempts,
  students,
  submissionCounts,
  exceptions,
  onGrant,
  onRevoke,
  onClose,
}: {
  col: GradeColumn
  maxAttempts: number
  students: { id: string; full_name: string }[]
  submissionCounts: Record<string, number>   // studentId → attempts used
  exceptions: QuizException[]
  onGrant: (studentId: string, reason: string) => Promise<void>
  onRevoke: (studentId: string) => Promise<void>
  onClose: () => void
}) {
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

// ─── ColHeader ────────────────────────────────────────────────────────────────

function ColHeader({
  col,
  onDeleteClick,
  onRelease,
  onManageExceptions,
}: {
  col: GradeColumn
  onDeleteClick: (col: GradeColumn) => void
  onRelease: (col: GradeColumn, released: boolean) => void
  onManageExceptions?: (col: GradeColumn) => void
}) {
  return (
    <th style={{ ...thStyle, position: 'relative', minWidth: '80px' }}>
      <div>{col.title}</div>
      <div style={{ fontSize: '10px', color: '#bbb' }}>
        /{col.max_score}
        {col.entry_type === 'quiz_linked' && (
          <span title="Auto-filled from submissions" style={{ marginLeft: '3px', color: '#1D9E75' }}>⟳</span>
        )}
      </div>
      <button
        onClick={() => onRelease(col, !col.is_released)}
        title={col.is_released ? 'Unrelease — hide from students' : 'Release — students can see their score'}
        style={{
          marginTop: '4px',
          fontSize: '9px', padding: '1px 6px', borderRadius: '999px',
          border: 'none', cursor: 'pointer', display: 'inline-block',
          background: col.is_released ? '#E1F5EE' : '#F0F0EE',
          color: col.is_released ? '#0F6E56' : '#aaa',
          fontWeight: 600,
        }}
      >
        {col.is_released ? '● Released' : '○ Release'}
      </button>
      {col.entry_type === 'quiz_linked' && onManageExceptions && (
        <button
          onClick={() => onManageExceptions(col)}
          title="Manage per-student exceptions"
          style={{
            marginTop: '3px', marginLeft: '4px',
            fontSize: '9px', padding: '1px 6px', borderRadius: '999px',
            border: 'none', cursor: 'pointer', display: 'inline-block',
            background: '#F0F0EE', color: '#888', fontWeight: 600,
          }}
        >
          Exceptions
        </button>
      )}
      <button
        onClick={() => onDeleteClick(col)}
        style={{
          position: 'absolute', top: '3px', right: '3px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '10px', color: '#ddd', padding: 0, lineHeight: 1,
        }}
        title="Remove column"
      >✕</button>
    </th>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FacultyGradeBook() {
  const { profile } = useAuth()
  const { quizzes, submissions, fetchAllSubmissions, fetchExceptionsForQuiz, grantException, revokeException } = useQuizzes(profile?.id)
  const { students } = useStudents()
  const { courses } = useCourses(null, profile?.id)
  const { enrollments } = useAllEnrollments()

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'last_asc' | 'last_desc' | 'first_asc' | 'first_desc'>('last_asc')
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showManageGroups, setShowManageGroups] = useState(false)
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<GradeColumn | null>(null)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<GradeGroup | null>(null)
  const [pageError, setPageError] = useState('')
  const [exceptionsCol, setExceptionsCol] = useState<GradeColumn | null>(null)
  const [colExceptions, setColExceptions] = useState<QuizException[]>([])

  const { groups, columns, entries, error: gradeBookError, addGroup, updateGroup, deleteGroup, addColumn, updateColumnMaxScore, releaseColumn, deleteColumn, upsertEntry, batchUpsertEntries, findOrCreateLinkedColumn } = useGradeBook(selectedCourseId)

  useEffect(() => {
    fetchAllSubmissions()
    const channel = supabase
      .channel('gradebook-quiz-submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_submissions' }, fetchAllSubmissions)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Reload exceptions whenever the active column changes
  useEffect(() => {
    if (!exceptionsCol?.linked_quiz_id) { setColExceptions([]); return }
    fetchExceptionsForQuiz(exceptionsCol.linked_quiz_id).then(setColExceptions)
  }, [exceptionsCol?.id])

  // Sync quiz_submissions → grade_entries so the gradebook has one source of truth
  useEffect(() => {
    if (!profile || !quizzes.length || !submissions.length) return

    const entryMap = new Map(entries.map(e => [`${e.student_id}:${e.column_id}`, e]))

    async function syncQuizScores() {
      const toUpsert: { column_id: string; student_id: string; score: number | null }[] = []
      for (const quiz of quizzes) {
        // Resolve grade group: use explicit assignment, or fall back to name-match by item type
        let resolvedGroupId = quiz.grade_group_id ?? null
        if (!resolvedGroupId) {
          const targetName = TYPE_CONFIG[quiz.item_type as keyof typeof TYPE_CONFIG]?.groupName
          const match = targetName
            ? groups.find(g => g.name.toLowerCase() === targetName.toLowerCase())
            : null
          resolvedGroupId = match?.id ?? null
        }
        if (!resolvedGroupId) continue
        const quizTotal = (quiz.questions ?? []).reduce((s: number, q: { points?: number }) => s + (q.points ?? 1), 0)
        if (quizTotal === 0) continue
        const hasEssay = (quiz.questions ?? []).some((q: { type?: string }) => q.type === 'essay')
        const quizSubs = submissions.filter(s => s.quiz_id === quiz.id)
        if (quizSubs.length === 0) continue
        try {
          const col = await findOrCreateLinkedColumn(quiz.id, quiz.title, resolvedGroupId, quizTotal, profile!.id, quiz.course_id)
          if (col.max_score !== quizTotal) await updateColumnMaxScore(col.id, quizTotal)
          for (const sub of quizSubs) {
            if (hasEssay && !sub.essay_scores) continue
            const earned = extractEarned(sub.earned_points, sub.score, quizTotal)
            const existing = entryMap.get(`${sub.student_id}:${col.id}`)
            if (existing?.manually_overridden) continue  // never clobber a manual override
            if (existing !== undefined && existing.score === earned) continue
            toUpsert.push({ column_id: col.id, student_id: sub.student_id, score: earned })
          }
        } catch (err) {
          console.error('[GradeBook] quiz sync failed:', err)
        }
      }
      if (toUpsert.length > 0) {
        try {
          await batchUpsertEntries(toUpsert)
        } catch (err) {
          console.error('[GradeBook] batch upsert failed:', err)
        }
      }
    }
    syncQuizScores()
  }, [profile?.id, submissions.length, groups.length])

  // All hooks must be before any early return
  const entryMap = useMemo(
    () => new Map(entries.map(e => [`${e.student_id}:${e.column_id}`, e])),
    [entries]
  )

  const enrolled = useMemo(() => {
    const courseStudentIds = selectedCourseId
      ? new Set(enrollments.filter(e => e.course_id === selectedCourseId).map(e => e.student_id))
      : null
    let list = students.filter(s =>
      s.status === 'approved' && (!courseStudentIds || courseStudentIds.has(s.id))
    )
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(s => s.full_name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      const last = (n: string) => n.trim().split(' ').slice(-1)[0] ?? n
      const first = (n: string) => n.trim().split(' ')[0] ?? n
      const [ka, kb] = sortBy.startsWith('last') ? [last(a.full_name), last(b.full_name)] : [first(a.full_name), first(b.full_name)]
      return sortBy.endsWith('desc') ? kb.localeCompare(ka) : ka.localeCompare(kb)
    })
  }, [students, enrollments, selectedCourseId, searchQuery, sortBy])

  // Only show groups that have at least one column (after course filtering)
  const visibleGroups = useMemo(
    () => groups.filter(g => columns.some(c => c.group_id === g.id)),
    [groups, columns]
  )

  if (!profile) return null

  const selectedCourse = courses.find(c => c.id === selectedCourseId) ?? null

  function getColumnScore(studentId: string, col: GradeColumn): number | null {
    const entry = entryMap.get(`${studentId}:${col.id}`)
    return entry !== undefined && entry.score !== null ? entry.score : null
  }

  function getWeightedGrade(studentId: string): number | null {
    return computeWeightedGrade(studentId, visibleGroups, columns, getColumnScore)
  }

  const totalWeight = visibleGroups.reduce((s, g) => s + g.weight_percent, 0)

  async function handleReleaseColumn(col: GradeColumn, released: boolean) {
    try {
      setPageError('')
      await releaseColumn(col.id, released)
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : String(err) || 'Failed to update release status')
    }
  }

  const exportFilename = selectedCourse
    ? `gradebook-${selectedCourse.name.toLowerCase().replace(/\s+/g, '-')}`
    : 'gradebook'

  const exportParams: GradeBookExportParams = {
    students: enrolled, groups: visibleGroups, columns,
    getColumnScore, getWeightedGrade,
    filename: exportFilename,
  }

  return (
    <div>
      {confirmDeleteCol && (
        <ConfirmDialog
          title="Remove column"
          message={`Remove "${confirmDeleteCol.title}"? All scores in this column will be deleted.`}
          confirmLabel="Remove"
          onConfirm={async () => {
            try { await deleteColumn(confirmDeleteCol.id); setConfirmDeleteCol(null) }
            catch (err: unknown) { setPageError(err instanceof Error ? err.message : String(err) || 'Failed to delete column') }
          }}
          onCancel={() => setConfirmDeleteCol(null)}
        />
      )}
      {confirmDeleteGroup && (
        <ConfirmDialog
          title="Delete group"
          message={`Delete "${confirmDeleteGroup.name}"? All columns and scores in this group will also be deleted.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            try { await deleteGroup(confirmDeleteGroup.id); setConfirmDeleteGroup(null) }
            catch (err: unknown) { setPageError(err instanceof Error ? err.message : String(err) || 'Failed to delete group') }
          }}
          onCancel={() => setConfirmDeleteGroup(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <PageHeader
            title={selectedCourse ? `Grade Book — ${selectedCourse.name}${selectedCourse.section ? ` · ${selectedCourse.section}` : ''}` : 'Grade Book'}
            subtitle={`${enrolled.length} student${enrolled.length !== 1 ? 's' : ''} · Weighted final grade · Total weight: ${totalWeight}%${totalWeight !== 100 ? ' ⚠ should be 100%' : ''}`}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
          <Button onClick={() => downloadCSV(exportParams)} style={{ fontSize: '12px' }}>
            Download CSV
          </Button>
          <Button variant="primary" onClick={() => { void downloadXLSX(exportParams) }} style={{ fontSize: '12px' }}>
            Download .xlsx
          </Button>
        </div>
      </div>

      {(pageError || gradeBookError) && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#A32D2D', background: '#FFF5F5', border: '0.5px solid rgba(163,45,45,0.25)', borderRadius: '8px', padding: '8px 10px' }}>
          {pageError || gradeBookError}
        </div>
      )}

      {/* Course selector + search + sort */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {courses.length > 0 && (
          <select
            value={selectedCourseId ?? ''}
            onChange={e => setSelectedCourseId(e.target.value || null)}
            style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            <option value="">All students</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="Search by name…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', outline: 'none', fontFamily: 'Inter, sans-serif', minWidth: '160px' }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <option value="last_asc">Last Name A–Z</option>
          <option value="last_desc">Last Name Z–A</option>
          <option value="first_asc">First Name A–Z</option>
          <option value="first_desc">First Name Z–A</option>
        </select>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {!showAddColumn && (
          <Button
            onClick={() => { setShowAddColumn(true); setShowManageGroups(false) }}
            style={{ fontSize: '12px' }}
            disabled={!selectedCourseId}
            title={!selectedCourseId ? 'Select a course first' : undefined}
          >
            + Add Column
          </Button>
        )}
        <Button
          onClick={() => { setShowManageGroups(v => !v); setShowAddColumn(false) }}
          style={{ fontSize: '12px', background: showManageGroups ? '#1D9E75' : undefined, color: showManageGroups ? '#fff' : undefined }}
          disabled={!selectedCourseId}
          title={!selectedCourseId ? 'Select a course first' : undefined}
        >
          Manage Groups
        </Button>
        {!selectedCourseId && (
          <span style={{ fontSize: '11px', color: '#aaa' }}>Select a course to add columns and groups</span>
        )}
      </div>

      {exceptionsCol && exceptionsCol.linked_quiz_id && (
        <ExceptionsPanel
          col={exceptionsCol}
          maxAttempts={quizzes.find(q => q.id === exceptionsCol.linked_quiz_id)?.max_attempts ?? 1}
          students={enrolled}
          submissionCounts={Object.fromEntries(
            enrolled.map(s => [
              s.id,
              submissions.filter(sub => sub.quiz_id === exceptionsCol.linked_quiz_id && sub.student_id === s.id).length,
            ])
          )}
          exceptions={colExceptions}
          onGrant={async (studentId, reason) => {
            if (!profile || !exceptionsCol.linked_quiz_id) return
            await grantException(exceptionsCol.linked_quiz_id, studentId, 1, profile.id, reason)
            setColExceptions(await fetchExceptionsForQuiz(exceptionsCol.linked_quiz_id))
          }}
          onRevoke={async studentId => {
            if (!exceptionsCol.linked_quiz_id) return
            await revokeException(exceptionsCol.linked_quiz_id, studentId)
            setColExceptions(await fetchExceptionsForQuiz(exceptionsCol.linked_quiz_id))
          }}
          onClose={() => setExceptionsCol(null)}
        />
      )}

      {showManageGroups && (
        <ManageGroupsPanel
          groups={groups}
          onAdd={async (name, weight) => {
            setPageError('')
            await addGroup(name, weight, profile.id)
          }}
          onUpdate={async (id, name, weight) => {
            setPageError('')
            await updateGroup(id, name, weight)
          }}
          onDelete={g => setConfirmDeleteGroup(g)}
          onClose={() => setShowManageGroups(false)}
        />
      )}

      {showAddColumn && (
        <AddColumnForm
          groups={groups}
          onAdd={async (title, groupId, maxScore) => {
            setPageError('')
            await addColumn(title, groupId, maxScore, profile.id)
            setShowAddColumn(false)
          }}
          onCancel={() => setShowAddColumn(false)}
        />
      )}

      {/* Table */}
      {enrolled.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#888' }}>No enrolled students yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', fontSize: '13px',
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px', overflow: 'hidden',
          }}>
            <thead>
              {/* Group header row */}
              <tr style={{ background: '#FAFAF8' }}>
                <th colSpan={2} style={{ ...thStyle, textAlign: 'left' }} />
                {visibleGroups.map(g => {
                  const cols = columns.filter(c => c.group_id === g.id)
                  if (cols.length === 0) return null
                  return (
                    <th key={g.id} colSpan={cols.length} style={{ ...thStyle, background: '#EAF3FF', color: '#1a5fa8' }}>
                      {g.name} ({g.weight_percent}%)
                    </th>
                  )
                })}
                <th style={{ ...thStyle, background: '#E1F5EE', color: '#0F6E56' }}>Final Grade</th>
              </tr>

              {/* Column header row */}
              <tr style={{ background: '#F5F5F3' }}>
                <th style={{ ...thStyle, textAlign: 'left', width: '32px' }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: '120px' }}>Student Name</th>
                {visibleGroups.flatMap(g =>
                  columns.filter(c => c.group_id === g.id).map(c => (
                    <ColHeader
                      key={c.id} col={c}
                      onDeleteClick={setConfirmDeleteCol}
                      onRelease={handleReleaseColumn}
                      onManageExceptions={setExceptionsCol}
                    />
                  ))
                )}
                <th style={{ ...thStyle, color: '#0F6E56', fontWeight: 600, minWidth: '80px' }}>Grade</th>
              </tr>
            </thead>

            <tbody>
              {enrolled.map((student, si) => {
                const finalGrade = getWeightedGrade(student.id)
                return (
                  <tr key={student.id} style={{ borderTop: si > 0 ? '0.5px solid rgba(0,0,0,0.07)' : undefined }}>
                    <td style={{ ...tdStyle, color: '#aaa', fontSize: '12px' }}>{si + 1}</td>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500, paddingLeft: '14px' }}>
                      {student.full_name}
                    </td>

                    {visibleGroups.flatMap(g =>
                      columns.filter(c => c.group_id === g.id).map(c => (
                        <td key={c.id} style={tdStyle}>
                          <ScoreCell
                            value={getColumnScore(student.id, c)}
                            maxScore={c.max_score}
                            readOnly={c.entry_type === 'quiz_linked'}
                            onSave={c.entry_type === 'manual' ? async v => {
                              try { setPageError(''); await upsertEntry(c.id, student.id, v) }
                              catch (err: unknown) { setPageError(err instanceof Error ? err.message : String(err) || 'Failed to save score') }
                            } : undefined}
                          />
                        </td>
                      ))
                    )}

                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {finalGrade !== null
                        ? <span style={{ color: gradeColor(finalGrade) }}>{finalGrade}%</span>
                        : <span style={{ color: '#ccc' }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
