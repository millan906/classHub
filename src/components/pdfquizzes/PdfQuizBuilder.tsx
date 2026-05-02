import { useState } from 'react'
import { Button } from '../ui/Button'
import { formInputStyle } from '../../styles/shared'
import type { PdfQuiz, PdfQuizFormData, PdfQuizQuestionType } from '../../types'
import type { GradeGroup } from '../../hooks/useGradeBook'
import type { Course } from '../../types'

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function toUTCIso(local: string): string { return new Date(local).toISOString() }

interface RubricCategory { category_name: string; max_points: number }

interface KeyRow {
  question_number: number
  question_type: PdfQuizQuestionType
  correct_answer: string
  points: number               // for essay: sum of rubric; for others: direct
  rubric: RubricCategory[]     // only used when question_type === 'essay'
}

interface PdfQuizBuilderProps {
  courses: Course[]
  groups: GradeGroup[]
  onSave: (file: File | undefined, formData: PdfQuizFormData) => Promise<void>
  onCancel: () => void
  initialQuiz?: PdfQuiz
}

const TYPE_DEFAULTS: Record<PdfQuizQuestionType, string> = {
  mcq: 'A', truefalse: 'True', text: '', essay: '',
}

function emptyRow(num: number): KeyRow {
  return { question_number: num, question_type: 'mcq', correct_answer: 'A', points: 1, rubric: [] }
}

function AnswerInput({ row, onChange }: { row: KeyRow; onChange: (r: KeyRow) => void }) {
  if (row.question_type === 'mcq') {
    return (
      <select value={row.correct_answer} onChange={e => onChange({ ...row, correct_answer: e.target.value })}
        style={{ ...formInputStyle, marginBottom: 0, width: '80px' }}>
        {['A', 'B', 'C', 'D'].map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }
  if (row.question_type === 'truefalse') {
    return (
      <select value={row.correct_answer} onChange={e => onChange({ ...row, correct_answer: e.target.value })}
        style={{ ...formInputStyle, marginBottom: 0, width: '90px' }}>
        <option>True</option><option>False</option>
      </select>
    )
  }
  if (row.question_type === 'essay') {
    return <span style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic' }}>Manual grading</span>
  }
  return (
    <input type="text" value={row.correct_answer} onChange={e => onChange({ ...row, correct_answer: e.target.value })}
      placeholder="Answer" style={{ ...formInputStyle, marginBottom: 0, width: '120px' }} />
  )
}

export function PdfQuizBuilder({ courses, groups, onSave, onCancel, initialQuiz }: PdfQuizBuilderProps) {
  const [title, setTitle] = useState(initialQuiz?.title ?? '')
  const [courseId, setCourseId] = useState(initialQuiz?.course_id ?? '')
  const [gradeGroupId, setGradeGroupId] = useState(initialQuiz?.grade_group_id ?? '')
  const [dueDate, setDueDate] = useState(initialQuiz?.due_date ?? '')
  const [openAt, setOpenAt] = useState(initialQuiz?.open_at ? toLocalInput(initialQuiz.open_at) : '')
  const [closeAt, setCloseAt] = useState(initialQuiz?.close_at ? toLocalInput(initialQuiz.close_at) : '')
  const [maxAttempts, setMaxAttempts] = useState(initialQuiz?.max_attempts ?? 1)
  const [file, setFile] = useState<File | undefined>()
  const [fileError, setFileError] = useState('')
  const [instructions, setInstructions] = useState(initialQuiz?.instructions ?? '')
  const [saving, setSaving] = useState(false)

  const [keyRows, setKeyRows] = useState<KeyRow[]>(() => {
    if (initialQuiz?.answer_key && initialQuiz.answer_key.length > 0) {
      return [...initialQuiz.answer_key]
        .sort((a, b) => a.question_number - b.question_number)
        .map(k => {
          const rubricCats = (initialQuiz.essay_rubrics ?? [])
            .filter(r => r.question_number === k.question_number)
            .sort((a, b) => a.order_index - b.order_index)
            .map(r => ({ category_name: r.category_name, max_points: r.max_points }))
          return {
            question_number: k.question_number,
            question_type: k.question_type,
            correct_answer: k.correct_answer,
            points: k.points,
            rubric: rubricCats,
          }
        })
    }
    return [emptyRow(1)]
  })

  const totalPoints = keyRows.reduce((s, r) => s + (Number(r.points) || 0), 0)

  function addRow() {
    setKeyRows(prev => [...prev, emptyRow(prev.length + 1)])
  }

  function removeRow(idx: number) {
    setKeyRows(prev =>
      prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, question_number: i + 1 }))
    )
  }

  function updateRow(idx: number, updated: KeyRow) {
    setKeyRows(prev => prev.map((r, i) => i === idx ? updated : r))
  }

  function handleTypeChange(idx: number, type: PdfQuizQuestionType) {
    const row = keyRows[idx]
    const defaultRubric = type === 'essay'
      ? [{ category_name: 'Content', max_points: 10 }]
      : []
    const rubric = row.rubric.length > 0 && type === 'essay' ? row.rubric : defaultRubric
    const rubricPts = rubric.reduce((s, c) => s + c.max_points, 0)
    setKeyRows(prev => prev.map((r, i) => i === idx
      ? { ...r, question_type: type, correct_answer: TYPE_DEFAULTS[type], rubric, points: type === 'essay' ? rubricPts : 1 }
      : r
    ))
  }

  function addRubricCategory(rowIdx: number) {
    setKeyRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const newRubric = [...r.rubric, { category_name: '', max_points: 5 }]
      return { ...r, rubric: newRubric, points: newRubric.reduce((s, c) => s + c.max_points, 0) }
    }))
  }

  function updateRubricCategory(rowIdx: number, catIdx: number, field: keyof RubricCategory, value: string | number) {
    setKeyRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const newRubric = r.rubric.map((c, ci) => ci === catIdx ? { ...c, [field]: value } : c)
      return { ...r, rubric: newRubric, points: newRubric.reduce((s, c) => s + (Number(c.max_points) || 0), 0) }
    }))
  }

  function removeRubricCategory(rowIdx: number, catIdx: number) {
    setKeyRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r
      const newRubric = r.rubric.filter((_, ci) => ci !== catIdx)
      return { ...r, rubric: newRubric, points: newRubric.reduce((s, c) => s + c.max_points, 0) }
    }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 50 * 1024 * 1024) { setFileError('File too large. Maximum size is 50 MB.'); return }
    setFileError('')
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courseId) { setFileError('A course must be selected before saving.'); return }
    if (!title.trim()) return
    if (keyRows.length === 0) return

    setSaving(true)
    try {
      const formData: PdfQuizFormData = {
        title: title.trim(),
        courseId: courseId || null,
        gradeGroupId: gradeGroupId || null,
        dueDate: closeAt ? closeAt : (dueDate || null),
        openAt: openAt ? toUTCIso(openAt) : null,
        closeAt: closeAt ? toUTCIso(closeAt) : null,
        maxAttempts: Number(maxAttempts) || 1,
        instructions: instructions.trim() || null,
        answerKey: keyRows.map(r => ({
          question_number: r.question_number,
          question_type: r.question_type,
          correct_answer: r.question_type === 'essay' ? '' : r.correct_answer.trim(),
          points: Number(r.points) || (r.question_type === 'essay' ? r.rubric.reduce((s, c) => s + c.max_points, 0) : 1),
        })),
        rubrics: keyRows
          .filter(r => r.question_type === 'essay' && r.rubric.length > 0)
          .map(r => ({
            question_number: r.question_number,
            categories: r.rubric.map((c, i) => ({
              category_name: c.category_name,
              max_points: Number(c.max_points) || 1,
              order_index: i,
            })),
          })),
      }
      await onSave(file, formData)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 500, color: '#555', marginBottom: '4px', display: 'block' }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '720px' }}>
      {/* Details */}
      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '14px' }}>Details</div>

        <label style={labelStyle}>Title *</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Midterm Exam" required style={formInputStyle} />

        <label style={labelStyle}>Instructions (optional)</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="e.g. Write T if the statement is true and F if it is false…"
          rows={3}
          style={{ ...formInputStyle, resize: 'vertical', lineHeight: '1.5' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Course <span style={{ color: '#A32D2D' }}>*</span></label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ ...formInputStyle, borderColor: !courseId ? '#A32D2D' : undefined }}>
              <option value="">— Select a course —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Grade Group</label>
            <select value={gradeGroupId} onChange={e => setGradeGroupId(e.target.value)} style={formInputStyle}>
              <option value="">None</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={closeAt ? '' : dueDate} onChange={e => setDueDate(e.target.value)}
              disabled={!!closeAt} style={{ ...formInputStyle, opacity: closeAt ? 0.4 : 1 }} />
          </div>
          <div>
            <label style={labelStyle}>Max Attempts</label>
            <input type="number" min={1} max={10} value={maxAttempts}
              onChange={e => setMaxAttempts(Number(e.target.value))} style={formInputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#F8F7F2', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>Auto Schedule (optional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Opens at</label>
              <input type="datetime-local" value={openAt} onChange={e => setOpenAt(e.target.value)} style={formInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Closes at</label>
              <input type="datetime-local" value={closeAt} onChange={e => { setCloseAt(e.target.value); setDueDate('') }} style={formInputStyle} />
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px' }}>Students receive an email when it opens and a reminder 30 mins before it closes.</div>
        </div>

        <label style={labelStyle}>PDF File (optional) <span style={{ fontWeight: 400, color: '#aaa' }}>· max 50 MB</span></label>
        <input type="file" accept=".pdf" onChange={handleFileChange} style={{ fontSize: '13px', marginBottom: '4px' }} />
        {fileError && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '4px' }}>{fileError}</div>}
        {file && <div style={{ fontSize: '12px', color: '#555' }}>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</div>}
        {!file && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
          {initialQuiz?.pdf_path ? 'Current PDF kept if no new file selected.' : 'Leave blank for paper-only quizzes — students will answer via the answer form.'}
        </div>}
      </div>

      {/* Questions & Answer Key */}
      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Questions & Answer Key</div>
          <div style={{ fontSize: '12px', color: '#555' }}>Total: <strong>{totalPoints} pts</strong></div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 130px 1fr 70px 28px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', color: '#aaa' }}>Q#</span>
          <span style={{ fontSize: '11px', color: '#aaa' }}>Type</span>
          <span style={{ fontSize: '11px', color: '#aaa' }}>Correct Answer / Rubric</span>
          <span style={{ fontSize: '11px', color: '#aaa' }}>Points</span>
          <span />
        </div>

        {keyRows.map((row, idx) => (
          <div key={idx} style={{ marginBottom: row.question_type === 'essay' ? '14px' : '6px' }}>
            {/* Main row */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 130px 1fr 70px 28px', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>Q{row.question_number}</span>

              <select value={row.question_type}
                onChange={e => handleTypeChange(idx, e.target.value as PdfQuizQuestionType)}
                style={{ ...formInputStyle, marginBottom: 0 }}>
                <option value="mcq">MCQ (A–D)</option>
                <option value="truefalse">True / False</option>
                <option value="text">Text</option>
                <option value="essay">Essay</option>
              </select>

              <AnswerInput row={row} onChange={updated => updateRow(idx, updated)} />

              <input type="number" min={0} value={row.points}
                readOnly={row.question_type === 'essay'}
                onChange={e => updateRow(idx, { ...row, points: Number(e.target.value) })}
                style={{ ...formInputStyle, marginBottom: 0, background: row.question_type === 'essay' ? '#f9f9f9' : '#fff' }} />

              <button type="button" onClick={() => removeRow(idx)} disabled={keyRows.length === 1}
                style={{ background: 'none', border: 'none', cursor: keyRows.length === 1 ? 'default' : 'pointer', color: '#aaa', fontSize: '14px', padding: '2px' }}>
                ✕
              </button>
            </div>

            {/* Rubric editor (essay only) */}
            {row.question_type === 'essay' && (
              <div style={{ marginLeft: '44px', marginTop: '8px', background: '#f9f9f9', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', fontWeight: 500 }}>Scoring Rubric</div>
                {row.rubric.map((cat, ci) => (
                  <div key={ci} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <input type="text" value={cat.category_name}
                      onChange={e => updateRubricCategory(idx, ci, 'category_name', e.target.value)}
                      placeholder="Category name"
                      style={{ ...formInputStyle, marginBottom: 0, flex: 1 }} />
                    <input type="number" min={1} value={cat.max_points}
                      onChange={e => updateRubricCategory(idx, ci, 'max_points', Number(e.target.value))}
                      style={{ ...formInputStyle, marginBottom: 0, width: '64px' }} />
                    <span style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap' }}>pts</span>
                    <button type="button" onClick={() => removeRubricCategory(idx, ci)}
                      disabled={row.rubric.length === 1}
                      style={{ background: 'none', border: 'none', cursor: row.rubric.length === 1 ? 'default' : 'pointer', color: '#ccc', fontSize: '13px' }}>
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addRubricCategory(idx)}
                  style={{ fontSize: '11px', color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                  + Add category
                </button>
              </div>
            )}
          </div>
        ))}

        <Button type="button" onClick={addRow} style={{ marginTop: '8px' }}>+ Add Question</Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : initialQuiz ? 'Save Changes' : 'Create PDF Quiz'}
        </Button>
      </div>
    </form>
  )
}
