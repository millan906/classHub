import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Slide } from '../types'

export function useSlides() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSlides() }, [])

  async function fetchSlides() {
    const { data } = await supabase.from('slides').select('*').order('created_at', { ascending: false })
    setSlides(data || [])
    setLoading(false)
  }

  async function uploadSlide(file: File, title: string, userId: string, courseId: string | null = null) {
    const filePath = `${userId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('slides').upload(filePath, file)
    if (uploadError) throw uploadError

    const fileSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2))
    const { error } = await supabase.from('slides').insert({
      title,
      file_path: filePath,
      file_size_mb: fileSizeMb,
      slide_count: null,
      uploaded_by: userId,
      course_id: courseId,
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

  return { slides, loading, uploadSlide, deleteSlide, getDownloadUrl, refetch: fetchSlides }
}
