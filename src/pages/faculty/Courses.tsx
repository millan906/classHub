import React, { useState, useRef } from 'react'
import { viewFile } from '../../utils/viewFile'
import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useCourses } from '../../hooks/useCourses'
import { useCourseFaculty } from '../../hooks/useCourseFaculty'
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
          <button onClick={() => onUpdate(row.id, { ...row, [col]: { ...row[col], file_path: '', file_name: '' } })}
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
              <button onClick={() => setResources(prev => prev.map(res => res.id === r.id ? { ...res, file_path: '', file_name: '' } : res))} style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
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
          ? <button onClick={() => void viewFile(getResourceUrl(c.file_path!))} style={{ fontSize: '11px', color: '#185FA5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>📎 {c.file_name}</button>
          : c.link
          ? <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#185FA5' }}>🔗 Link</a>
          : null
        }
      </div>
    )
  }

  return (
    <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px', paddingTop: '12px' }}>
      {grading.length > 0 && (
        <div style={{ marginBottom: '10px', overflowX: 'auto' }}>
          <div style={sectionHead}>Grading System</div>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {grading.map((p, i) => (
                  <th key={i} style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'center', border: '0.5px solid #ddd', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.label}</th>
                ))}
                <th style={{ background: '#F1EFE8', padding: '5px 10px', textAlign: 'center', border: '0.5px solid #ddd', fontWeight: 600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {grading.map((p, i) => (
                  <td key={i} style={{ padding: '5px 10px', border: '0.5px solid #eee', textAlign: 'center', fontWeight: 600, color: '#1D9E75' }}>{p.weight}%</td>
                ))}
                <td style={{ padding: '5px 10px', border: '0.5px solid #eee', textAlign: 'center', fontWeight: 700, color: '#1D9E75', background: '#F9F9F7' }}>{grading.reduce((s, p) => s + p.weight, 0)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {schedule.length > 0 && (
        <div style={{ marginBottom: '10px', overflowX: 'auto' }}>
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

      {resources.length > 0 && (
        <div>
          <div style={sectionHead}>Additional Resources</div>
          {resources.map(r => (
            <div key={r.id} style={{ marginBottom: '4px' }}>
              {r.file_path
                ? <button onClick={() => void viewFile(getResourceUrl(r.file_path!))} style={{ fontSize: '12px', color: '#185FA5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>📎 {r.title || r.file_name}</button>
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
  const { institution } = useInstitutionContext()
  const { enrollments, enrollStudent, unenrollStudent, refetch } = useCourseEnrollments(course.id)
  const { students } = useStudents(institution?.id)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null)

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
      {confirmRemove && (
        <ConfirmDialog
          title="Remove student"
          message={`Remove ${confirmRemove.name} from this course? They will lose access to all course content.`}
          confirmLabel="Remove"
          onConfirm={async () => {
            try { await unenrollStudent(course.id, confirmRemove.id); await refetch(course.id) }
            catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to remove student') }
            finally { setConfirmRemove(null) }
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
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
            <Button variant="danger" onClick={() => setConfirmRemove({ id: s.id, name: s.full_name })} style={{ fontSize: '11px', padding: '2px 8px' }}>Remove</Button>
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

// ─── CourseFacultyPanel ───────────────────────────────────────────────────────

function CourseFacultyPanel({ courseId, institutionId, currentFacultyId }: {
  courseId: string
  institutionId: string | null | undefined
  currentFacultyId: string
}) {
  const { assignedIds, institutionFaculty, loading, assign, unassign } = useCourseFaculty(courseId, institutionId)
  const [saving, setSaving] = useState<string | null>(null)

  if (loading) return <div style={{ padding: '12px 0', fontSize: '12px', color: '#aaa' }}>Loading…</div>

  const unassigned = institutionFaculty.filter(f => !assignedIds.includes(f.id))

  async function toggle(facultyId: string, isAssigned: boolean) {
    setSaving(facultyId)
    try {
      if (isAssigned) await unassign(facultyId)
      else await assign(facultyId)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div style={{ borderTop: '0.5px solid #F1EFE8', marginTop: '10px', paddingTop: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Faculty assigned to this course
      </div>

      {institutionFaculty.length === 0 ? (
        <div style={{ fontSize: '12px', color: '#aaa' }}>No other faculty in this institution yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {institutionFaculty.map(f => {
            const isAssigned = assignedIds.includes(f.id)
            const isSelf = f.id === currentFacultyId
            const colors = getAvatarColors(f.full_name)
            return (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '10px',
                background: isAssigned ? '#F0FBF6' : '#fafafa',
                border: `0.5px solid ${isAssigned ? '#B6E8D4' : 'rgba(0,0,0,0.08)'}`,
              }}>
                <Avatar initials={getInitials(f.full_name)} bg={colors.bg} color={colors.color} seed={f.avatar_seed} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{f.full_name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{f.email}</div>
                </div>
                {isSelf ? (
                  <span style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500 }}>You</span>
                ) : (
                  <button
                    onClick={() => toggle(f.id, isAssigned)}
                    disabled={saving === f.id}
                    style={{
                      fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: 'none',
                      background: isAssigned ? '#FCEBEB' : '#1D9E75',
                      color: isAssigned ? '#A32D2D' : '#fff',
                      cursor: saving === f.id ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif', fontWeight: 500,
                      opacity: saving === f.id ? 0.6 : 1,
                    }}
                  >
                    {saving === f.id ? '…' : isAssigned ? 'Remove' : 'Assign'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {unassigned.length === 0 && institutionFaculty.length > 0 && (
        <div style={{ fontSize: '11px', color: '#aaa', marginTop: '8px' }}>All faculty in this institution are assigned.</div>
      )}
    </div>
  )
}

// ─── CourseRow ────────────────────────────────────────────────────────────────

function CourseRow({ course, facultyId, institutionId, courses, onEdit, onDelete, onToggle, onCopyInfo, getResourceUrl }: {
  course: Course; facultyId: string; institutionId: string | null | undefined; courses: Course[]
  onEdit: (c: Course) => void; onDelete: (c: Course) => void
  onToggle: (id: string, s: 'open' | 'closed') => void
  onCopyInfo: (sourceId: string, targetId: string) => Promise<void>
  getResourceUrl: (p: string) => string
}) {
  const isOpen = course.status === 'open'
  const [panel, setPanel] = useState<'none' | 'info' | 'students' | 'faculty'>('none')
  const [confirmClose, setConfirmClose] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const otherCourses = courses.filter(c => c.id !== course.id)
  const [copySource, setCopySource] = useState(otherCourses[0]?.id ?? '')
  const courseName = `${course.name}${course.section ? ` · Section ${course.section}` : ''}`
  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
      {confirmClose && (
        <ConfirmDialog
          title="Close course"
          message={`Close "${courseName}"? Students will no longer be able to access or submit assessments until you reopen it.`}
          confirmLabel="Close course"
          onConfirm={async () => { await onToggle(course.id, 'closed'); setConfirmClose(false) }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 500 }}>{course.name}</span>
        {course.section && <span style={{ fontSize: '12px', color: '#888' }}>· Section {course.section}</span>}
        <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: isOpen ? '#E1F5EE' : '#F1EFE8', color: isOpen ? '#0F6E56' : '#888' }}>
          {isOpen ? 'Open' : 'Closed'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button onClick={() => setPanel(p => p === 'info' ? 'none' : 'info')} style={{ fontSize: '12px', background: panel === 'info' ? '#F1EFE8' : undefined }}>
          {panel === 'info' ? 'Hide info' : 'Course info'}
        </Button>
        <Button onClick={() => setPanel(p => p === 'students' ? 'none' : 'students')} style={{ fontSize: '12px', background: panel === 'students' ? '#F1EFE8' : undefined }}>
          {panel === 'students' ? 'Hide students' : 'Students'}
        </Button>
        <Button onClick={() => onEdit(course)}>Edit</Button>
        {otherCourses.length > 0 && !copying && (
          <Button onClick={() => { setCopying(true); setCopySource(otherCourses[0].id) }} style={{ fontSize: '12px' }}>
            Fill from another course
          </Button>
        )}
        {copying && (
          <>
            <span style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap' }}>Copy syllabus & info from:</span>
            <select
              value={copySource}
              onChange={e => setCopySource(e.target.value)}
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px', border: '0.5px solid rgba(0,0,0,0.2)' }}
            >
              {otherCourses.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
              ))}
            </select>
            <Button
              variant="primary"
              disabled={copyLoading}
              onClick={async () => {
                setCopyLoading(true)
                try { await onCopyInfo(copySource, course.id) } finally {
                  setCopyLoading(false); setCopying(false)
                }
              }}
            >
              {copyLoading ? 'Copying...' : 'Apply'}
            </Button>
            <Button onClick={() => setCopying(false)}>Cancel</Button>
          </>
        )}
        <Button
          onClick={() => isOpen ? setConfirmClose(true) : onToggle(course.id, 'open')}
          style={isOpen ? { background: '#FEF3CD', color: '#D4900A', borderColor: '#D4900A' } : { background: '#E1F5EE', color: '#0F6E56', borderColor: '#0F6E56' }}>
          {isOpen ? 'Close' : 'Open'}
        </Button>
        <Button variant="danger" onClick={() => onDelete(course)}>Delete</Button>
      </div>
      {panel === 'info' && <CourseInfoPanel course={course} getResourceUrl={getResourceUrl} />}
      {panel === 'students' && <CourseStudentsPanel course={course} facultyId={facultyId} />}
      {panel === 'faculty' && <CourseFacultyPanel courseId={course.id} institutionId={institutionId} currentFacultyId={facultyId} />}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FacultyCourses() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { courses, createCourse, updateCourse, deleteCourse, toggleCourseStatus, uploadResource, deleteResource, getResourceUrl, copyCourseInfo } = useCourses(institution?.id, profile?.id)
  const [showForm, setShowForm] = useState(false)
  const [newCourseId] = useState(() => crypto.randomUUID())
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null)
  const [pageError, setPageError] = useState('')

  if (!profile) return null

  async function handleCreate(name: string, section: string, gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[], resources: CourseResource[], syllabus: SyllabusRow[]) {
    await createCourse(newCourseId, name, section, profile!.id, [], gradingSystem, schedule, resources, syllabus, institution?.id)
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
          onConfirm={async () => {
            try { await deleteCourse(confirmDelete.id); setConfirmDelete(null) }
            catch (err: unknown) { setPageError(err instanceof Error ? err.message : 'Failed to delete course') }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <PageHeader title="Courses" subtitle="Manage your courses, syllabus, and enrolled students." />
      {pageError && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' }}>
          {pageError} <button onClick={() => setPageError('')} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontWeight: 600 }}>✕</button>
        </div>
      )}
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
              institutionId={institution?.id}
              courses={courses}
              onEdit={setEditingCourse} onDelete={setConfirmDelete}
              onToggle={toggleCourseStatus} getResourceUrl={getResourceUrl}
              onCopyInfo={copyCourseInfo}
            />
          )
        )
      )}
    </div>
  )
}
