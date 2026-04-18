import { ATTENDANCE_CONSECUTIVE_THRESHOLD, ATTENDANCE_ACCUMULATED_THRESHOLD } from '../constants/attendance'
import type { AttendanceSession, AttendanceRecord } from '../types'

/**
 * Counts trailing consecutive absences from the most recent session backwards.
 * Sessions are sorted oldest-first; we reverse to walk newest-first.
 */
export function countConsecutiveAbsences(
  sessions: Pick<AttendanceSession, 'id' | 'date'>[],
  records: Pick<AttendanceRecord, 'session_id' | 'status'>[],
): number {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  let count = 0
  for (const s of sorted.reverse()) {
    const rec = records.find(r => r.session_id === s.id)
    if (rec?.status === 'absent') count++
    else break
  }
  return count
}

/**
 * Counts total absences across all given records.
 */
export function countTotalAbsences(
  records: Pick<AttendanceRecord, 'status'>[],
): number {
  return records.filter(r => r.status === 'absent').length
}

/**
 * Returns true if the student meets either attendance flag threshold.
 */
export function isAttendanceFlagged(
  sessions: Pick<AttendanceSession, 'id' | 'date'>[],
  records: Pick<AttendanceRecord, 'session_id' | 'status'>[],
): boolean {
  return (
    countConsecutiveAbsences(sessions, records) >= ATTENDANCE_CONSECUTIVE_THRESHOLD ||
    countTotalAbsences(records) >= ATTENDANCE_ACCUMULATED_THRESHOLD
  )
}
