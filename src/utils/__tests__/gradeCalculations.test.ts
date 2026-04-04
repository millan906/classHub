import { describe, it, expect } from 'vitest'
import { computeWeightedGrade } from '../gradeCalculations'
import type { GradeGroup, GradeColumn } from '../../hooks/useGradeBook'
import type { Quiz } from '../../types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const quizzesGroup: GradeGroup = {
  id: 'g-quiz', name: 'Quizzes', weight_percent: 40,
  created_by: 'fac1', created_at: '',
}

const manualGroup: GradeGroup = {
  id: 'g-lab', name: 'Laboratory', weight_percent: 60,
  created_by: 'fac1', created_at: '',
}

const quiz1: Quiz = { id: 'q1', title: 'Quiz 1' } as Quiz
const quiz2: Quiz = { id: 'q2', title: 'Quiz 2' } as Quiz

const labCol: GradeColumn = {
  id: 'col-lab', title: 'Lab 1', category: null, max_score: 50,
  group_id: 'g-lab', entry_type: 'manual', linked_quiz_id: null,
  description: null, created_by: 'fac1', created_at: '',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeWeightedGrade', () => {
  it('returns null when student has no scores at all', () => {
    const result = computeWeightedGrade(
      'stu1', quizzesGroup, [quiz1], [manualGroup], [labCol],
      () => null, () => null,
    )
    expect(result).toBeNull()
  })

  it('computes quiz-only grade correctly', () => {
    // student earned 80/100 on quiz → 80% × 40% weight = 32
    const result = computeWeightedGrade(
      'stu1', quizzesGroup, [quiz1], [], [],
      (_sid, qid) => qid === 'q1' ? { earned: 80, total: 100 } : null,
      () => null,
    )
    expect(result).toBe(32)
  })

  it('computes manual-column-only grade correctly', () => {
    // student earned 40/50 on lab → 80% × 60% weight = 48
    const result = computeWeightedGrade(
      'stu1', undefined, [], [manualGroup], [labCol],
      () => null,
      (_sid, col) => col.id === 'col-lab' ? 40 : null,
    )
    expect(result).toBe(48)
  })

  it('computes combined weighted grade correctly', () => {
    // quiz: 80/100 = 80% × 40 = 32
    // lab:  40/50  = 80% × 60 = 48
    // total = 80
    const result = computeWeightedGrade(
      'stu1', quizzesGroup, [quiz1], [manualGroup], [labCol],
      (_sid, qid) => qid === 'q1' ? { earned: 80, total: 100 } : null,
      (_sid, col) => col.id === 'col-lab' ? 40 : null,
    )
    expect(result).toBe(80)
  })

  it('averages across multiple quizzes', () => {
    // q1: 60/100, q2: 80/100 → total earned 140/200 = 70% × 40 = 28
    const result = computeWeightedGrade(
      'stu1', quizzesGroup, [quiz1, quiz2], [], [],
      (_sid, qid) => {
        if (qid === 'q1') return { earned: 60, total: 100 }
        if (qid === 'q2') return { earned: 80, total: 100 }
        return null
      },
      () => null,
    )
    expect(result).toBe(28)
  })

  it('ignores quiz groups when quizzesGroup is undefined', () => {
    // No quiz group defined — quiz scores should not contribute
    const result = computeWeightedGrade(
      'stu1', undefined, [quiz1], [manualGroup], [labCol],
      () => ({ earned: 100, total: 100 }),
      (_sid, col) => col.id === 'col-lab' ? 50 : null,
    )
    // lab: 50/50 = 100% × 60 = 60
    expect(result).toBe(60)
  })

  it('ignores a group if no scores are present for it', () => {
    // quiz has scores, lab has none → only quiz contributes
    // quiz: 80/100 = 80% × 40 = 32
    const result = computeWeightedGrade(
      'stu1', quizzesGroup, [quiz1], [manualGroup], [labCol],
      () => ({ earned: 80, total: 100 }),
      () => null,
    )
    expect(result).toBe(32)
  })

  it('rounds result to nearest integer', () => {
    // quiz: 1/3 = 33.33% × 40 = 13.33 → rounds to 13
    const result = computeWeightedGrade(
      'stu1', quizzesGroup, [quiz1], [], [],
      () => ({ earned: 1, total: 3 }),
      () => null,
    )
    expect(result).toBe(13)
  })
})
