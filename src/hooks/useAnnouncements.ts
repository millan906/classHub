import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Announcement } from '../types'

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAnnouncements() }, [])

  async function fetchAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data || [])
    setLoading(false)
  }

  async function postAnnouncement(title: string, body: string, userId: string, courseId: string | null) {
    await supabase.from('announcements').insert({ title, body, posted_by: userId, course_id: courseId })
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
