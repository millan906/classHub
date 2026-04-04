import { supabase } from '../lib/supabase'
import type { IntegrityLog } from '../types'

export function useIntegrityLogs() {
  async function logEvent(quizId: string, studentId: string, eventType: string, severity: 'low' | 'medium' | 'high') {
    await supabase.from('integrity_logs').insert({ quiz_id: quizId, student_id: studentId, event_type: eventType, severity })
  }

  async function fetchLogsForQuiz(quizId: string): Promise<IntegrityLog[]> {
    const { data } = await supabase
      .from('integrity_logs')
      .select('*')
      .eq('quiz_id', quizId)
      .order('occurred_at', { ascending: true })
    return data || []
  }

  return { logEvent, fetchLogsForQuiz }
}
