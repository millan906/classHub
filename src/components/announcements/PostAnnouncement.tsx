import React from 'react'
import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { Course } from '../../types'

interface PostAnnouncementProps {
  courses: Course[]
  onPost: (title: string, body: string, courseId: string | null) => Promise<void>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '8px', color: '#1a1a1a', boxSizing: 'border-box',
}

export function PostAnnouncement({ courses, onPost }: PostAnnouncementProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [courseId, setCourseId] = useState<string>('')
  const [posting, setPosting] = useState(false)

  async function handlePost() {
    if (!title.trim() || !body.trim()) return
    setPosting(true)
    try {
      await onPost(title.trim(), body.trim(), courseId || null)
      setTitle('')
      setBody('')
      setCourseId('')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Card>
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>Post announcement</div>

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Course</div>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} style={inputStyle}>
        <option value="">All courses</option>
        {courses.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}{c.section ? ` · Section ${c.section}` : ''}
          </option>
        ))}
      </select>

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Title</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" style={inputStyle} />

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Message</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement..." style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' }} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={handlePost} disabled={posting}>{posting ? 'Posting...' : 'Post'}</Button>
      </div>
    </Card>
  )
}
