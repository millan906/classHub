import { describe, it, expect } from 'vitest'
import { calcScore, computeWeightedGrade } from '../gradeCalculations'
import type { GradeGroup, GradeColumn } from '../../types'

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

// ─── calcScore ────────────────────────────────────────────────────────────────

describe('calcScore', () => {
  it('returns correct percentage', () => {
    expect(calcScore(80, 100)).toBe(80)
    expect(calcScore(45, 50)).toBe(90)
  })

  it('rounds to nearest integer', () => {
    expect(calcScore(1, 3)).toBe(33) // 33.33...
    expect(calcScore(2, 3)).toBe(67) // 66.66...
  })

  it('returns 0 when total is 0 (no division by zero)', () => {
    expect(calcScore(0, 0)).toBe(0)
    expect(calcScore(10, 0)).toBe(0)
  })

  it('returns 0 for zero earned', () => {
    expect(calcScore(0, 100)).toBe(0)
  })

  it('handles perfect score', () => {
    expect(calcScore(100, 100)).toBe(100)
  })
})

// ─── computeWeightedGrade ─────────────────────────────────────────────────────

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
    // quiz: 80/100 = 80% × 40 = 32 · lab: 40/50 = 80% × 60 = 48 · total = 80
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
    // lab: 50/50 = 100% × 60 = 60
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup, labGroup], [labCol],
      (_sid, col) => col.id === 'col-lab' ? 50 : null,
    )
    expect(result).toBe(60)
  })

  it('ignores a group if no scores are present for it', () => {
    // quiz: 80/100 = 80% × 40 = 32; lab has no scores → not counted
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup, labGroup], [quizCol, labCol],
      (_sid, col) => col.id === 'col-q1' ? 80 : null,
    )
    expect(result).toBe(32)
  })

  it('rounds result to nearest integer', () => {
    // 33/100 = 33% × 40 = 13.2 → rounds to 13
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup], [quizCol],
      () => 33,
    )
    expect(result).toBe(13)
  })

  it('handles zero score (0 earned) without returning null', () => {
    // Student scored 0 — has an entry, should return 0 not null
    const result = computeWeightedGrade(
      'stu1', [quizzesGroup], [quizCol],
      () => 0,
    )
    // 0/100 × 40 = 0 — but possible = 100 > 0, so hasAny = true
    expect(result).toBe(0)
  })
})
