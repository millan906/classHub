import { useState, useEffect } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { DraftQuestionEditor } from './DraftQuestionEditor'
import type { DraftQuestion } from './DraftQuestionEditor'
import { formInputStyle } from '../../styles/shared'
import type { Slide, Quiz, Course, ItemType, QuizFormData } from '../../types'
import type { GradeGroup } from '../../hooks/useGradeBook'

export type { ItemType } from '../../types'

export const TYPE_CONFIG: Record<ItemType, { label: string; color: string; groupName: string }> = {
  quiz:       { label: 'Quiz',       color: '#185FA5', groupName: 'Quizzes' },
  lab:        { label: 'Lab',        color: '#0F6E56', groupName: 'Laboratory' },
  assignment: { label: 'Assignment', color: '#3C3489', groupName: 'Assignments' },
  project:    { label: 'Project',    color: '#E65100', groupName: 'Project' },
  exam:       { label: 'Exam',       color: '#A32D2D', groupName: 'Exam' },
}

interface QuizBuilderProps {
  slides: Slide[]
  courses: Course[]
  groups?: GradeGroup[]
  onCreate: (data: QuizFormData) => Promise<void>
  onCancel: () => void
  initialQuiz?: Quiz
  onUpdate?: (quizId: string, data: QuizFormData) => Promise<void>
}

function makeMcqOptions(): { label: string; text: string }[] {
  return [{ label: 'a', text: '' }, { label: 'b', text: '' }, { label: 'c', text: '' }, { label: 'd', text: '' }]
}
function makeTFOptions(): { label: string; text: string }[] {
  return [{ label: 'a', text: 'True' }, { label: 'b', text: 'False' }]
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: '36px', height: '20px', borderRadius: '10px',
      background: value ? '#1D9E75' : '#D3D1C7',
      position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '3px', left: value ? '19px' : '3px', transition: 'left 0.2s',
      }} />
    </div>
  )
}

export function QuizBuilder({ slides, courses, groups = [], onCreate, onCancel, initialQuiz, onUpdate }: QuizBuilderProps) {
  const [itemType, setItemType] = useState<ItemType>((initialQuiz?.item_type as ItemType) ?? 'quiz')
  const [title, setTitle] = useState(initialQuiz?.title ?? '')
  const [courseId, setCourseId] = useState(initialQuiz?.course_id ?? '')
  const [slideId, setSlideId] = useState(initialQuiz?.slide_id ?? '')
  const [dueDate, setDueDate] = useState(initialQuiz?.due_date?.slice(0, 10) ?? '')
  const [timeLimit, setTimeLimit] = useState<string>(initialQuiz?.time_limit_minutes?.toString() ?? '')
  const [lockdown, setLockdown] = useState(initialQuiz?.lockdown_enabled ?? false)
  const [maxAttempts, setMaxAttempts] = useState<string>(initialQuiz?.max_attempts?.toString() ?? '1')
  const [description, setDescription] = useState(initialQuiz?.description ?? '')
  const [manualGroupId, setManualGroupId] = useState(initialQuiz?.grade_group_id ?? '')
  const [allowFileUpload, setAllowFileUpload] = useState(initialQuiz?.allow_file_upload ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initialQuiz?.questions?.map(q => ({
      question_text: q.question_text,
      type: q.type ?? 'mcq',
      options: Array.isArray(q.options) && q.options.length > 0 ? q.options : makeMcqOptions(),
      correct_option: q.correct_option,
      order_index: q.order_index,
      code_snippet: q.code_snippet ?? '',
      code_language: q.code_language ?? 'python',
      points: q.points ?? 1,
    })) ?? []
  )

  // Auto-select the matching grade group when item type changes (new items only)
  useEffect(() => {
    if (initialQuiz?.grade_group_id) return
    const targetName = TYPE_CONFIG[itemType].groupName
    const match = groups.find(g => g.name.toLowerCase() === targetName.toLowerCase())
    setManualGroupId(match?.id ?? '')
  }, [itemType, groups])

  function addQuestion(type: 'mcq' | 'truefalse' | 'codesnippet' | 'essay') {
    setQuestions(qs => [...qs, {
      question_text: '', type,
      options: type === 'truefalse' ? makeTFOptions() : type === 'essay' ? [] : makeMcqOptions(),
      correct_option: type === 'essay' ? '' : 'a',
      order_index: qs.length,
      code_snippet: '', code_language: 'python', points: 1,
    }])
  }

  function updateQuestion(i: number, field: string, value: string) {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, [field]: value } : q))
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions(qs => qs.map((q, idx) => idx === qi
      ? { ...q, options: q.options.map((o, j) => j === oi ? { ...o, text: value } : o) }
      : q))
  }

  function removeQuestion(i: number) {
    setQuestions(qs => qs.filter((_, idx) => idx !== i))
  }

  function buildFormData(): QuizFormData {
    const isQuiz = itemType === 'quiz'
    const qs = questions.map(q => ({
      question_text: q.question_text, type: q.type, options: q.options,
      correct_option: q.correct_option, order_index: q.order_index,
      code_snippet: q.code_snippet || null, code_language: q.code_language || null,
      points: q.points ?? 1,
    }))
    return {
      title: title.trim(),
      courseId: courseId || null,
      slideId: isQuiz ? (slideId || null) : null,
      dueDate: dueDate || null,
      timeLimitMinutes: isQuiz ? (timeLimit ? parseInt(timeLimit, 10) : null) : null,
      lockdownEnabled: isQuiz ? lockdown : false,
      maxAttempts: isQuiz ? (parseInt(maxAttempts) || 1) : 1,
      questions: qs.map(q => ({ ...q, points: Number(q.points) || 1, code_snippet: q.code_snippet ?? undefined, code_language: q.code_language ?? undefined })),
      itemType,
      gradeGroupId: manualGroupId || null,
      allowFileUpload: isQuiz ? false : allowFileUpload,
      description: isQuiz ? null : (description.trim() || null),
    }
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return }
    setError('')
    setSaving(true)
    try {
      const data = buildFormData()
      if (initialQuiz && onUpdate) {
        await onUpdate(initialQuiz.id, data)
      } else {
        await onCreate(data)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const cfg = TYPE_CONFIG[itemType]

  return (
    <Card>
      {/* Type selector — hidden when editing an existing item */}
      {!initialQuiz && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Type</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(Object.keys(TYPE_CONFIG) as ItemType[]).map(t => {
              const c = TYPE_CONFIG[t]
              const active = itemType === t
              return (
                <button key={t} onClick={() => { setItemType(t); setError('') }} style={{
                  padding: '5px 14px', fontSize: '12px', borderRadius: '999px',
                  border: active ? 'none' : '0.5px solid rgba(0,0,0,0.2)',
                  background: active ? c.color : 'transparent',
                  color: active ? '#fff' : '#555',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                }}>
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Course */}
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Course</div>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} style={formInputStyle}>
        <option value="">— No course assigned —</option>
        {courses.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}{c.section ? ` · Section ${c.section}` : ''}{c.status === 'closed' ? ' (Closed)' : ''}
          </option>
        ))}
      </select>

      {/* Title */}
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>
        {cfg.label} Title <span style={{ color: '#A32D2D' }}>*</span>
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)}
        placeholder={`${cfg.label} title`} style={formInputStyle} />

      {/* Description (non-quiz only) */}
      {itemType !== 'quiz' && (
        <>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Instructions / Content (optional)</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={`Describe what students need to do for this ${cfg.label.toLowerCase()}…`}
            rows={4}
            style={{ ...formInputStyle, resize: 'vertical', lineHeight: '1.5' }}
          />
        </>
      )}

      {/* Grade group — shown for all types */}
      {groups.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Grade group (optional)</div>
          <select value={manualGroupId} onChange={e => setManualGroupId(e.target.value)}
            style={{ ...formInputStyle, marginBottom: 0 }}>
            <option value="">— None —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.weight_percent}%)</option>)}
          </select>
        </div>
      )}

      {itemType === 'quiz' ? (
        <QuizSettings
          dueDate={dueDate} setDueDate={setDueDate}
          timeLimit={timeLimit} setTimeLimit={setTimeLimit}
          lockdown={lockdown} setLockdown={setLockdown}
          maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts}
          slideId={slideId} setSlideId={setSlideId}
          slides={slides}
        />
      ) : (
        <NonQuizSettings
          dueDate={dueDate} setDueDate={setDueDate}
          allowFileUpload={allowFileUpload} setAllowFileUpload={setAllowFileUpload}
        />
      )}

      {/* Questions — shown for ALL types */}
      <div style={{ marginBottom: '8px' }}>
        {questions.length > 0 && (
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: 500 }}>
            Questions ({questions.length})
          </div>
        )}
        {questions.map((q, i) => (
          <DraftQuestionEditor
            key={i}
            question={q}
            index={i}
            onUpdate={(field, value) => updateQuestion(i, field, value)}
            onUpdateOption={(oi, value) => updateOption(i, oi, value)}
            onRemove={() => removeQuestion(i)}
          />
        ))}
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: '#A32D2D', background: '#FCEBEB', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {/* Bottom row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button onClick={() => addQuestion('mcq')} style={{ background: '#E6F1FB', color: '#185FA5', borderColor: '#185FA5', fontSize: '12px' }}>+ MCQ</Button>
          <Button onClick={() => addQuestion('truefalse')} style={{ background: '#EEEDFE', color: '#3C3489', borderColor: '#3C3489', fontSize: '12px' }}>+ True/False</Button>
          <Button onClick={() => addQuestion('codesnippet')} style={{ background: '#E1F5EE', color: '#0F6E56', borderColor: '#0F6E56', fontSize: '12px' }}>+ Code Snippet</Button>
          <Button onClick={() => addQuestion('essay')} style={{ background: '#FEF3CD', color: '#7A4F00', borderColor: '#B8860B', fontSize: '12px' }}>+ Essay</Button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initialQuiz ? `Update ${cfg.label.toLowerCase()}` : `Save ${cfg.label.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Settings sub-panels ──────────────────────────────────────────────────────

function QuizSettings({ dueDate, setDueDate, timeLimit, setTimeLimit, lockdown, setLockdown, maxAttempts, setMaxAttempts, slideId, setSlideId, slides }: {
  dueDate: string; setDueDate: (v: string) => void
  timeLimit: string; setTimeLimit: (v: string) => void
  lockdown: boolean; setLockdown: (v: boolean) => void
  maxAttempts: string; setMaxAttempts: (v: string) => void
  slideId: string; setSlideId: (v: string) => void
  slides: Slide[]
}) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Deadline (optional)</div>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            style={{ ...formInputStyle, marginBottom: 0 }} />
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Time limit (optional)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" min="1" value={timeLimit} onChange={e => setTimeLimit(e.target.value)}
              placeholder="—" style={{ ...formInputStyle, marginBottom: 0, width: '70px' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>minutes</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Lockdown mode</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
            <Toggle value={lockdown} onChange={setLockdown} />
            <span style={{ fontSize: '12px', color: lockdown ? '#0F6E56' : '#888' }}>
              {lockdown ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Max attempts</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="number" min="1" max="10" value={maxAttempts}
            onChange={e => setMaxAttempts(e.target.value)}
            style={{ ...formInputStyle, marginBottom: 0, width: '70px' }} />
          <span style={{ fontSize: '12px', color: '#888' }}>attempt{parseInt(maxAttempts) !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Linked slide (optional)</div>
        <select value={slideId} onChange={e => setSlideId(e.target.value)}
          style={{ ...formInputStyle, marginBottom: 0 }}>
          <option value="">None</option>
          {slides.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>
    </>
  )
}

function NonQuizSettings({ dueDate, setDueDate, allowFileUpload, setAllowFileUpload }: {
  dueDate: string; setDueDate: (v: string) => void
  allowFileUpload: boolean; setAllowFileUpload: (v: boolean) => void
}) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Deadline (optional)</div>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          style={{ ...formInputStyle, marginBottom: 0 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Toggle value={allowFileUpload} onChange={setAllowFileUpload} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>Allow file upload</div>
          <div style={{ fontSize: '11px', color: '#888' }}>Students can submit a file (video, PDF, presentation, etc.)</div>
        </div>
      </div>
    </div>
  )
}
