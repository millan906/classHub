import { describe, it, expect } from 'vitest'
import { computeWeightedGrade } from '../gradeCalculations'
import type { GradeGroup, GradeColumn } from '../../hooks/useGradeBook'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const quizzesGroup: GradeGroup = {
  id: 'g-quiz', name: 'Quizzes', weight_percent: 40,
  created_by: 'fac1', created_at: '',
}

const labGroup: GradeGroup = {
  id: 'g-lab', name: 'Laboratory', weight_percent: 60,
  created_by: 'fac1', created_at: '',
}

function makeCol(id: string, groupId: string, maxScore: number): GradeColumn {
  return {
    id, title: id, category: null, max_score: maxScore,
    group_id: groupId, entry_type: 'manual', linked_quiz_id: null,
    description: null, created_by: 'fac1', created_at: '',
  }
}

const quizCol = makeCol('col-q1', 'g-quiz', 100)
const labCol  = makeCol('col-lab', 'g-lab', 50)

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeWeightedGrade', () => {
  it('returns null when student has no scores at all', () => {
    const result = computeWeightedGrade('stu1', [quizzesGroup, labGroup], [quizCol, labCol], () => null)
    expect(result).toBeNull()
  })

  it('computes quiz-only grade correctly', () => {
    // student earned 80/100 on quiz → 80% × 40% weight = 32
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup], [quizCol],
      (_sid, col) => col.id === 'col-q1' ? 80 : null,
    )
    expect(result).toBe(32)
  })

  it('computes manual-column-only grade correctly', () => {
    // student earned 40/50 on lab → 80% × 60% weight = 48
    const result = computeWeightedGrade(
      'stu1', [labGroup], [labCol],
      (_sid, col) => col.id === 'col-lab' ? 40 : null,
    )
    expect(result).toBe(48)
  })

  it('computes combined weighted grade correctly', () => {
    // quiz: 80/100 = 80% × 40 = 32
    // lab:  40/50  = 80% × 60 = 48
    // total = 80
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup, labGroup], [quizCol, labCol],
      (_sid, col) => col.id === 'col-q1' ? 80 : col.id === 'col-lab' ? 40 : null,
    )
    expect(result).toBe(80)
  })

  it('averages across multiple columns in the same group', () => {
    // q1: 60/100, q2: 80/100 → total earned 140/200 = 70% × 40 = 28
    const q2Col = makeCol('col-q2', 'g-quiz', 100)
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup], [quizCol, q2Col],
      (_sid, col) => col.id === 'col-q1' ? 60 : col.id === 'col-q2' ? 80 : null,
    )
    expect(result).toBe(28)
  })

  it('ignores a group that has no columns', () => {
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup, labGroup], [labCol],
      (_sid, col) => col.id === 'col-lab' ? 50 : null,
    )
    // lab: 50/50 = 100% × 60 = 60
    expect(result).toBe(60)
  })

  it('ignores a group if no scores are present for it', () => {
    // quiz has scores, lab has none → only quiz contributes
    // quiz: 80/100 = 80% × 40 = 32
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup, labGroup], [quizCol, labCol],
      (_sid, col) => col.id === 'col-q1' ? 80 : null,
    )
    expect(result).toBe(32)
  })

  it('rounds result to nearest integer', () => {
    // 1/3 = 33.33% × 40 = 13.33 → rounds to 13
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup], [quizCol],
      () => 33,  // 33/100
    )
    expect(result).toBe(13)
  })
})
