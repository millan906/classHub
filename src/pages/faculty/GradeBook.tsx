import React, { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useStudents } from '../../hooks/useStudents'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useCourses } from '../../hooks/useCourses'
import { useAllEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { inputStyle } from '../../styles/shared'
import { computeWeightedGrade } from '../../utils/gradeCalculations'
import type { GradeGroup, GradeColumn } from '../../hooks/useGradeBook'

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
    await onAdd(newName.trim(), parseFloat(newWeight) || 0)
    setSaving(false)
    setAddingNew(false)
    setNewName('')
    setNewWeight('')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Group name" style={{ ...inputStyle, flex: 2 }} />
          <input value={newWeight} onChange={e => setNewWeight(e.target.value)}
            placeholder="Weight" style={{ ...inputStyle, width: '60px' }} type="number" min="0" max="100" />
          <span style={{ fontSize: '11px', color: '#888' }}>%</span>
          <Button variant="primary" onClick={saveNew} disabled={saving || !newName.trim()} style={{ fontSize: '11px' }}>
            Add
          </Button>
          <Button onClick={() => setAddingNew(false)} style={{ fontSize: '11px' }}>Cancel</Button>
        </div>
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
  quizzes: { id: string; title: string }[]
  groups: GradeGroup[]
  manualCols: GradeColumn[]
  getQuizScore: (sid: string, qid: string) => number | null
  getGradeScore: (sid: string, cid: string) => number | null
  getWeightedGrade: (sid: string) => number | null
  filename?: string
}

function buildRows({ students, quizzes, groups, manualCols, getQuizScore, getGradeScore, getWeightedGrade }: GradeBookExportParams) {
  const headers = [
    'Student Name',
    ...quizzes.map(q => q.title),
    ...groups.filter(g => g.name !== 'Quizzes').flatMap(g =>
      manualCols.filter(c => c.group_id === g.id).map(c => c.title)
    ),
    'Final Grade',
  ]

  const rows = students.map(s => {
    const cells: (string | number)[] = [s.full_name]
    for (const q of quizzes) {
      const v = getQuizScore(s.id, q.id)
      cells.push(v !== null ? `${v}%` : '—')
    }
    for (const g of groups.filter(g => g.name !== 'Quizzes')) {
      for (const c of manualCols.filter(c => c.group_id === g.id)) {
        const v = getGradeScore(s.id, c.id)
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FacultyGradeBook() {
  const { profile } = useAuth()
  const { quizzes, submissions, fetchAllSubmissions } = useQuizzes()
  const { students } = useStudents()
  const { groups, columns, entries, addGroup, updateGroup, deleteGroup, addColumn, deleteColumn, upsertEntry } = useGradeBook()
  const { courses } = useCourses()
  const { enrollments } = useAllEnrollments()

  const [showAddColumn, setShowAddColumn] = useState(false)
  const [showManageGroups, setShowManageGroups] = useState(false)
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<GradeColumn | null>(null)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<GradeGroup | null>(null)
  const [pageError, setPageError] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  useEffect(() => { fetchAllSubmissions() }, [])

  if (!profile) return null

  const selectedCourse = courses.find(c => c.id === selectedCourseId) ?? null

  // When a course is selected, limit students to those enrolled in it
  const courseStudentIds = selectedCourseId
    ? new Set(enrollments.filter(e => e.course_id === selectedCourseId).map(e => e.student_id))
    : null
  const enrolled = students.filter(s =>
    s.status === 'approved' && (!courseStudentIds || courseStudentIds.has(s.id))
  )

  // Quizzes group (auto) vs manual groups — filter quizzes by selected course
  const regularQuizzes = quizzes.filter(q =>
    (!q.item_type || q.item_type === 'quiz') &&
    (!selectedCourseId || q.course_id === selectedCourseId)
  )
  const quizzesGroup = groups.find(g => g.name === 'Quizzes')
  const manualGroups = groups.filter(g => g.name !== 'Quizzes')
  const manualCols = columns

  // Precomputed lookup maps — O(n) build, O(1) per lookup instead of O(n) per cell
  const entryMap = new Map(entries.map(e => [`${e.student_id}:${e.column_id}`, e]))
  const submissionsByKey = submissions.reduce<Map<string, typeof submissions>>((acc, s) => {
    const key = `${s.student_id}:${s.quiz_id}`
    const list = acc.get(key) ?? []
    list.push(s)
    acc.set(key, list)
    return acc
  }, new Map())

  function getBestSub(studentId: string, quizId: string) {
    const subs = submissionsByKey.get(`${studentId}:${quizId}`) ?? []
    if (subs.length === 0) return null
    return subs.reduce((b, s) => s.score > b.score ? s : b)
  }

  function getQuizScore(studentId: string, quizId: string): number | null {
    return getBestSub(studentId, quizId)?.score ?? null
  }

  function getQuizRaw(studentId: string, quizId: string): { earned: number; total: number } | null {
    const best = getBestSub(studentId, quizId)
    if (!best) return null
    const total = best.total_points ?? 100
    const earned = best.earned_points ?? Math.round((best.score / 100) * total)
    return { earned, total }
  }

  function getGradeScore(studentId: string, columnId: string): number | null {
    return entryMap.get(`${studentId}:${columnId}`)?.score ?? null
  }

  function getColumnScore(studentId: string, col: GradeColumn): number | null {
    // Quiz-linked columns always compute from live submission data so stale grade_entries never override
    if (col.entry_type === 'quiz_linked' && col.linked_quiz_id) {
      const best = getBestSub(studentId, col.linked_quiz_id)
      if (!best) return null
      if (best.earned_points != null && best.total_points != null && best.total_points > 0) {
        return Math.round((best.earned_points / best.total_points) * col.max_score)
      }
      return Math.round((best.score / 100) * col.max_score)
    }

    const entry = entryMap.get(`${studentId}:${col.id}`)
    if (entry !== undefined && entry.score !== null) return entry.score

    return null
  }

  function getWeightedGrade(studentId: string): number | null {
    return computeWeightedGrade(studentId, quizzesGroup, regularQuizzes, manualGroups, manualCols, getQuizRaw, getColumnScore)
  }

  // Column header for manual grade_columns
  function ColHeader({ col }: { col: GradeColumn }) {
    return (
      <th style={{ ...thStyle, position: 'relative', minWidth: '70px' }}>
        <div>{col.title}</div>
        <div style={{ fontSize: '10px', color: '#bbb' }}>
          /{col.max_score}
          {col.entry_type === 'quiz_linked' && (
            <span title="Auto-filled from quiz submissions" style={{ marginLeft: '3px', color: '#1D9E75' }}>⟳</span>
          )}
        </div>
        <button
          onClick={() => setConfirmDeleteCol(col)}
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

  const totalWeight = groups.reduce((s, g) => s + g.weight_percent, 0)

  const exportFilename = selectedCourse
    ? `gradebook-${selectedCourse.name.toLowerCase().replace(/\s+/g, '-')}`
    : 'gradebook'

  const exportParams: GradeBookExportParams = {
    students: enrolled, quizzes: regularQuizzes, groups, manualCols,
    getQuizScore, getGradeScore, getWeightedGrade,
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

      {pageError && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: '#A32D2D', background: '#FFF5F5', border: '0.5px solid rgba(163,45,45,0.25)', borderRadius: '8px', padding: '8px 10px' }}>
          {pageError}
        </div>
      )}

      {/* Course selector */}
      {courses.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <button
            onClick={() => setSelectedCourseId(null)}
            style={{
              padding: '5px 14px', fontSize: '12px', borderRadius: '999px', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              border: selectedCourseId === null ? 'none' : '0.5px solid rgba(0,0,0,0.2)',
              background: selectedCourseId === null ? '#1D9E75' : 'transparent',
              color: selectedCourseId === null ? '#fff' : '#555',
              fontWeight: selectedCourseId === null ? 600 : 400,
            }}
          >
            All students
          </button>
          {courses.map(c => {
            const active = selectedCourseId === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                style={{
                  padding: '5px 14px', fontSize: '12px', borderRadius: '999px', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                  border: active ? 'none' : '0.5px solid rgba(0,0,0,0.2)',
                  background: active ? '#1D9E75' : 'transparent',
                  color: active ? '#fff' : '#555',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {c.name}{c.section ? ` · ${c.section}` : ''}
              </button>
            )
          })}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {!showAddColumn && (
          <Button onClick={() => { setShowAddColumn(true); setShowManageGroups(false) }} style={{ fontSize: '12px' }}>
            + Add Column
          </Button>
        )}
        <Button
          onClick={() => { setShowManageGroups(v => !v); setShowAddColumn(false) }}
          style={{ fontSize: '12px', background: showManageGroups ? '#1D9E75' : undefined, color: showManageGroups ? '#fff' : undefined }}
        >
          Manage Groups
        </Button>
      </div>

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
                {regularQuizzes.length > 0 && (
                  <th colSpan={regularQuizzes.length} style={{ ...thStyle, background: '#FAEEDA', color: '#7A4F00' }}>
                    Quizzes {quizzesGroup ? `(${quizzesGroup.weight_percent}%)` : ''}
                  </th>
                )}
                {manualGroups.map(g => {
                  const cols = manualCols.filter(c => c.group_id === g.id)
                  if (cols.length === 0) return null
                  return (
                    <th key={g.id} colSpan={cols.length} style={{
                      ...thStyle,
                      background: '#EAF3FF', color: '#1a5fa8',
                    }}>
                      {g.name} ({g.weight_percent}%)
                    </th>
                  )
                })}
                <th style={{ ...thStyle, background: '#E1F5EE', color: '#0F6E56' }}>
                  Final Grade
                </th>
              </tr>

              {/* Column header row */}
              <tr style={{ background: '#F5F5F3' }}>
                <th style={{ ...thStyle, textAlign: 'left', width: '32px' }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: '160px' }}>Student Name</th>
                {regularQuizzes.map(q => (
                  <th key={q.id} style={{ ...thStyle, minWidth: '80px' }}>{q.title}</th>
                ))}
                {manualGroups.flatMap(g =>
                  manualCols.filter(c => c.group_id === g.id).map(c => (
                    <ColHeader key={c.id} col={c} />
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

                    {regularQuizzes.map(q => (
                      <td key={q.id} style={tdStyle}>
                        <ScoreCell value={getQuizScore(student.id, q.id)} maxScore={100} readOnly />
                      </td>
                    ))}

                    {manualGroups.flatMap(g =>
                      manualCols.filter(c => c.group_id === g.id).map(c => (
                        <td key={c.id} style={tdStyle}>
                          <ScoreCell
                            value={getColumnScore(student.id, c)}
                            maxScore={c.max_score}
                            onSave={async v => {
                              try { setPageError(''); await upsertEntry(c.id, student.id, v) }
                              catch (err: unknown) { setPageError(err instanceof Error ? err.message : String(err) || 'Failed to save score') }
                            }}
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
