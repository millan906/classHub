export function percentageToGWA(pct: number): string {
  if (pct >= 95) return '1.0'
  if (pct >= 94) return '1.1'
  if (pct >= 93) return '1.2'
  if (pct >= 92) return '1.3'
  if (pct >= 91) return '1.4'
  if (pct >= 90) return '1.5'
  if (pct >= 89) return '1.6'
  if (pct >= 88) return '1.7'
  if (pct >= 87) return '1.8'
  if (pct >= 86) return '1.9'
  if (pct >= 85) return '2.0'
  if (pct >= 84) return '2.1'
  if (pct >= 83) return '2.2'
  if (pct >= 82) return '2.3'
  if (pct >= 81) return '2.4'
  if (pct >= 80) return '2.5'
  if (pct >= 79) return '2.6'
  if (pct >= 78) return '2.7'
  if (pct >= 77) return '2.8'
  if (pct >= 76) return '2.9'
  if (pct >= 75) return '3.0'
  return '5.0'
}

export function gwaColor(gwa: string): string {
  if (gwa === '5.0') return '#A32D2D'
  const val = parseFloat(gwa)
  if (val <= 1.5) return '#0F6E56'
  if (val <= 2.0) return '#1D9E75'
  if (val <= 2.5) return '#185FA5'
  if (val <= 3.0) return '#C87000'
  return '#A32D2D'
}
