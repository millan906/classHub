import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Announcement } from '../types'

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAnnouncements()
    const channel = supabase
      .channel('announcements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function postAnnouncement(title: string, body: string, userId: string, courseId: string | null) {
    const { data } = await supabase
      .from('announcements')
      .insert({ title, body, posted_by: userId, course_id: courseId })
      .select()
      .single()

    // Fire-and-forget — email failure never blocks the UI
    if (data) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-announcement-email`
        fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ announcement: data }),
        }).catch(err => console.error('[Email] Failed to send announcement email:', err))
      })
    }

    await fetchAnnouncements()
  }

  async function updateAnnouncement(id: string, title: string, body: string, courseId: string | null) {
    await supabase.from('announcements').update({ title, body, course_id: courseId }).eq('id', id)
    await fetchAnnouncements()
  }

  async function deleteAnnouncement(id: string) {
    await supabase.from('announcements').delete().eq('id', id)
    await fetchAnnouncements()
  }

  return { announcements, loading, postAnnouncement, updateAnnouncement, deleteAnnouncement }
}
