import React, { useState } from 'react'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { viewFile } from '../../utils/viewFile'
import type { Question, Profile, Quiz, AttendanceSession } from '../../types'

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
  onUpdate?: (id: string, title: string, body: string, tag: string, isPrivate?: boolean) => Promise<void>
  onToggle?: (id: string, isAnswered: boolean) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  quizzes?: Quiz[]
  attendanceSessions?: AttendanceSession[]
  onGrantRetake?: (quizId: string, studentId: string) => Promise<void>
  onLogExcused?: (sessionId: string, studentId: string) => Promise<void>
}

export function QACard({ question, currentProfile, onAnswer, onEndorse, onUpdate, onToggle, onDelete, quizzes, attendanceSessions, onGrantRetake, onLogExcused }: QACardProps) {
  const [showReply, setShowReply] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [posting, setPosting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(question.title)
  const [editBody, setEditBody] = useState(question.body)
  const [editTag, setEditTag] = useState(question.tag ?? '')
  const [editIsPrivate, setEditIsPrivate] = useState(question.is_private)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [excusePanel, setExcusePanel] = useState<'retake' | 'excused' | null>(null)
  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [acting, setActing] = useState(false)
  const [actionDone, setActionDone] = useState('')
  const [actionError, setActionError] = useState('')

  const isFaculty = currentProfile.role === 'faculty'
  const isOwner = currentProfile.id === question.posted_by
  const isExcuseRequest = question.question_type === 'excuse_request'
  const courseQuizzes = (quizzes ?? []).filter(q => !question.course_id || q.course_id === question.course_id)
  const courseSessions = (attendanceSessions ?? []).filter(s => !question.course_id || s.course_id === question.course_id)

  async function handleGrantRetake() {
    if (!selectedQuizId || !onGrantRetake) return
    setActing(true); setActionError('')
    try {
      await onGrantRetake(selectedQuizId, question.posted_by)
      setActionDone('Retake granted successfully.')
      setExcusePanel(null); setSelectedQuizId('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to grant retake.')
    } finally { setActing(false) }
  }

  async function handleLogExcused() {
    if (!selectedSessionId || !onLogExcused) return
    setActing(true); setActionError('')
    try {
      await onLogExcused(selectedSessionId, question.posted_by)
      setActionDone('Marked as excused in attendance.')
      setExcusePanel(null); setSelectedSessionId('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to log excused absence.')
    } finally { setActing(false) }
  }
  const wasEdited = question.updated_at && question.updated_at !== question.created_at
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
      await onUpdate(question.id, editTitle.trim(), editBody.trim(), editTag.trim(), isOwner ? editIsPrivate : undefined)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelEdit() {
    setEditTitle(question.title)
    setEditBody(question.body)
    setEditTag(question.tag ?? '')
    setEditIsPrivate(question.is_private)
    setEditing(false)
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(question.id)
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
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
        {isOwner && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', marginBottom: '10px', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={editIsPrivate}
              onChange={e => setEditIsPrivate(e.target.checked)}
              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#1D9E75' }}
            />
            <span style={{ fontSize: '12px', color: '#555' }}>🔒 Private — only visible to you and faculty</span>
          </label>
        )}
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
      {/* Header: avatar + title/author only — badges on their own row below */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
        <Avatar initials={initials} bg={colors.bg} color={colors.color} size={28} seed={poster?.avatar_seed} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{question.title}</div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {poster?.full_name ?? 'Unknown'} · {timeAgo(question.created_at)}
            {wasEdited && (
              <span style={{ color: '#bbb', marginLeft: '4px' }}>· edited {timeAgo(question.updated_at!)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Badges row — indented to align with title, wraps on mobile */}
      <div style={{ paddingLeft: '38px', display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
        {question.recipient_ids && question.recipient_ids.length > 0 && isFaculty && (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: '#EFF6FF', color: '#1D4ED8',
          }}>
            → {question.recipient_ids.length === 1 ? '1 student' : `${question.recipient_ids.length} students`}
          </span>
        )}
        {question.is_private && !question.recipient_ids?.length && (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: '#F3F0FF', color: '#5B4FCF',
          }}>
            🔒 Private
          </span>
        )}
        {question.question_type === 'excuse_request' && (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: '#FEF3CD', color: '#7A4F00',
          }}>
            📋 Excuse / Request
          </span>
        )}
        <Badge
          label={question.is_answered ? `${answerCount} response${answerCount !== 1 ? 's' : ''}` : 'Unanswered'}
          color={question.is_answered ? 'green' : 'amber'}
        />
        {question.is_answered && (
          <span style={{
            fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
            background: '#E1F5EE', color: '#0F6E56',
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

      {/* Attachment — shown for excuse requests that have a supporting document */}
      {question.attachment_url && (
        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={() => viewFile(question.attachment_url!)}
            style={{
              fontSize: '12px', color: '#185FA5', background: '#EFF6FF',
              border: '0.5px solid #BFDBFE', borderRadius: '8px',
              padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📎 {question.attachment_name ?? 'View document'}
          </button>
        </div>
      )}

      {/* Faculty action panel — only on excuse requests */}
      {isFaculty && isExcuseRequest && (onGrantRetake || onLogExcused) && (
        <div style={{ background: '#F8F8F8', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>Actions</div>
          {actionDone && !excusePanel && (
            <div style={{ fontSize: '12px', color: '#0F6E56', marginBottom: '6px' }}>✓ {actionDone}</div>
          )}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: excusePanel ? '10px' : 0 }}>
            {onGrantRetake && (
              <button
                onClick={() => { setExcusePanel(excusePanel === 'retake' ? null : 'retake'); setActionError('') }}
                style={{
                  fontSize: '12px', fontWeight: 500, padding: '4px 12px', borderRadius: '999px',
                  border: '0.5px solid #1D9E75', background: excusePanel === 'retake' ? '#1D9E75' : 'transparent',
                  color: excusePanel === 'retake' ? '#fff' : '#1D9E75', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Grant retake
              </button>
            )}
            {onLogExcused && (
              <button
                onClick={() => { setExcusePanel(excusePanel === 'excused' ? null : 'excused'); setActionError('') }}
                style={{
                  fontSize: '12px', fontWeight: 500, padding: '4px 12px', borderRadius: '999px',
                  border: '0.5px solid #185FA5', background: excusePanel === 'excused' ? '#185FA5' : 'transparent',
                  color: excusePanel === 'excused' ? '#fff' : '#185FA5', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Log excused absence
              </button>
            )}
          </div>

          {excusePanel === 'retake' && (
            <div>
              {courseQuizzes.length === 0
                ? <div style={{ fontSize: '12px', color: '#aaa' }}>No assessments found for this course.</div>
                : <select
                    value={selectedQuizId}
                    onChange={e => setSelectedQuizId(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff', fontFamily: 'inherit', marginBottom: '6px' }}
                  >
                    <option value=''>Select assessment…</option>
                    {courseQuizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                  </select>
              }
              {actionError && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '6px' }}>{actionError}</div>}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <Button onClick={() => { setExcusePanel(null); setSelectedQuizId('') }}>Cancel</Button>
                <Button variant="primary" onClick={handleGrantRetake} disabled={!selectedQuizId || acting}>
                  {acting ? 'Granting…' : 'Grant'}
                </Button>
              </div>
            </div>
          )}

          {excusePanel === 'excused' && (
            <div>
              {courseSessions.length === 0
                ? <div style={{ fontSize: '12px', color: '#aaa' }}>No attendance sessions found for this course.</div>
                : <select
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff', fontFamily: 'inherit', marginBottom: '6px' }}
                  >
                    <option value=''>Select session…</option>
                    {courseSessions.map(s => <option key={s.id} value={s.id}>{s.label} — {s.date}</option>)}
                  </select>
              }
              {actionError && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '6px' }}>{actionError}</div>}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <Button onClick={() => { setExcusePanel(null); setSelectedSessionId('') }}>Cancel</Button>
                <Button variant="primary" onClick={handleLogExcused} disabled={!selectedSessionId || acting}>
                  {acting ? 'Logging…' : 'Log'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions — all in one row */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {answerCount > 0 && (
          <Button onClick={() => setShowAnswers(v => !v)}>
            {showAnswers ? 'Hide responses' : 'View responses'}
          </Button>
        )}
        {isFaculty && onUpdate && (
          <Button onClick={() => setEditing(true)}>Edit</Button>
        )}
        {!isFaculty && isOwner && onUpdate && (
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
          <Button onClick={() => setShowReply(v => !v)}>
            {showReply ? 'Cancel' : 'Add a response'}
          </Button>
        )}
        {isFaculty && onDelete && !confirmDelete && (
          <Button
            onClick={() => setConfirmDelete(true)}
            style={{ background: '#FEF0F0', color: '#A32D2D', borderColor: '#A32D2D' }}
          >
            Delete
          </Button>
        )}
        {isFaculty && onDelete && confirmDelete && (
          <>
            <span style={{ fontSize: '12px', color: '#A32D2D' }}>Delete this question?</span>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: '#A32D2D', color: '#fff', borderColor: '#A32D2D' }}
            >
              {deleting ? 'Deleting...' : 'Confirm'}
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </>
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
                <Avatar initials={aInitials} bg={isFacultyAnswer ? '#9FE1CB' : aColors.bg} color={isFacultyAnswer ? '#085041' : aColors.color} size={24} seed={answer.poster?.avatar_seed} />
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
            placeholder="Write your response..."
            style={{ ...inputStyle, minHeight: '65px', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={handlePostAnswer} disabled={posting}>
              {posting ? 'Posting...' : 'Post response'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
