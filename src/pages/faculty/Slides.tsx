import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSlides } from '../../hooks/useSlides'
import { useCourses } from '../../hooks/useCourses'
import { PageHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { UploadZone } from '../../components/slides/UploadZone'
import { SlideGrid } from '../../components/slides/SlideGrid'
import type { Slide } from '../../types'

export default function FacultySlides() {
  const { profile } = useAuth()
  const { slides, uploadSlide, deleteSlide, getDownloadUrl } = useSlides()
  const { courses } = useCourses()
  const [confirmDelete, setConfirmDelete] = useState<Slide | null>(null)

  async function handleUpload(file: File, title: string, courseId: string | null) {
    if (!profile) return
    await uploadSlide(file, title, profile.id, courseId)
  }

  async function handleView(slide: Slide) {
    const url = await getDownloadUrl(slide.file_path)
    window.open(url, '_blank')
  }

  async function handleDownload(slide: Slide) {
    const url = await getDownloadUrl(slide.file_path)
    const a = document.createElement('a')
    a.href = url; a.download = slide.title; a.click()
  }

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete slide"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={async () => { await deleteSlide(confirmDelete); setConfirmDelete(null) }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <PageHeader title="Slides" subtitle="Upload and manage course materials." />
      <UploadZone courses={courses} onUpload={handleUpload} />
      <SlideGrid slides={slides} courses={courses} isFaculty onDelete={setConfirmDelete} onView={handleView} onDownload={handleDownload} />
    </div>
  )
}
