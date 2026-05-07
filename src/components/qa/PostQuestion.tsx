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
    questionType?: 'question' | 'excuse_request',
    attachmentUrl?: string | null, attachmentName?: string | null,
  ) => Promise<void>
  onUploadAttachment?: (file: File) => Promise<{ url: string; name: string }>
  courses?: Course[]
  students?: Profile[]
  allEnrollments?: Enrollment[]
}

export function PostQuestion({ onPost, onUploadAttachment, courses, students, allEnrollments }: PostQuestionProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [questionType, setQuestionType] = useState<'question' | 'excuse_request'>('question')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Faculty mode = audience picker is available (students prop passed)
  // Course dropdown is shown for both roles independently
  const isFacultyMode = students !== undefined
  const isExcuseRequest = questionType === 'excuse_request'

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

  function handleTypeChange(type: 'question' | 'excuse_request') {
    setQuestionType(type)
    if (type === 'excuse_request') setIsPrivate(true)
    setAttachmentFile(null)
    setUploadError('')
  }

  function reset() {
    setTitle(''); setBody(''); setTag(''); setIsPrivate(false)
    setCourseId(null); setSelectedIds(new Set())
    setQuestionType('question'); setAttachmentFile(null); setUploadError('')
    setOpen(false)
  }

  async function handlePost() {
    if (!title.trim() || !body.trim()) return
    if (isExcuseRequest && !attachmentFile) {
      setUploadError('A supporting document is required. Please attach a medical certificate or official school letter.')
      return
    }
    setPosting(true)
    setUploadError('')
    try {
      let attachmentUrl: string | null = null
      let attachmentName: string | null = null
      if (isExcuseRequest && attachmentFile && onUploadAttachment) {
        const result = await onUploadAttachment(attachmentFile)
        attachmentUrl = result.url
        attachmentName = result.name
      }
      const recipientIds = isDM ? Array.from(selectedIds) : null
      await onPost(title.trim(), body.trim(), tag.trim(), isPrivate, courseId, recipientIds, questionType, attachmentUrl, attachmentName)
      reset()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload attachment.')
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
      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
        {isExcuseRequest ? 'Submit excuse / request' : 'Ask a question'}
      </div>

      {/* Student: question type toggle */}
      {!isFacultyMode && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {(['question', 'excuse_request'] as const).map(type => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              style={{
                padding: '5px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
                border: '0.5px solid',
                background: questionType === type ? '#1D9E75' : 'transparent',
                color: questionType === type ? '#fff' : '#555',
                borderColor: questionType === type ? '#1D9E75' : 'rgba(0,0,0,0.2)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {type === 'question' ? 'Question' : 'Excuse / Request'}
            </button>
          ))}
        </div>
      )}

      {/* Course selector — shown for both students and faculty when courses available */}
      {courses && courses.length > 0 && (
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

      {/* Faculty: audience checkboxes */}
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

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
        {isExcuseRequest ? 'Subject' : 'Title'}
      </div>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={isExcuseRequest ? 'e.g. Excuse for absence — May 4' : 'Question title'}
        style={inputStyle}
      />

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Details</div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={isExcuseRequest
          ? 'Briefly explain your situation and what you are requesting...'
          : 'Describe your question...'}
        style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' as const }}
      />

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Tag (optional)</div>
      <input value={tag} onChange={e => setTag(e.target.value)} placeholder="e.g. Lecture 3, Lab 1, General" style={inputStyle} />

      {/* Excuse Request: file attachment */}
      {isExcuseRequest && (
        <div style={{
          background: '#F8F8F8', border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: '8px', padding: '10px 12px', marginBottom: '8px',
        }}>
          <div style={{ fontSize: '12px', color: '#555', fontWeight: 500, marginBottom: '5px' }}>
            Supporting document <span style={{ color: '#A32D2D' }}>*</span>
          </div>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={e => {
              const f = e.target.files?.[0] ?? null
              if (f && f.size > 25 * 1024 * 1024) {
                alert('File too large. Maximum size is 25 MB.')
                e.target.value = ''
                return
              }
              setAttachmentFile(f)
              setUploadError('')
            }}
            style={{ fontSize: '13px' }}
          />
          <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', lineHeight: 1.5 }}>
            Accepted: <strong>medical certificate</strong> or <strong>official school letter</strong> (e.g. for school activities / competitions). PDF or image · Max 25 MB.
          </div>
          {!attachmentFile && (
            <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '5px' }}>
              A supporting document is required to submit this request.
            </div>
          )}
          {attachmentFile && (
            <div style={{ fontSize: '12px', color: '#0F6E56', marginTop: '5px' }}>
              ✓ {attachmentFile.name} ({(attachmentFile.size / 1024 / 1024).toFixed(1)} MB)
            </div>
          )}
          {uploadError && (
            <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '5px' }}>{uploadError}</div>
          )}
        </div>
      )}

      {/* Privacy */}
      {!isDM && !isExcuseRequest && (
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
      {isExcuseRequest && (
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
          🔒 Private — only visible to you and faculty
        </div>
      )}
      {isDM && !isExcuseRequest && (
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
          🔒 Direct message — only visible to selected student{selectedIds.size !== 1 ? 's' : ''} and faculty
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        <Button onClick={reset}>Cancel</Button>
        <Button variant="primary" onClick={handlePost} disabled={posting || (isExcuseRequest && !attachmentFile)}>
          {posting ? (isExcuseRequest ? 'Submitting...' : 'Posting...') : (isExcuseRequest ? 'Submit request' : 'Post question')}
        </Button>
      </div>
    </Card>
  )
}
