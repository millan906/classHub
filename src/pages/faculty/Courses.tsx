import React, { useState, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'
import type { Course, GradingPeriod, CourseScheduleItem, CourseResource } from '../../types'

const inputStyle: React.CSSProperties = {
  padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  color: '#1a1a1a',
}

const sectionHead: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#888',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: '8px', marginTop: '18px',
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

// ─── CourseForm ───────────────────────────────────────────────────────────────

function CourseForm({
  courseId,
  initial,
  onSave,
  onCancel,
  uploadResource,
  deleteResource,
}: {
  courseId: string
  initial?: {
    name: string; section: string; topics: string[]
    gradingSystem: GradingPeriod[]; schedule: CourseScheduleItem[]
    resources: CourseResource[]
  }
  onSave: (
    name: string, section: string, topics: string[],
    gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[],
    resources: CourseResource[],
  ) => Promise<void>
  onCancel: () => void
  uploadResource: (courseId: string, file: File) => Promise<{ file_path: string; file_name: string }>
  deleteResource: (path: string) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [section, setSection] = useState(initial?.section ?? '')
  const [topics, setTopics] = useState<string[]>(initial?.topics ?? [])
  const [topicInput, setTopicInput] = useState('')
  const [gradingSystem, setGradingSystem] = useState<GradingPeriod[]>(
    initial?.gradingSystem?.length
      ? initial.gradingSystem
      : [{ label: 'Prelim', weight: 30 }, { label: 'Midterm', weight: 30 }, { label: 'Finals', weight: 40 }]
  )
  const [schedule, setSchedule] = useState<CourseScheduleItem[]>(initial?.schedule ?? [])
  const [resources, setResources] = useState<CourseResource[]>(initial?.resources ?? [])
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const totalWeight = gradingSystem.reduce((s, p) => s + (p.weight || 0), 0)

  // Topics
  function addTopic() {
    const t = topicInput.trim(); if (!t) return
    setTopics(prev => [...prev, t]); setTopicInput('')
  }
  function removeTopic(i: number) { setTopics(prev => prev.filter((_, idx) => idx !== i)) }

  // Grading
  function updatePeriod(i: number, field: 'label' | 'weight', value: string) {
    setGradingSystem(prev => prev.map((p, idx) =>
      idx === i ? { ...p, [field]: field === 'weight' ? Number(value) : value } : p
    ))
  }

  // Schedule
  function addScheduleItem() {
    setSchedule(prev => [...prev, { id: uid(), type: 'lecture', day: '', time: '', room: '' }])
  }
  function updateSchedule(i: number, field: keyof CourseScheduleItem, value: string) {
    setSchedule(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function removeSchedule(i: number) { setSchedule(prev => prev.filter((_, idx) => idx !== i)) }

  // Resources
  function addResource() {
    setResources(prev => [...prev, { id: uid(), title: '', category: 'book', link: '', file_path: '', file_name: '' }])
  }
  function updateResource(id: string, field: keyof CourseResource, value: string) {
    setResources(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  async function handleFileSelect(resourceId: string, file: File) {
    setUploading(prev => new Set(prev).add(resourceId))
    try {
      const { file_path, file_name } = await uploadResource(courseId, file)
      setResources(prev => prev.map(r =>
        r.id === resourceId ? { ...r, file_path, file_name, link: '' } : r
      ))
    } catch {
      setError('File upload failed. Try again.')
    } finally {
      setUploading(prev => { const next = new Set(prev); next.delete(resourceId); return next })
    }
  }
  async function removeResource(r: CourseResource) {
    if (r.file_path) await deleteResource(r.file_path)
    setResources(prev => prev.filter(res => res.id !== r.id))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Course name is required'); return }
    if (gradingSystem.length > 0 && totalWeight !== 100) {
      setError(`Grading weights must sum to 100% (currently ${totalWeight}%)`); return
    }
    setSaving(true); setError('')
    try {
      await onSave(name, section, topics, gradingSystem, schedule, resources)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)',
      borderRadius: '12px', padding: '16px 18px', marginBottom: '12px',
    }}>
      {/* Basic Info */}
      <div style={sectionHead}>Basic Info</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
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
          <button onClick={() => removeSchedule(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '16px', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      ))}

      {/* Topics */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' }}>
        <div style={{ ...sectionHead, marginTop: 0, marginBottom: 0 }}>Topics / Modules</div>
      </div>
      {topics.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
          <div style={{ flex: 1, fontSize: '12px', padding: '5px 10px', background: '#F9F9F7', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '7px', color: '#333' }}>{t}</div>
          <button onClick={() => removeTopic(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '16px', padding: '2px 4px', lineHeight: 1 }}>×</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
        <input value={topicInput} onChange={e => setTopicInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic() } }} placeholder="Add a topic or module..." style={{ ...inputStyle, flex: 1, fontSize: '12px' }} />
        <Button onClick={addTopic} style={{ fontSize: '12px' }}>Add</Button>
      </div>

      {/* Resources */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '8px' }}>
        <div style={{ ...sectionHead, marginTop: 0, marginBottom: 0 }}>Resources</div>
        <Button onClick={addResource} style={{ fontSize: '11px', padding: '3px 10px' }}>+ Add</Button>
      </div>
      {resources.length === 0 && <div style={{ fontSize: '12px', color: '#bbb', marginBottom: '4px' }}>No resources added yet.</div>}
      {resources.map(r => (
        <div key={r.id} style={{ background: '#F9F9F7', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px', padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
            <select value={r.category} onChange={e => updateResource(r.id, 'category', e.target.value as CourseResource['category'])} style={{ ...inputStyle, fontSize: '12px', flexShrink: 0 }}>
              {RESOURCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input value={r.title} onChange={e => updateResource(r.id, 'title', e.target.value)} placeholder="Title / Description" style={{ ...inputStyle, flex: 1, minWidth: '140px', fontSize: '12px' }} />
            <button onClick={() => removeResource(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '16px', padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
          {/* Link or file */}
          {r.file_path ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#1D9E75' }}>📎 {r.file_name}</span>
              <button onClick={() => { updateResource(r.id, 'file_path', ''); updateResource(r.id, 'file_name', '') }} style={{ fontSize: '11px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}>Remove file</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={r.link ?? ''} onChange={e => updateResource(r.id, 'link', e.target.value)} placeholder="Paste a link (URL)..." style={{ ...inputStyle, flex: 1, minWidth: '160px', fontSize: '12px' }} />
              <span style={{ fontSize: '12px', color: '#aaa' }}>or</span>
              <input
                type="file"
                ref={el => { fileRefs.current[r.id] = el }}
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(r.id, f) }}
              />
              <Button
                onClick={() => fileRefs.current[r.id]?.click()}
                disabled={uploading.has(r.id)}
                style={{ fontSize: '12px' }}
              >
                {uploading.has(r.id) ? 'Uploading…' : '📎 Upload file'}
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
          <button onClick={() => setGradingSystem(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '16px', padding: '2px 4px', lineHeight: 1 }}>×</button>
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

// ─── CourseInfoPanel (read-only) ──────────────────────────────────────────────

function CourseInfoPanel({ course, getResourceUrl }: { course: Course; getResourceUrl: (p: string) => string }) {
  const topics = course.topics ?? []
  const schedule = course.schedule ?? []
  const grading = course.grading_system ?? []
  const resources = course.resources ?? []

  const byCategory = (cat: CourseResource['category']) => resources.filter(r => r.category === cat)
  const CAT_LABELS: Record<CourseResource['category'], string> = { book: '📚 Books', journal: '📰 Journals', lab: '🧪 Lab Materials', other: '📎 Other' }

  const hasContent = topics.length > 0 || schedule.length > 0 || grading.length > 0 || resources.length > 0
  if (!hasContent) return (
    <div style={{ fontSize: '12px', color: '#aaa', paddingTop: '10px', borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px' }}>
      No course info added yet. Click Edit to fill in details.
    </div>
  )

  return (
    <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px', paddingTop: '12px' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {schedule.length > 0 && (
          <div style={{ minWidth: '200px' }}>
            <div style={sectionHead}>Schedule</div>
            {schedule.map(s => (
              <div key={s.id} style={{ marginBottom: '5px' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a1a1a' }}>
                  {s.type.charAt(0).toUpperCase() + s.type.slice(1)} — {s.day}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>{s.time}{s.room ? ` · ${s.room}` : ''}</div>
              </div>
            ))}
          </div>
        )}
        {topics.length > 0 && (
          <div style={{ minWidth: '180px', flex: 1 }}>
            <div style={sectionHead}>Topics</div>
            {topics.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                <span style={{ color: '#1D9E75', fontSize: '11px', marginTop: '1px', flexShrink: 0 }}>▸</span>
                <span style={{ fontSize: '12px', color: '#444' }}>{t}</span>
              </div>
            ))}
          </div>
        )}
        {grading.length > 0 && (
          <div style={{ minWidth: '140px' }}>
            <div style={sectionHead}>Grading</div>
            {grading.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#444' }}>{p.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{p.weight}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {resources.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={sectionHead}>Resources</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {(['book', 'journal', 'lab', 'other'] as CourseResource['category'][]).map(cat => {
              const items = byCategory(cat)
              if (items.length === 0) return null
              return (
                <div key={cat} style={{ minWidth: '150px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', marginBottom: '5px' }}>{CAT_LABELS[cat]}</div>
                  {items.map(r => (
                    <div key={r.id} style={{ marginBottom: '4px' }}>
                      {r.file_path ? (
                        <a href={getResourceUrl(r.file_path)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none' }}>
                          📎 {r.title || r.file_name}
                        </a>
                      ) : r.link ? (
                        <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none' }}>
                          🔗 {r.title || r.link}
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#555' }}>{r.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
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
    try {
      await enrollStudent(course.id, selectedStudentId, facultyId)
      setSelectedStudentId('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to invite')
    } finally { setInviting(false) }
  }

  return (
    <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', marginTop: '10px', paddingTop: '10px' }}>
      <div style={{ fontSize: '12px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>
        Enrolled students ({enrolledStudents.length})
      </div>
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
  onEdit: (course: Course) => void
  onDelete: (course: Course) => void
  onToggle: (id: string, status: 'open' | 'closed') => void
  getResourceUrl: (p: string) => string
}) {
  const isOpen = course.status === 'open'
  const [panel, setPanel] = useState<'none' | 'info' | 'students'>('none')

  return (
    <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{course.name}</span>
          {course.section && <span style={{ fontSize: '12px', color: '#888' }}>· Section {course.section}</span>}
          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: isOpen ? '#E1F5EE' : '#F1EFE8', color: isOpen ? '#0F6E56' : '#888' }}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Button onClick={() => setPanel(p => p === 'info' ? 'none' : 'info')} style={{ fontSize: '12px', background: panel === 'info' ? '#F1EFE8' : undefined }}>
          {panel === 'info' ? 'Hide info' : 'Course info'}
        </Button>
        <Button onClick={() => setPanel(p => p === 'students' ? 'none' : 'students')} style={{ fontSize: '12px', background: panel === 'students' ? '#F1EFE8' : undefined }}>
          {panel === 'students' ? 'Hide students' : 'Students'}
        </Button>
        <Button onClick={() => onEdit(course)}>Edit</Button>
        <Button
          onClick={() => onToggle(course.id, isOpen ? 'closed' : 'open')}
          style={isOpen ? { background: '#FEF3CD', color: '#D4900A', borderColor: '#D4900A' } : { background: '#E1F5EE', color: '#0F6E56', borderColor: '#0F6E56' }}
        >
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

  async function handleCreate(
    name: string, section: string, topics: string[],
    gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[], resources: CourseResource[],
  ) {
    await createCourse(newCourseId, name, section, profile!.id, topics, gradingSystem, schedule, resources)
    setShowForm(false)
  }

  async function handleUpdate(
    name: string, section: string, topics: string[],
    gradingSystem: GradingPeriod[], schedule: CourseScheduleItem[], resources: CourseResource[],
  ) {
    if (!editingCourse) return
    await updateCourse(editingCourse.id, name, section, topics, gradingSystem, schedule, resources)
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
        <CourseForm
          courseId={newCourseId}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          uploadResource={uploadResource}
          deleteResource={deleteResource}
        />
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
                name: course.name,
                section: course.section ?? '',
                topics: course.topics ?? [],
                gradingSystem: course.grading_system ?? [],
                schedule: course.schedule ?? [],
                resources: course.resources ?? [],
              }}
              onSave={handleUpdate}
              onCancel={() => setEditingCourse(null)}
              uploadResource={uploadResource}
              deleteResource={deleteResource}
            />
          ) : (
            <CourseRow
              key={course.id}
              course={course}
              facultyId={profile.id}
              onEdit={setEditingCourse}
              onDelete={setConfirmDelete}
              onToggle={toggleCourseStatus}
              getResourceUrl={getResourceUrl}
            />
          )
        )
      )}
    </div>
  )
}
