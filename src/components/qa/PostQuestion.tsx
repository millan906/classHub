import React from 'react'
import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import type { Course, Profile } from '../../types'
import type { Enrollment } from '../../hooks/useEnrollments'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '8px', color: '#1a1a1a',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer', appearance: 'auto',
}

interface PostQuestionProps {
  onPost: (
    title: string, body: string, tag: string, isPrivate: boolean,
    courseId?: string | null, recipientIds?: string[] | null,
  ) => Promise<void>
  courses?: Course[]
  students?: Profile[]
  allEnrollments?: Enrollment[]
}

export function PostQuestion({ onPost, courses, students, allEnrollments }: PostQuestionProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [posting, setPosting] = useState(false)

  const isFacultyMode = courses !== undefined

  const audienceStudents = courseId && allEnrollments && students
    ? (() => {
        const enrolled = new Set(allEnrollments.filter(e => e.course_id === courseId).map(e => e.student_id))
        return students.filter(s => enrolled.has(s.id))
      })()
    : (students ?? [])

  const isDM = selectedIds.size > 0

  function toggleStudent(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function reset() {
    setTitle(''); setBody(''); setTag(''); setIsPrivate(false)
    setCourseId(null); setSelectedIds(new Set()); setOpen(false)
  }

  async function handlePost() {
    if (!title.trim() || !body.trim()) return
    setPosting(true)
    try {
      const recipientIds = isDM ? Array.from(selectedIds) : null
      await onPost(title.trim(), body.trim(), tag.trim(), isPrivate, courseId, recipientIds)
      reset()
    } finally {
      setPosting(false)
    }
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <Button variant="primary" onClick={() => setOpen(true)}>+ Ask a question</Button>
      </div>
    )
  }

  return (
    <Card style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>Ask a question</div>

      {/* Faculty: course scope */}
      {isFacultyMode && courses && courses.length > 0 && (
        <>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Course</div>
          <select
            value={courseId ?? ''}
            onChange={e => { setCourseId(e.target.value || null); setSelectedIds(new Set()) }}
            style={selectStyle}
          >
            <option value=''>All courses</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` — ${c.section}` : ''}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Faculty: audience — checkboxes per student */}
      {isFacultyMode && audienceStudents.length > 0 && (
        <>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
            Audience
            {isDM && (
              <span style={{ marginLeft: '8px', color: '#1D9E75', fontWeight: 500 }}>
                {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>
          <div style={{
            border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px',
            maxHeight: '160px', overflowY: 'auto', marginBottom: '8px',
          }}>
            {/* Everyone option */}
            <label style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 11px',
              cursor: 'pointer', borderBottom: '0.5px solid rgba(0,0,0,0.08)',
              background: selectedIds.size === 0 ? '#F0FDF8' : '#fff',
            }}>
              <input
                type="radio"
                checked={selectedIds.size === 0}
                onChange={() => setSelectedIds(new Set())}
                style={{ accentColor: '#1D9E75' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Everyone</span>
            </label>
            {/* Individual students */}
            {audienceStudents.map(s => (
              <label key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 11px',
                cursor: 'pointer', borderBottom: '0.5px solid rgba(0,0,0,0.05)',
                background: selectedIds.has(s.id) ? '#F0FDF8' : '#fff',
              }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(s.id)}
                  onChange={() => toggleStudent(s.id)}
                  style={{ accentColor: '#1D9E75' }}
                />
                <span style={{ fontSize: '13px' }}>{s.full_name}</span>
              </label>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Title</div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Question title" style={inputStyle} />

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Details</div>
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Describe your question..." style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' as const }} />

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Tag (optional)</div>
      <input value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g. Lecture 3, Exam, General" style={inputStyle} />

      {!isDM && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', marginBottom: '10px', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#1D9E75' }}
          />
          <span style={{ fontSize: '12px', color: '#555' }}>
            🔒 Private — only visible to you and faculty
          </span>
        </label>
      )}

      {isDM && (
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
          🔒 Direct message — only visible to selected student{selectedIds.size !== 1 ? 's' : ''} and faculty
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        <Button onClick={reset}>Cancel</Button>
        <Button variant="primary" onClick={handlePost} disabled={posting}>{posting ? 'Posting...' : 'Post question'}</Button>
      </div>
    </Card>
  )
}
