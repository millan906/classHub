import type { GradeGroup, GradeColumn } from '../hooks/useGradeBook'
import type { Quiz } from '../types'

export function computeWeightedGrade(
  studentId: string,
  quizzesGroup: GradeGroup | undefined,
  regularQuizzes: Quiz[],
  manualGroups: GradeGroup[],
  manualCols: GradeColumn[],
  getQuizRaw: (sid: string, qid: string) => { earned: number; total: number } | null,
  getColumnScore: (sid: string, col: GradeColumn) => number | null,
): number | null {
  let total = 0
  let hasAny = false

  if (quizzesGroup && regularQuizzes.length > 0) {
    let earned = 0
    let possible = 0
    for (const q of regularQuizzes) {
      const raw = getQuizRaw(studentId, q.id)
      if (raw) { earned += raw.earned; possible += raw.total }
    }
    if (possible > 0) {
      total += (earned / possible) * quizzesGroup.weight_percent
      hasAny = true
    }
  }

  for (const group of manualGroups) {
    const cols = manualCols.filter(c => c.group_id === group.id)
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

