import { describe, it, expect } from 'vitest'
import { calcScore, extractEarned, computeWeightedGrade } from '../gradeCalculations'
import type { GradeGroup, GradeColumn } from '../../types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeGroup(id: string, weight: number): GradeGroup {
  return { id, name: id, weight_percent: weight, created_by: 'fac1', created_at: '' }
}

function makeCol(id: string, groupId: string, maxScore: number): GradeColumn {
  return {
    id, title: id, category: null, max_score: maxScore,
    group_id: groupId, entry_type: 'quiz_linked', linked_quiz_id: `quiz-${id}`,
    description: null, created_by: 'fac1', created_at: '',
  }
}

// ─── extractEarned ───────────────────────────────────────────────────────────

describe('extractEarned', () => {
  it('prefers earned_points when present', () => {
    expect(extractEarned(38, 80, 50)).toBe(38)
  })

  it('falls back to score-based calculation when earned_points is null', () => {
    // score 80% of 50-point quiz → 40
    expect(extractEarned(null, 80, 50)).toBe(40)
  })

  it('falls back when earned_points is undefined', () => {
    expect(extractEarned(undefined, 60, 25)).toBe(15)
  })

  it('rounds the fallback result', () => {
    // score 33% of 10-point quiz → 3.3 → rounds to 3
    expect(extractEarned(null, 33, 10)).toBe(3)
    // score 67% of 3-point quiz → 2.01 → rounds to 2
    expect(extractEarned(null, 67, 3)).toBe(2)
  })

  it('returns 0 for zero score', () => {
    expect(extractEarned(null, 0, 100)).toBe(0)
    expect(extractEarned(0, 80, 100)).toBe(0)
  })

  it('handles perfect score fallback', () => {
    expect(extractEarned(null, 100, 40)).toBe(40)
  })
})

// ─── calcScore → extractEarned round-trip ────────────────────────────────────
//
// The critical invariant: earned_points stored at submission time must survive
// the grade-sync read-back without drift. Both paths should produce the same
// grade_entries.score value.

describe('submit → sync round-trip', () => {
  it('exact score round-trips without drift', () => {
    const earned = 38
    const total = 50
    const score = calcScore(earned, total)   // → 76

    // Grade sync: has earned_points (normal case)
    expect(extractEarned(earned, score, total)).toBe(earned)
  })

  it('fractional percent round-trips acceptably (≤1 point drift)', () => {
    // 1/3 = 33.33% → stored as 33. Reconstructed: round(33/100 * 3) = 1.
    const earned = 1
    const total = 3
    const score = calcScore(earned, total)   // → 33

    const reconstructed = extractEarned(null, score, total)
    expect(Math.abs(reconstructed - earned)).toBeLessThanOrEqual(1)
  })

  it('zero earned round-trips to zero', () => {
    const score = calcScore(0, 100)          // → 0
    expect(extractEarned(null, score, 100)).toBe(0)
    expect(extractEarned(0, score, 100)).toBe(0)
  })

  it('perfect score round-trips exactly', () => {
    const score = calcScore(100, 100)        // → 100
    expect(extractEarned(null, score, 100)).toBe(100)
    expect(extractEarned(100, score, 100)).toBe(100)
  })
})

// ─── Full pipeline: submit → sync → weighted grade ───────────────────────────
//
// Simulates: student submits quiz → GradeBook syncs score → weighted grade computed.

describe('full quiz-submit-to-weighted-grade pipeline', () => {
  const quizGroup = makeGroup('quizzes', 40)
  const labGroup  = makeGroup('lab', 60)
  const quizCol   = makeCol('q1', 'quizzes', 50)
  const labCol    = makeCol('lab1', 'lab', 100)

  it('quiz score flows through to correct weighted grade', () => {
    // Student earned 40/50 on quiz → calcScore → 80% → extractEarned → 40
    const earned = 40
    const total = 50
    const score = calcScore(earned, total)                // 80
    const synced = extractEarned(earned, score, total)    // 40 (from stored earned_points)

    const weighted = computeWeightedGrade(
      'stu1',
      [quizGroup],
      [quizCol],
      (_sid, col) => col.id === 'q1' ? synced : null,
    )
    // 40/50 = 80% × 40 weight = 32
    expect(weighted).toBe(32)
  })

  it('fallback path also produces correct weighted grade', () => {
    // Old submission has no earned_points — reconstructed from score
    const score = calcScore(40, 50)                      // 80
    const synced = extractEarned(null, score, 50)        // round(80/100 * 50) = 40

    const weighted = computeWeightedGrade(
      'stu1',
      [quizGroup],
      [quizCol],
      (_sid, col) => col.id === 'q1' ? synced : null,
    )
    expect(weighted).toBe(32)
  })

  it('combined quiz + lab produces correct final grade', () => {
    // Quiz: 40/50 = 80% × 40 = 32 · Lab: 75/100 = 75% × 60 = 45 · total = 77
    const quizEarned = extractEarned(40, calcScore(40, 50), 50)   // 40
    const labEarned  = extractEarned(75, calcScore(75, 100), 100) // 75

    const weighted = computeWeightedGrade(
      'stu1',
      [quizGroup, labGroup],
      [quizCol, labCol],
      (_sid, col) => col.id === 'q1' ? quizEarned : col.id === 'lab1' ? labEarned : null,
    )
    expect(weighted).toBe(77)
  })

  it('returns null when student has no quiz submissions', () => {
    const weighted = computeWeightedGrade(
      'stu1',
      [quizGroup, labGroup],
      [quizCol, labCol],
      () => null,
    )
    expect(weighted).toBeNull()
  })

  it('partial submissions — only quiz graded — still computes a grade', () => {
    // Only quiz scored; lab not yet graded. computeWeightedGrade ignores groups
    // where possible === 0, so result is quiz-only weighted.
    const quizEarned = extractEarned(25, calcScore(25, 50), 50) // 25
    const weighted = computeWeightedGrade(
      'stu1',
      [quizGroup, labGroup],
      [quizCol, labCol],
      (_sid, col) => col.id === 'q1' ? quizEarned : null,
    )
    // 25/50 = 50% × 40 = 20
    expect(weighted).toBe(20)
  })
})
