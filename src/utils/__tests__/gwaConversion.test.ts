import { describe, it, expect } from 'vitest'
import { percentageToGWA, gwaColor } from '../gwaConversion'

// ─── percentageToGWA ──────────────────────────────────────────────────────────

describe('percentageToGWA', () => {
  it('returns 1.0 for 95 and above', () => {
    expect(percentageToGWA(95)).toBe('1.0')
    expect(percentageToGWA(100)).toBe('1.0')
    expect(percentageToGWA(99)).toBe('1.0')
  })

  it('maps each 1-point band correctly from 94 down to 75', () => {
    const expected: [number, string][] = [
      [94, '1.1'], [93, '1.2'], [92, '1.3'], [91, '1.4'],
      [90, '1.5'], [89, '1.6'], [88, '1.7'], [87, '1.8'],
      [86, '1.9'], [85, '2.0'], [84, '2.1'], [83, '2.2'],
      [82, '2.3'], [81, '2.4'], [80, '2.5'], [79, '2.6'],
      [78, '2.7'], [77, '2.8'], [76, '2.9'], [75, '3.0'],
    ]
    for (const [pct, gwa] of expected) {
      expect(percentageToGWA(pct)).toBe(gwa)
    }
  })

  it('returns 5.0 for below 75', () => {
    expect(percentageToGWA(74)).toBe('5.0')
    expect(percentageToGWA(0)).toBe('5.0')
    expect(percentageToGWA(50)).toBe('5.0')
  })
})

// ─── gwaColor ─────────────────────────────────────────────────────────────────

describe('gwaColor', () => {
  it('returns red for 5.0 (failing)', () => {
    expect(gwaColor('5.0')).toBe('#A32D2D')
  })

  it('returns dark green for 1.0–1.5 (excellent)', () => {
    expect(gwaColor('1.0')).toBe('#0F6E56')
    expect(gwaColor('1.5')).toBe('#0F6E56')
  })

  it('returns light green for 1.6–2.0 (very good)', () => {
    expect(gwaColor('1.6')).toBe('#1D9E75')
    expect(gwaColor('2.0')).toBe('#1D9E75')
  })

  it('returns blue for 2.1–2.5 (good)', () => {
    expect(gwaColor('2.1')).toBe('#185FA5')
    expect(gwaColor('2.5')).toBe('#185FA5')
  })

  it('returns amber for 2.6–3.0 (satisfactory)', () => {
    expect(gwaColor('2.6')).toBe('#C87000')
    expect(gwaColor('3.0')).toBe('#C87000')
  })
})
