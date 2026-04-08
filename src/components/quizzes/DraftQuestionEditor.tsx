import { Button } from '../ui/Button'
import { formInputStyle, inputStyle } from '../../styles/shared'

export type DraftQuestion = {
  question_text: string
  type: 'mcq' | 'truefalse' | 'codesnippet' | 'essay'
  options: { label: string; text: string }[]
  correct_option: string
  order_index: number
  code_snippet?: string
  code_language?: string
  points?: number
}

// eslint-disable-next-line react-refresh/only-export-components
export const qTypeColors: Record<string, { bg: string; color: string; label: string }> = {
  mcq:         { bg: '#E6F1FB', color: '#185FA5', label: 'MCQ' },
  truefalse:   { bg: '#EEEDFE', color: '#3C3489', label: 'True/False' },
  codesnippet: { bg: '#E1F5EE', color: '#0F6E56', label: 'Code Snippet' },
  essay:       { bg: '#FEF3CD', color: '#7A4F00', label: 'Essay' },
}

interface DraftQuestionEditorProps {
  question: DraftQuestion
  index: number
  onUpdate: (field: string, value: string) => void
  onUpdateOption: (optionIndex: number, value: string) => void
  onRemove: () => void
}

export function DraftQuestionEditor({ question: q, index: i, onUpdate, onUpdateOption, onRemove }: DraftQuestionEditorProps) {
  const tc = qTypeColors[q.type]
  return (
    <div style={{ background: '#F1EFE8', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Q{i + 1}</span>
          <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px', background: tc.bg, color: tc.color }}>
            {tc.label}
          </span>
        </div>
        <Button variant="danger" onClick={onRemove} style={{ fontSize: '11px', padding: '2px 8px' }}>Remove</Button>
      </div>

      <input value={q.question_text} onChange={e => onUpdate('question_text', e.target.value)}
        placeholder="Question text" style={{ ...formInputStyle, background: '#fff' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: '#888' }}>Points:</span>
        <input type="number" min="1" value={q.points ?? 1}
          onChange={e => onUpdate('points', e.target.value)}
          style={{ ...formInputStyle, marginBottom: 0, width: '60px' }} />
      </div>

      {q.type === 'codesnippet' && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Language:</span>
            <select value={q.code_language || 'python'} onChange={e => onUpdate('code_language', e.target.value)}
              style={{ ...formInputStyle, marginBottom: 0, width: 'auto', fontSize: '12px' }}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="sql">SQL</option>
            </select>
          </div>
          <textarea value={q.code_snippet || ''} onChange={e => onUpdate('code_snippet', e.target.value)}
            placeholder="Paste code snippet here..." rows={5}
            style={{ width: '100%', padding: '10px', fontSize: '12px', fontFamily: 'monospace',
              background: '#1e1e2e', color: '#cdd6f4', border: 'none', borderRadius: '8px',
              outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }} />
        </div>
      )}

      {q.type === 'essay' ? (
        <div style={{
          padding: '10px 12px', borderRadius: '8px', background: '#fff',
          border: '0.5px solid rgba(0,0,0,0.1)', fontSize: '12px', color: '#aaa', fontStyle: 'italic',
        }}>
          Students will type their essay answer here. Manually graded by faculty.
        </div>
      ) : q.type === 'truefalse' ? (
        q.options.map(opt => (
          <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <input type="radio" name={`correct-${i}`} checked={q.correct_option === opt.label}
              onChange={() => onUpdate('correct_option', opt.label)} />
            <span style={{ fontSize: '13px' }}>{opt.text}</span>
            {q.correct_option === opt.label && <span style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500 }}>✓ Correct</span>}
          </div>
        ))
      ) : (
        q.options.map((opt, j) => (
          <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <input type="radio" name={`correct-${i}`} checked={q.correct_option === opt.label}
              onChange={() => onUpdate('correct_option', opt.label)} />
            <span style={{ fontSize: '12px', fontWeight: 500, minWidth: '20px' }}>{opt.label.toUpperCase()}.</span>
            <input value={opt.text} onChange={e => onUpdateOption(j, e.target.value)}
              placeholder={`Option ${opt.label.toUpperCase()}`}
              style={{ ...inputStyle, padding: '7px 11px', borderRadius: '8px', flex: 1, background: '#fff' }} />
            {q.correct_option === opt.label && <span style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500, whiteSpace: 'nowrap' }}>✓ Correct</span>}
          </div>
        ))
      )}
    </div>
  )
}
