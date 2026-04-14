import type { GradeGroup, GradeColumn } from '../hooks/useGradeBook'

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
