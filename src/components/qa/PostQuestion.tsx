import React from 'react'
import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '8px', color: '#1a1a1a',
}

interface PostQuestionProps {
  onPost: (title: string, body: string, tag: string, isPrivate: boolean) => Promise<void>
}

export function PostQuestion({ onPost }: PostQuestionProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tag, setTag] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [posting, setPosting] = useState(false)

  async function handlePost() {
    if (!title.trim() || !body.trim()) return
    setPosting(true)
    try {
      await onPost(title.trim(), body.trim(), tag.trim(), isPrivate)
      setTitle(''); setBody(''); setTag(''); setIsPrivate(false); setOpen(false)
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
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Title</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Question title" style={inputStyle} />
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Details</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe your question..." style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' as const }} />
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Tag (optional)</div>
      <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Lecture 3, Exam, General" style={inputStyle} />
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant="primary" onClick={handlePost} disabled={posting}>{posting ? 'Posting...' : 'Post question'}</Button>
      </div>
    </Card>
  )
}
