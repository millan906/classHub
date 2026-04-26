import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Announcement } from '../types'

export function useAnnouncements(institutionId?: string | null) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAnnouncements() {
    let query = supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (institutionId) query = query.eq('institution_id', institutionId) as typeof query
    const { data } = await query
    setAnnouncements(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAnnouncements()
    const channel = supabase
      .channel(`announcements-changes-${institutionId ?? 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const a = payload.new as Announcement & { institution_id?: string }
        if (institutionId && a.institution_id !== institutionId) return
        setAnnouncements(prev => [a as Announcement, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements' }, (payload) => {
        const a = payload.new as Announcement
        setAnnouncements(prev => prev.map(x => x.id === a.id ? a : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (payload) => {
        setAnnouncements(prev => prev.filter(a => a.id !== (payload.old as { id: string }).id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [institutionId])

  async function postAnnouncement(title: string, body: string, userId: string, courseId: string | null) {
    const { data: { session } } = await supabase.auth.getSession()

    const { data } = await supabase
      .from('announcements')
      .insert({ title, body, posted_by: userId, course_id: courseId, institution_id: institutionId ?? null })
      .select()
      .single()

    if (data) setAnnouncements(prev => [data as Announcement, ...prev])

    // Fire-and-forget — email failure never blocks the UI
    if (data && session) {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-announcement-email`
      fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ announcement: data }),
      }).then(r => r.json()).then(result => {
        if (result.failed > 0) console.error('[Email] Resend errors:', result.errors)
      }).catch(err => console.error('[Email] Failed to send announcement email:', err))
    }
  }

  async function updateAnnouncement(id: string, title: string, body: string, courseId: string | null) {
    const { data, error } = await supabase
      .from('announcements')
      .update({ title, body, course_id: courseId })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (data) setAnnouncements(prev => prev.map(a => a.id === id ? data as Announcement : a))
  }

  async function deleteAnnouncement(id: string) {
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  return { announcements, loading, postAnnouncement, updateAnnouncement, deleteAnnouncement }
}
