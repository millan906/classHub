import { describe, it, expect } from 'vitest'
import {
  countConsecutiveAbsences,
  countTotalAbsences,
  isAttendanceFlagged,
} from '../attendanceFlags'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function session(id: string, date: string) { return { id, date } }
function record(session_id: string, status: 'present' | 'late' | 'absent' | 'excused') {
  return { session_id, status }
}

// ─── countConsecutiveAbsences ─────────────────────────────────────────────────

describe('countConsecutiveAbsences', () => {
  it('returns 0 when there are no sessions', () => {
    expect(countConsecutiveAbsences([], [])).toBe(0)
  })

  it('returns 0 when the latest session is present', () => {
    const sessions = [session('s1', '2025-01-01'), session('s2', '2025-01-02')]
    const records = [record('s1', 'absent'), record('s2', 'present')]
    expect(countConsecutiveAbsences(sessions, records)).toBe(0)
  })

  it('counts 1 trailing absence', () => {
    const sessions = [session('s1', '2025-01-01'), session('s2', '2025-01-02')]
    const records = [record('s1', 'present'), record('s2', 'absent')]
    expect(countConsecutiveAbsences(sessions, records)).toBe(1)
  })

  it('counts 3 consecutive trailing absences', () => {
    const sessions = [
      session('s1', '2025-01-01'),
      session('s2', '2025-01-02'),
      session('s3', '2025-01-03'),
    ]
    const records = [
      record('s1', 'absent'),
      record('s2', 'absent'),
      record('s3', 'absent'),
    ]
    expect(countConsecutiveAbsences(sessions, records)).toBe(3)
  })

  it('stops counting at the first non-absent session', () => {
    const sessions = [
      session('s1', '2025-01-01'),
      session('s2', '2025-01-02'),
      session('s3', '2025-01-03'),
      session('s4', '2025-01-04'),
    ]
    const records = [
      record('s1', 'absent'),
      record('s2', 'present'),
      record('s3', 'absent'),
      record('s4', 'absent'),
    ]
    expect(countConsecutiveAbsences(sessions, records)).toBe(2)
  })

  it('treats unrecorded sessions (no record) as breaking the streak', () => {
    const sessions = [session('s1', '2025-01-01'), session('s2', '2025-01-02')]
    const records = [record('s1', 'absent')] // s2 has no record
    expect(countConsecutiveAbsences(sessions, records)).toBe(0)
  })

  it('handles sessions provided in unsorted order', () => {
    const sessions = [
      session('s3', '2025-01-03'),
      session('s1', '2025-01-01'),
      session('s2', '2025-01-02'),
    ]
    const records = [
      record('s1', 'present'),
      record('s2', 'absent'),
      record('s3', 'absent'),
    ]
    expect(countConsecutiveAbsences(sessions, records)).toBe(2)
  })
})

// ─── countTotalAbsences ───────────────────────────────────────────────────────

describe('countTotalAbsences', () => {
  it('returns 0 for no records', () => {
    expect(countTotalAbsences([])).toBe(0)
  })

  it('counts only absent records', () => {
    const records = [
      record('s1', 'present'),
      record('s2', 'absent'),
      record('s3', 'late'),
      record('s4', 'absent'),
      record('s5', 'excused'),
    ]
    expect(countTotalAbsences(records)).toBe(2)
  })

  it('returns 0 when all records are present', () => {
    const records = [record('s1', 'present'), record('s2', 'present')]
    expect(countTotalAbsences(records)).toBe(0)
  })
})

// ─── isAttendanceFlagged ──────────────────────────────────────────────────────

describe('isAttendanceFlagged', () => {
  it('returns false when thresholds are not met', () => {
    const sessions = [session('s1', '2025-01-01'), session('s2', '2025-01-02')]
    const records = [record('s1', 'present'), record('s2', 'absent')]
    expect(isAttendanceFlagged(sessions, records)).toBe(false)
  })

  it('returns true when consecutive threshold (3) is met', () => {
    const sessions = [
      session('s1', '2025-01-01'),
      session('s2', '2025-01-02'),
      session('s3', '2025-01-03'),
    ]
    const records = [
      record('s1', 'absent'),
      record('s2', 'absent'),
      record('s3', 'absent'),
    ]
    expect(isAttendanceFlagged(sessions, records)).toBe(true)
  })

  it('returns true when accumulated threshold (5) is met', () => {
    const sessions = Array.from({ length: 6 }, (_, i) => session(`s${i}`, `2025-01-0${i + 1}`))
    const records = [
      record('s0', 'present'),
      record('s1', 'absent'),
      record('s2', 'absent'),
      record('s3', 'present'),
      record('s4', 'absent'),
      record('s5', 'absent'),
    ]
    // Only 4 absences — not flagged
    expect(isAttendanceFlagged(sessions, records)).toBe(false)

    // Add one more absence
    records.push(record('s0', 'absent'))
    expect(isAttendanceFlagged(sessions, [...records.slice(1), record('s0', 'absent')])).toBe(true)
  })
})
