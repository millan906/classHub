import { describe, it, expect } from 'vitest'
import { scoreBarColor } from '../scoreColors'

describe('scoreBarColor', () => {
  it('returns grey for null', () => {
    expect(scoreBarColor(null)).toBe('#E5E5E5')
  })

  it('returns grey for undefined', () => {
    expect(scoreBarColor(undefined)).toBe('#E5E5E5')
  })

  it('returns green for 75 and above', () => {
    expect(scoreBarColor(75)).toBe('#1D9E75')
    expect(scoreBarColor(100)).toBe('#1D9E75')
    expect(scoreBarColor(90)).toBe('#1D9E75')
  })

  it('returns amber for 50–74', () => {
    expect(scoreBarColor(50)).toBe('#F59E0B')
    expect(scoreBarColor(74)).toBe('#F59E0B')
    expect(scoreBarColor(60)).toBe('#F59E0B')
  })

  it('returns red for below 50', () => {
    expect(scoreBarColor(0)).toBe('#EF4444')
    expect(scoreBarColor(49)).toBe('#EF4444')
    expect(scoreBarColor(25)).toBe('#EF4444')
  })
})
