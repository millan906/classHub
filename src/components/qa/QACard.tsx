import React, { useState } from 'react'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { Question, Profile } from '../../types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 11px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  color: '#1a1a1a', display: 'block', marginBottom: '8px', boxSizing: 'border-box',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface QACardProps {
  question: Question
  currentProfile: Profile
  onAnswer: (questionId: string, body: string) => Promise<void>
  onEndorse?: (answerId: string) => Promise<void>
  onUpdate?: (id: string, title: string, body: string, tag: string) => Promise<void>
  onToggle?: (id: string, isAnswered: boolean) => Promise<void>
}

export function QACard({ question, currentProfile, onAnswer, onEndorse, onUpdate, onToggle }: QACardProps) {
  const [showReply, setShowReply] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(question.title)
  const [editBody, setEditBody] = useState(question.body)
  const [editTag, setEditTag] = useState(question.tag ?? '')
  const [saving, setSaving] = useState(false)

  const isFaculty = currentProfile.role === 'faculty'
  const borderColor = question.is_answered ? '#1D9E75' : '#EF9F27'
  const poster = question.poster
  const colors = poster ? getAvatarColors(poster.full_name) : { bg: '#E1F5EE', color: '#085041' }
  const initials = poster ? getInitials(poster.full_name) : '??'
  const answerCount = question.answers?.length ?? 0

  async function handlePostAnswer() {
    if (!replyText.trim()) return
    setPosting(true)
    try {
      await onAnswer(question.id, replyText.trim())
      setReplyText('')
      setShowReply(false)
    } finally {
      setPosting(false)
    }
  }

  async function handleSaveEdit() {
    if (!onUpdate || !editTitle.trim() || !editBody.trim()) return
    setSaving(true)
    try {
      await onUpdate(question.id, editTitle.trim(), editBody.trim(), editTag.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditTitle(question.title)
    setEditBody(question.body)
    setEditTag(question.tag ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderLeft: '3px solid #1D9E75', borderRadius: '0 12px 12px 0',
        padding: '0.9rem 1.1rem', marginBottom: '8px',
      }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Title</div>
        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inputStyle} />
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Details</div>
        <textarea value={editBody} onChange={e => setEditBody(e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Tag (optional)</div>
        <input value={editTag} onChange={e => setEditTag(e.target.value)} placeholder="e.g. Lecture 3, Exam" style={inputStyle} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
          <Button onClick={handleCancelEdit}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: '0 12px 12px 0', padding: '0.9rem 1.1rem', marginBottom: '8px',
    }}>
      {/* Header: avatar + title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
        <Avatar initials={initials} bg={colors.bg} color={colors.color} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{question.title}</div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {poster?.full_name ?? 'Unknown'} · {timeAgo(question.created_at)}
          </div>
        </div>
        <Badge
          label={question.is_answered ? `${answerCount} answer${answerCount !== 1 ? 's' : ''}` : 'Unanswered'}
          color={question.is_answered ? 'green' : 'amber'}
        />
        {question.is_answered && (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: '#E1F5EE', color: '#0F6E56', flexShrink: 0,
          }}>
            Closed
          </span>
        )}
      </div>

      {/* Tag — above question body */}
      {question.tag && (
        <div style={{ marginBottom: '6px', paddingLeft: '38px' }}>
          <Badge label={question.tag} color="blue" />
        </div>
      )}

      <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6, marginBottom: '10px' }}>
        {question.body}
      </div>

      {/* Actions — all in one row */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {answerCount > 0 && (
          <Button onClick={() => setShowAnswers(v => !v)}>
            {showAnswers ? 'Hide answers' : 'View answers'}
          </Button>
        )}
        {isFaculty && onUpdate && (
          <Button onClick={() => setEditing(true)}>Edit</Button>
        )}
        {isFaculty && onToggle && (
          <Button
            onClick={() => onToggle(question.id, !question.is_answered)}
            style={question.is_answered
              ? { background: '#FEF3CD', color: '#D4900A', borderColor: '#D4900A' }
              : { background: '#E1F5EE', color: '#0F6E56', borderColor: '#0F6E56' }
            }
          >
            {question.is_answered ? 'Reopen' : 'Close'}
          </Button>
        )}
        {(!question.is_answered || isFaculty) && (
          <Button onClick={() => setShowReply(v => !v)}>Answer</Button>
        )}
      </div>

      {showAnswers && question.answers && question.answers.length > 0 && (
        <div style={{ marginTop: '10px', borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: '10px' }}>
          {question.answers.map(answer => {
            const aColors = answer.poster ? getAvatarColors(answer.poster.full_name) : colors
            const aInitials = answer.poster ? getInitials(answer.poster.full_name) : '??'
            const isFacultyAnswer = answer.poster?.role === 'faculty'
            return (
              <div key={answer.id} style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                <Avatar initials={aInitials} bg={isFacultyAnswer ? '#9FE1CB' : aColors.bg} color={isFacultyAnswer ? '#085041' : aColors.color} size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{answer.poster?.full_name ?? 'Unknown'}</span>
                    {isFacultyAnswer && <span style={{ fontSize: '11px', color: '#0F6E56' }}>Prof.</span>}
                    {answer.is_endorsed && (
                      <span style={{ fontSize: '11px', background: '#E1F5EE', color: '#0F6E56', padding: '2px 8px', borderRadius: '999px', fontWeight: 500 }}>
                        Endorsed by Prof.
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: '#aaa', marginLeft: 'auto' }}>{timeAgo(answer.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6 }}>{answer.body}</div>
                  {isFaculty && !answer.is_endorsed && onEndorse && (
                    <Button style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }} onClick={() => onEndorse(answer.id)}>
                      Endorse
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showReply && (
        <div style={{ marginTop: '10px' }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write your answer..."
            style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <Button onClick={() => setShowReply(false)}>Cancel</Button>
            <Button variant="primary" onClick={handlePostAnswer} disabled={posting}>
              {posting ? 'Posting...' : 'Post answer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
