import type { GradeGroup, GradeColumn } from '../types'

/** Returns percentage score (0–100), safe for zero-total edge case. */
export function calcScore(earned: number, total: number): number {
  return total > 0 ? Math.round((earned / total) * 100) : 0
}

/**
 * Recovers earned points from a quiz submission record.
 * Prefers the stored `earned_points` field; falls back to deriving from the
 * percentage score when `earned_points` is absent (e.g. older submissions
 * that pre-date the column).
 */
export function extractEarned(
  earnedPoints: number | null | undefined,
  score: number,
  quizTotal: number,
): number {
  return earnedPoints ?? Math.round((score / 100) * quizTotal)
}

export function computeWeightedGrade(
  studentId: string,
  groups: GradeGroup[],
  columns: GradeColumn[],
  getColumnScore: (sid: string, col: GradeColumn) => number | null,
): number | null {
  let total = 0
  let hasAny = false

  for (const group of groups) {
    const cols = columns.filter(c => c.group_id === group.id)
    if (cols.length === 0) continue
    let earned = 0
    let possible = 0
    for (const col of cols) {
      const score = getColumnScore(studentId, col)
      if (score !== null) { earned += score; possible += col.max_score }
    }
    if (possible > 0) {
      total += (earned / possible) * group.weight_percent
      hasAny = true
    }
  }

  return hasAny ? Math.round(total) : null
}
