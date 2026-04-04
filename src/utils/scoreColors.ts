/** Returns a color for a percentage score. Null/undefined → grey. */
export function scoreBarColor(pct: number | null | undefined): string {
  if (pct == null) return '#E5E5E5'
  if (pct >= 75) return '#1D9E75'
  if (pct >= 50) return '#F59E0B'
  return '#EF4444'
}
