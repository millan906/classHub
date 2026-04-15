import React, { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import { printSyllabus } from '../../utils/syllabuspPrint'
import type { Course, GradingPeriod, CourseScheduleItem, CourseResource, SyllabusRow, SyllabusCell } from '../../types'

const inputStyle: React.CSSProperties = {
  padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none', color: '#1a1a1a',
}
const sectionHead: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#888',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', marginTop: '18px',
}

const RESOURCE_CATEGORIES: { value: CourseResource['category']; label: string }[] = [
  { value: 'book', label: '📚 Book' },
  { value: 'journal', label: '📰 Journal' },
  { value: 'lab', label: '🧪 Lab' },
  { value: 'other', label: '📎 Other' },
]
const SCHEDULE_TYPES: { value: CourseScheduleItem['type']; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'lab', label: 'Lab' },
  { value: 'other', label: 'Other' },
]

function uid() { return crypto.randomUUID() }
function emptyCell(): SyllabusCell { return { text: '', link: '', file_path: '', file_name: '' } }
function emptyRow(): SyllabusRow {
  return { id: uid(), week: '', lesson: '', readings: emptyCell(), assignments: emptyCell(), laboratory: emptyCell() }
}

// ─── SyllabusCellEditor ───────────────────────────────────────────────────────

function SyllabusCellEditor({ col, label, row, fileRef, isUploading, onUpdate, onUpload }: {
  col: 'readings' | 'assignments' | 'laboratory'
  label: string
  row: SyllabusRow
  fileRef: (el: HTMLInputElement | null) => void
  isUploading: boolean
  onUpdate: (id: string, updated: SyllabusRow) => void
  onUpload: (rowId: string, col: 'readings' | 'assignments' | 'laboratory', file: File) => Promise<void>
}) {
  const c = row[col]
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function updateCell(field: keyof SyllabusCell, value: string) {
    onUpdate(row.id, { ...row, [col]: { ...row[col], [field]: value } })
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <textarea
        value={c.text}
        onChange={e => updateCell('text', e.target.value)}
        placeholder={`${label} description...`}
        rows={2}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: '12px', marginBottom: '4px' }}
      />
      {c.file_path ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#1D9E75' }}>📎 {c.file_name}</span>
          <button onClick={() => { updateCell('file_path', ''); updateCell('file_name', '') }}
            style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input value={c.link ?? ''} onChange={e => updateCell('link', e.target.value)}
            placeholder="Paste a link..." style={{ ...inputStyle, flex: 1, fontSize: '12px' }} />
          <span style={{ fontSize: '11px', color: '#bbb' }}>or</span>
          <input type="file" ref={el => { fileInputRef.current = el; fileRef(el) }} style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(row.id, col, f) }} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{ fontSize: '11px', padding: '4px 10px' }}>
            {isUploading ? 'Uploading…' : '📎 File'}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── SyllabusRowEditor ────────────────────────────────────────────────────────

function SyllabusRowEditor({ row, index, onUpdate, onRemove, onUpload, uploadingCells }: {
  row: SyllabusRow
  index: number
  onUpdate: (id: string, updated: SyllabusRow) => void
  onRemove: (id: string) => void
  onUpload: (rowId: string, col: 'readings' | 'assignments' | 'laboratory', file: File) => Promise<void>
  uploadingCells: Set<string>
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <div style={{ background: '#F9F9F7', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#1D9E75', minWidth: '20px' }}>#{index + 1}</div>
        <input value={row.week} onChange={e => onUpdate(row.id, { ...row, week: e.target.value })}
          placeholder="Week / Unit (e.g. Week 1)" style={{ ...inputStyle, width: '130px', fontSize: '12px' }} />
        <input value={row.lesson} onChange={e => onUpdate(row.id, { ...row, lesson: e.target.value })}
          placeholder="Lesson / Topic title" style={{ ...inputStyle, flex: 1, fontSize: '12px' }} />
        <button onClick={() => onRemove(row.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '18px', lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}>×</button>
      </div>
      {(['readings', 'assignments', 'laboratory'] as const).map(col => (
        <SyllabusCellEditor
          key={col}
          col={col}
          label={col.charAt(0).toUpperCase() + col.slice(1)}
          row={row}
          fileRef={el => { fileRefs.current[col] = el }}
          isUploading={uploadingCells.has(`${row.id}:${col}`)}
          onUpdate={onUpdate}
          onUpload={onUpload}
        />
      ))}
    </div>
  )
}

// ─── CourseForm ───────────────────────────────────────────────────────────────

function CourseForm({ courseId, initial, onSave, onCancel, uploadResource, deleteResource }: {
  courseId: string
  initial?: {
    name: string; section: string; gradingSystem: GradingPeriod[]
    schedule: CourseScheduleItem[]; resources: CourseResource[]; syllabus: SyllabusRow[]
  }
  onSave: (name: string, section: string, gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[], resources: CourseResource[], syllabus: SyllabusRow[]) => Promise<void>
  onCancel: () => void
  uploadResource: (courseId: string, file: File) => Promise<{ file_path: string; file_name: string }>
  deleteResource: (path: string) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [section, setSection] = useState(initial?.section ?? '')
  const [syllabus, setSyllabus] = useState<SyllabusRow[]>(initial?.syllabus ?? [])
  const [gradingSystem, setGradingSystem] = useState<GradingPeriod[]>(
    initial?.gradingSystem?.length
      ? initial.gradingSystem
      : [{ label: 'Prelim', weight: 30 }, { label: 'Midterm', weight: 30 }, { label: 'Finals', weight: 40 }]
  )
  const [schedule, setSchedule] = useState<CourseScheduleItem[]>(initial?.schedule ?? [])
  const [resources, setResources] = useState<CourseResource[]>(initial?.resources ?? [])
  const [uploadingCells, setUploadingCells] = useState<Set<string>>(new Set())
  const [uploadingResources, setUploadingResources] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const totalWeight = gradingSystem.reduce((s, p) => s + (p.weight || 0), 0)

  // Syllabus
  function updateRow(id: string, updated: SyllabusRow) {
    setSyllabus(prev => prev.map(r => r.id === id ? updated : r))
  }
  async function uploadCellFile(rowId: string, col: 'readings' | 'assignments' | 'laboratory', file: File) {
    const key = `${rowId}:${col}`
    setUploadingCells(prev => new Set(prev).add(key))
    try {
      const { file_path, file_name } = await uploadResource(courseId, file)
      setSyllabus(prev => prev.map(r => r.id === rowId
        ? { ...r, [col]: { ...r[col], file_path, file_name, link: '' } }
        : r
      ))
    } catch { setError('File upload failed. Try again.') }
    finally { setUploadingCells(prev => { const n = new Set(prev); n.delete(key); return n }) }
  }

  // Schedule
  function addScheduleItem() {
    setSchedule(prev => [...prev, { id: uid(), type: 'lecture', day: '', time: '', room: '' }])
  }
  function updateSchedule(i: number, field: keyof CourseScheduleItem, value: string) {
    setSchedule(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  // Resources
  function addResource() {
    setResources(prev => [...prev, { id: uid(), title: '', category: 'book', link: '', file_path: '', file_name: '' }])
  }
  function updateResource(id: string, field: keyof CourseResource, value: string) {
    setResources(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  async function handleResourceFile(resourceId: string, file: File) {
    setUploadingResources(prev => new Set(prev).add(resourceId))
    try {
      const { file_path, file_name } = await uploadResource(courseId, file)
      setResources(prev => prev.map(r => r.id === resourceId ? { ...r, file_path, file_name, link: '' } : r))
    } catch { setError('File upload failed. Try again.') }
    finally { setUploadingResources(prev => { const n = new Set(prev); n.delete(resourceId); return n }) }
  }
  async function removeResource(r: CourseResource) {
    if (r.file_path) await deleteResource(r.file_path)
    setResources(prev => prev.filter(res => res.id !== r.id))
  }

  // Grading
  function updatePeriod(i: number, field: 'label' | 'weight', value: string) {
    setGradingSystem(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: field === 'weight' ? Number(value) : value } : p))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Course name is required'); return }
    if (gradingSystem.length > 0 && totalWeight !== 100) {
      setError(`Grading weights must sum to 100% (currently ${totalWeight}%)`); return
    }
    setSaving(true); setError('')
    try {
      await onSave(name, section, gradingSystem, schedule, resources, syllabus)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '12px', padding: '16px 18px', marginBottom: '12px' }}>

      {/* Basic Info */}
      <div style={sectionHead}>Basic Info</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '140px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Course name <span style={{ color: '#A32D2D' }}>*</span></div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. INFOT6" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Section</div>
          <input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. BSIT 3A" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Schedule */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' }}>
        <div style={{ ...sectionHead, marginTop: 0, marginBottom: 0 }}>Class Schedule</div>
        <Button onClick={addScheduleItem} style={{ fontSize: '11px', padding: '3px 10px' }}>+ Add</Button>
      </div>
      {schedule.length === 0 && <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '4px' }}>No schedule added yet.</div>}
      {schedule.map((item, i) => (
        <div key={item.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
          <select value={item.type} onChange={e => updateSchedule(i, 'type', e.target.value)} style={{ ...inputStyle, fontSize: '12px', flexShrink: 0 }}>
            {SCHEDULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input value={item.day} onChange={e => updateSchedule(i, 'day', e.target.value)} placeholder="Day (e.g. Mon & Wed)" style={{ ...inputStyle, flex: 2, minWidth: '100px', fontSize: '12px' }} />
          <input value={item.time} onChange={e => updateSchedule(i, 'time', e.target.value)} placeholder="Time (e.g. 8:00–10:00 AM)" style={{ ...inputStyle, flex: 2, minWidth: '100px', fontSize: '12px' }} />
          <input value={item.room ?? ''} onChange={e => updateSchedule(i, 'room', e.target.value)} placeholder="Room (optional)" style={{ ...inputStyle, flex: 1, minWidth: '80px', fontSize: '12px' }} />
          <button onClick={() => setSchedule(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '18px', padding: '2px 4px', lineHeight: 1 }}>×</button>
        </div>
      ))}

      {/* Syllabus table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' }}>
        <div style={{ ...sectionHead, marginTop: 0, marginBottom: 0 }}>Syllabus</div>
        <Button onClick={() => setSyllabus(prev => [...prev, emptyRow()])} style={{ fontSize: '11px', padding: '3px 10px' }}>+ Add Row</Button>
      </div>
      {syllabus.length === 0 && (
        <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '4px' }}>
          No syllabus rows yet. Add rows for each week or topic.
        </div>
      )}
      {syllabus.map((row, i) => (
        <SyllabusRowEditor
          key={row.id}
          row={row}
          index={i}
          onUpdate={updateRow}
          onRemove={id => setSyllabus(prev => prev.filter(r => r.id !== id))}
          onUpload={uploadCellFile}
          uploadingCells={uploadingCells}
        />
      ))}

      {/* Resources */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' }}>
        <div style={{ ...sectionHead, marginTop: 0, marginBottom: 0 }}>Additional Resources</div>
        <Button onClick={addResource} style={{ fontSize: '11px', padding: '3px 10px' }}>+ Add</Button>
      </div>
      {resources.length === 0 && <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '4px' }}>Books, journals, reference materials.</div>}
      {resources.map(r => (
        <div key={r.id} style={{ background: '#F9F9F7', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px', padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
            <select value={r.category} onChange={e => updateResource(r.id, 'category', e.target.value as CourseResource['category'])} style={{ ...inputStyle, fontSize: '12px', flexShrink: 0 }}>
              {RESOURCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input value={r.title} onChange={e => updateResource(r.id, 'title', e.target.value)} placeholder="Title / Description" style={{ ...inputStyle, flex: 1, minWidth: '140px', fontSize: '12px' }} />
            <button onClick={() => removeResource(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '18px', padding: '2px 4px', lineHeight: 1 }}>×</button>
          </div>
          {r.file_path ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#1D9E75' }}>📎 {r.file_name}</span>
              <button onClick={() => { updateResource(r.id, 'file_path', ''); updateResource(r.id, 'file_name', '') }} style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={r.link ?? ''} onChange={e => updateResource(r.id, 'link', e.target.value)} placeholder="Paste a link (URL)..." style={{ ...inputStyle, flex: 1, minWidth: '160px', fontSize: '12px' }} />
              <span style={{ fontSize: '12px', color: '#aaa' }}>or</span>
              <input type="file" ref={el => { fileRefs.current[r.id] = el }} style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleResourceFile(r.id, f) }} />
              <Button onClick={() => fileRefs.current[r.id]?.click()} disabled={uploadingResources.has(r.id)} style={{ fontSize: '12px' }}>
                {uploadingResources.has(r.id) ? 'Uploading…' : '📎 Upload file'}
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* Grading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' }}>
        <div style={{ ...sectionHead, marginTop: 0, marginBottom: 0 }}>Grading System</div>
        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: totalWeight === 100 ? '#E1F5EE' : '#FEF3CD', color: totalWeight === 100 ? '#0F6E56' : '#D4900A' }}>
          Total: {totalWeight}%
        </span>
      </div>
      {gradingSystem.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '5px' }}>
          <input value={p.label} onChange={e => updatePeriod(i, 'label', e.target.value)} placeholder="Period name" style={{ ...inputStyle, flex: 2, fontSize: '12px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flex: 1 }}>
            <input type="number" min={0} max={100} value={p.weight} onChange={e => updatePeriod(i, 'weight', e.target.value)} style={{ ...inputStyle, width: '56px', textAlign: 'right', fontSize: '12px' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>%</span>
          </div>
          <button onClick={() => setGradingSystem(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '18px', padding: '2px 4px', lineHeight: 1 }}>×</button>
        </div>
      ))}
      <Button onClick={() => setGradingSystem(prev => [...prev, { label: '', weight: 0 }])} style={{ fontSize: '11px', marginTop: '2px' }}>+ Add period</Button>

      {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '12px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── CourseInfoPanel ──────────────────────────────────────────────────────────

function CourseInfoPanel({ course, getResourceUrl }: { course: Course; getResourceUrl: (p: string) => string }) {
  const schedule = course.schedule ?? []
  const syllabus = course.syllabus ?? []
  const grading = course.grading_system ?? []
  const resources = course.resources ?? []

  const hasContent = syllabus.length > 0 || schedule.length > 0 || grading.length > 0 || resources.length > 0
  if (!hasContent) return (
    <div style={{ fontSize: '12px', color: '#aaa', paddingTop: '10px', borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px' }}>
      No course info added yet. Click Edit to fill in details.
    </div>
  )

  function CellView({ c }: { c: SyllabusCell | undefined }) {
    if (!c) return null
    return (
      <div>
        {c.text && <div style={{ fontSize: '12px', color: '#333', marginBottom: '2px' }}>{c.text}</div>}
        {c.file_path
          ? <a href={getResourceUrl(c.file_path)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#185FA5' }}>📎 {c.file_name}</a>
          : c.link
          ? <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#185FA5' }}>🔗 Link</a>
          : null
        }
      </div>
    )
  }

  return (
    <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px', paddingTop: '12px' }}>
      {schedule.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={sectionHead}>Schedule</div>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '320px' }}>
            <thead>
              <tr>
                {['Type', 'Day', 'Time', 'Room'].map(h => (
                  <th key={h} style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'left', border: '0.5px solid #ddd', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.type.charAt(0).toUpperCase() + s.type.slice(1)}</td>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee' }}>{s.day}</td>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', whiteSpace: 'nowrap' }}>{s.time}</td>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', color: '#888' }}>{s.room ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {syllabus.length > 0 && (
        <div style={{ marginBottom: '12px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={sectionHead}>Syllabus</div>
            <Button onClick={() => printSyllabus(course, getResourceUrl)} style={{ fontSize: '11px', padding: '3px 10px' }}>
              🖨 Print / Download
            </Button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['Week', 'Lesson', 'Readings', 'Assignments', 'Laboratory'].map(h => (
                  <th key={h} style={{ background: '#F1EFE8', padding: '6px 10px', textAlign: 'left', fontWeight: 600, border: '0.5px solid #ddd', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syllabus.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                  <td style={{ padding: '8px 10px', border: '0.5px solid #eee', color: '#555', whiteSpace: 'nowrap' }}>{row.week}</td>
                  <td style={{ padding: '8px 10px', border: '0.5px solid #eee', fontWeight: 500 }}>{row.lesson}</td>
                  <td style={{ padding: '8px 10px', border: '0.5px solid #eee' }}><CellView c={row.readings} /></td>
                  <td style={{ padding: '8px 10px', border: '0.5px solid #eee' }}><CellView c={row.assignments} /></td>
                  <td style={{ padding: '8px 10px', border: '0.5px solid #eee' }}><CellView c={row.laboratory} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grading.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <div style={sectionHead}>Grading System</div>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '200px' }}>
            <thead>
              <tr>
                <th style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'left', border: '0.5px solid #ddd' }}>Component</th>
                <th style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'left', border: '0.5px solid #ddd' }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {grading.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee' }}>{p.label}</td>
                  <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 600, color: '#1D9E75' }}>{p.weight}%</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 600, background: '#F9F9F7' }}>Total</td>
                <td style={{ padding: '5px 10px', border: '0.5px solid #eee', fontWeight: 700, color: '#1D9E75', background: '#F9F9F7' }}>{grading.reduce((s, p) => s + p.weight, 0)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {resources.length > 0 && (
        <div>
          <div style={sectionHead}>Additional Resources</div>
          {resources.map(r => (
            <div key={r.id} style={{ marginBottom: '4px' }}>
              {r.file_path
                ? <a href={getResourceUrl(r.file_path)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none' }}>📎 {r.title || r.file_name}</a>
                : r.link
                ? <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none' }}>🔗 {r.title || r.link}</a>
                : <span style={{ fontSize: '12px', color: '#555' }}>{r.title}</span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CourseStudentsPanel ──────────────────────────────────────────────────────

function CourseStudentsPanel({ course, facultyId }: { course: Course; facultyId: string }) {
  const { enrollments, enrollStudent, unenrollStudent, refetch } = useCourseEnrollments(course.id)
  const { students } = useStudents()
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')

  const approved = students.filter(s => s.status === 'approved')
  const enrolledIds = new Set(enrollments.map(e => e.student_id))
  const notEnrolled = approved.filter(s => !enrolledIds.has(s.id))
  const enrolledStudents = approved.filter(s => enrolledIds.has(s.id))

  async function handleInvite() {
    if (!selectedStudentId) return
    setInviting(true); setError('')
    try { await enrollStudent(course.id, selectedStudentId, facultyId); setSelectedStudentId('') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to invite') }
    finally { setInviting(false) }
  }

  return (
    <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px', paddingTop: '10px' }}>
      <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>Enrolled students ({enrolledStudents.length})</div>
      {enrolledStudents.length === 0 && <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>No students enrolled yet.</div>}
      {enrolledStudents.map(s => {
        const colors = getAvatarColors(s.full_name)
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#F9F9F7', borderRadius: '8px', marginBottom: '5px' }}>
            <Avatar initials={getInitials(s.full_name)} bg={colors.bg} color={colors.color} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 500 }}>{s.full_name}</div>
              <div style={{ fontSize: '11px', color: '#888' }}>{s.email}</div>
            </div>
            <Button variant="danger" onClick={() => unenrollStudent(course.id, s.id).then(() => refetch(course.id))} style={{ fontSize: '11px', padding: '2px 8px' }}>Remove</Button>
          </div>
        )
      })}
      {notEnrolled.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px' }}>
          <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: '12px' }}>
            <option value="">Invite a student...</option>
            {notEnrolled.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
          </select>
          <Button variant="primary" onClick={handleInvite} disabled={inviting || !selectedStudentId} style={{ fontSize: '12px' }}>
            {inviting ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
      )}
      {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '4px' }}>{error}</div>}
    </div>
  )
}

// ─── CourseRow ────────────────────────────────────────────────────────────────

function CourseRow({ course, facultyId, onEdit, onDelete, onToggle, getResourceUrl }: {
  course: Course; facultyId: string
  onEdit: (c: Course) => void; onDelete: (c: Course) => void
  onToggle: (id: string, s: 'open' | 'closed') => void
  getResourceUrl: (p: string) => string
}) {
  const isOpen = course.status === 'open'
  const [panel, setPanel] = useState<'none' | 'info' | 'students'>('none')
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{course.name}</span>
        {course.section && <span style={{ fontSize: '12px', color: '#888' }}>· Section {course.section}</span>}
        <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: isOpen ? '#E1F5EE' : '#F1EFE8', color: isOpen ? '#0F6E56' : '#888' }}>
          {isOpen ? 'Open' : 'Closed'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Button onClick={() => setPanel(p => p === 'info' ? 'none' : 'info')} style={{ fontSize: '12px', background: panel === 'info' ? '#F1EFE8' : undefined }}>
          {panel === 'info' ? 'Hide info' : 'Course info'}
        </Button>
        <Button onClick={() => setPanel(p => p === 'students' ? 'none' : 'students')} style={{ fontSize: '12px', background: panel === 'students' ? '#F1EFE8' : undefined }}>
          {panel === 'students' ? 'Hide students' : 'Students'}
        </Button>
        <Button onClick={() => onEdit(course)}>Edit</Button>
        <Button onClick={() => onToggle(course.id, isOpen ? 'closed' : 'open')}
          style={isOpen ? { background: '#FEF3CD', color: '#D4900A', borderColor: '#D4900A' } : { background: '#E1F5EE', color: '#0F6E56', borderColor: '#0F6E56' }}>
          {isOpen ? 'Close' : 'Open'}
        </Button>
        <Button variant="danger" onClick={() => onDelete(course)}>Delete</Button>
      </div>
      {panel === 'info' && <CourseInfoPanel course={course} getResourceUrl={getResourceUrl} />}
      {panel === 'students' && <CourseStudentsPanel course={course} facultyId={facultyId} />}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FacultyCourses() {
  const { profile } = useAuth()
  const { courses, createCourse, updateCourse, deleteCourse, toggleCourseStatus, uploadResource, deleteResource, getResourceUrl } = useCourses()
  const [showForm, setShowForm] = useState(false)
  const [newCourseId] = useState(() => crypto.randomUUID())
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null)

  if (!profile) return null

  async function handleCreate(name: string, section: string, gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[], resources: CourseResource[], syllabus: SyllabusRow[]) {
    await createCourse(newCourseId, name, section, profile!.id, [], gradingSystem, schedule, resources, syllabus)
    setShowForm(false)
  }

  async function handleUpdate(name: string, section: string, gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[], resources: CourseResource[], syllabus: SyllabusRow[]) {
    if (!editingCourse) return
    await updateCourse(editingCourse.id, name, section, [], gradingSystem, schedule, resources, syllabus)
    setEditingCourse(null)
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete course"
          message={`Delete "${confirmDelete.name}${confirmDelete.section ? ` · Section ${confirmDelete.section}` : ''}"? All enrolled students and uploaded files will be removed. This cannot be undone.`}
          onConfirm={async () => { await deleteCourse(confirmDelete.id); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <PageHeader title="Courses" subtitle="Manage your courses, syllabus, and enrolled students." />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {!showForm && !editingCourse && (
          <Button variant="primary" onClick={() => setShowForm(true)}>+ New course</Button>
        )}
      </div>
      {showForm && (
        <CourseForm courseId={newCourseId} onSave={handleCreate} onCancel={() => setShowForm(false)} uploadResource={uploadResource} deleteResource={deleteResource} />
      )}
      {courses.length === 0 && !showForm ? (
        <div style={{ fontSize: '13px', color: '#888' }}>No courses yet. Create your first course.</div>
      ) : (
        courses.map(course =>
          editingCourse?.id === course.id ? (
            <CourseForm
              key={course.id}
              courseId={course.id}
              initial={{
                name: course.name, section: course.section ?? '',
                gradingSystem: course.grading_system ?? [],
                schedule: course.schedule ?? [],
                resources: course.resources ?? [],
                syllabus: course.syllabus ?? [],
              }}
              onSave={handleUpdate}
              onCancel={() => setEditingCourse(null)}
              uploadResource={uploadResource}
              deleteResource={deleteResource}
            />
          ) : (
            <CourseRow key={course.id} course={course} facultyId={profile.id}
              onEdit={setEditingCourse} onDelete={setConfirmDelete}
              onToggle={toggleCourseStatus} getResourceUrl={getResourceUrl}
            />
          )
        )
      )}
    </div>
  )
}
