import React, { useState } from 'react'
import { Button } from '../ui/Button'
import type { Announcement, Course } from '../../types'

function isNew(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 48 * 60 * 60 * 1000
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '8px', color: '#1a1a1a', boxSizing: 'border-box',
}

interface AnnouncementCardProps {
  ann: Announcement
  courses?: Course[]
  isFaculty?: boolean
  onDelete?: (id: string) => void
  onUpdate?: (id: string, title: string, body: string, courseId: string | null) => Promise<void>
}

export function AnnouncementCard({ ann, courses, isFaculty, onDelete, onUpdate }: AnnouncementCardProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(ann.title)
  const [body, setBody] = useState(ann.body)
  const [courseId, setCourseId] = useState<string>(ann.course_id ?? '')
  const [saving, setSaving] = useState(false)

  const course = ann.course_id && courses ? courses.find(c => c.id === ann.course_id) : null

  async function handleSave() {
    if (!onUpdate || !title.trim() || !body.trim()) return
    setSaving(true)
    try {
      await onUpdate(ann.id, title.trim(), body.trim(), courseId || null)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setTitle(ann.title)
    setBody(ann.body)
    setCourseId(ann.course_id ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderLeft: '3px solid #1D9E75', borderRadius: '0 12px 12px 0',
        padding: '1rem 1.1rem', marginBottom: '8px',
      }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Course</div>
        <select value={courseId} onChange={e => setCourseId(e.target.value)} style={inputStyle}>
          <option value="">All courses</option>
          {(courses ?? []).map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · Section ${c.section}` : ''}</option>
          ))}
        </select>

        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Title</div>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />

        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Message</div>
        <textarea value={body} onChange={e => setBody(e.target.value)} style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderLeft: '3px solid #378ADD', borderRadius: '0 12px 12px 0',
      padding: '1rem 1.1rem', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px', color: '#185FA5', fontWeight: 500 }}>
          {isNew(ann.created_at) ? 'NEW · ' : ''}{formatDate(ann.created_at)}
        </span>
        {course ? (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '1px 7px',
            borderRadius: '999px', background: '#E6F1FB', color: '#185FA5',
          }}>
            {course.name}{course.section ? ` · Section ${course.section}` : ''}
          </span>
        ) : (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '1px 7px',
            borderRadius: '999px', background: '#F1EFE8', color: '#888',
          }}>
            All courses
          </span>
        )}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{ann.title}</div>
      <div style={{ fontSize: '13px', color: '#555', marginBottom: isFaculty ? '8px' : 0 }}>{ann.body}</div>
      {isFaculty && (
        <div style={{ display: 'flex', gap: '6px' }}>
          {onUpdate && <Button onClick={() => setEditing(true)}>Edit</Button>}
          {onDelete && <Button variant="danger" onClick={() => onDelete(ann.id)}>Delete</Button>}
        </div>
      )}
    </div>
  )
}
