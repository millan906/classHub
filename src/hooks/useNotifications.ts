import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface AppNotification {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string
  related_id: string | null
  course_name: string | null
  read: boolean
  created_at: string
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function fetchNotifications() {
    if (!userId) return
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    const items = (data || []).filter((n: AppNotification) =>
      n.created_at >= cutoff || n.type === 'quiz_open' || n.type === 'quiz_reminder'
    )
    setNotifications(items)
    setUnreadCount(items.filter((n: AppNotification) => !n.read).length)
  }

  useEffect(() => {
    fetchNotifications()
    if (!userId) return
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, fetchNotifications)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function markAllRead() {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, markAllRead, refetch: fetchNotifications }
}

/** Fire-and-forget: sends a quiz-open email via the edge function. Never throws. */
export function fireQuizOpenEmail(accessToken: string, quizId: string, isPdf = false): void {
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-email`
  fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ type: 'quiz_open', quizId, isPdf }),
  })
    .then(r => r.json())
    .then(result => console.log('[Email] Quiz open result:', result))
    .catch(err => console.error('[Email] Quiz open notification failed:', err))
}

export async function sendNotificationsToStudents(
  studentIds: string[],
  title: string,
  body: string,
  type: string,
  relatedId?: string,
  courseName?: string,
) {
  if (studentIds.length === 0) return
  await supabase.from('notifications').insert(
    studentIds.map(userId => ({
      user_id: userId,
      title,
      body,
      type,
      related_id: relatedId ?? null,
      course_name: courseName ?? null,
    }))
  )
}
