import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../utils/withTimeout'
import type { Slide } from '../types'

export function useSlides(institutionId?: string | null) {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSlides()
    const channel = supabase
      .channel(`slides-changes-${institutionId ?? 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slides' }, fetchSlides)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [institutionId])

  async function fetchSlides() {
    try {
      setError(null)
      let query = supabase.from('slides').select('*').order('created_at', { ascending: false })
      if (institutionId) query = query.eq('institution_id', institutionId) as typeof query
      const { data, error: err } = await query
      if (err) throw err
      setSlides(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load slides')
    } finally {
      setLoading(false)
    }
  }

  async function uploadSlide(file: File, title: string, userId: string, courseId: string | null = null) {
    const ext = file.name.split('.').pop()
    const filePath = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await withTimeout(60_000, supabase.storage.from('slides').upload(filePath, file))
    if (uploadError) throw uploadError

    const fileSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2))
    const { error } = await supabase.from('slides').insert({
      title,
      file_path: filePath,
      file_size_mb: fileSizeMb,
      slide_count: null,
      uploaded_by: userId,
      course_id: courseId,
      institution_id: institutionId ?? null,
    })
    if (error) throw error
    await fetchSlides()
  }

  async function deleteSlide(slide: Slide) {
    await supabase.storage.from('slides').remove([slide.file_path])
    await supabase.from('slides').delete().eq('id', slide.id)
    await fetchSlides()
  }

  async function getDownloadUrl(filePath: string) {
    const { data } = supabase.storage.from('slides').getPublicUrl(filePath)
    return data.publicUrl
  }

  return { slides, loading, error, uploadSlide, deleteSlide, getDownloadUrl, refetch: fetchSlides }
}
