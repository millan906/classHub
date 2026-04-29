import { useState } from 'react'
import { viewFile } from '../../utils/viewFile'
import { downloadFile } from '../../utils/downloadFile'
import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useSlides } from '../../hooks/useSlides'
import { useCourses } from '../../hooks/useCourses'
import { PageHeader } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner, PageError } from '../../components/ui/Spinner'
import { UploadZone } from '../../components/slides/UploadZone'
import { SlideGrid } from '../../components/slides/SlideGrid'
import type { Slide } from '../../types'

export default function FacultySlides() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { slides, loading, error, uploadSlide, deleteSlide, getDownloadUrl, refetch } = useSlides(institution?.id)
  const { courses } = useCourses(null, profile?.id)
  const [confirmDelete, setConfirmDelete] = useState<Slide | null>(null)
  const [pageError, setPageError] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  async function handleUpload(file: File, title: string, courseId: string | null) {
    if (!profile) return
    await uploadSlide(file, title, profile.id, courseId)
  }

  async function handleView(slide: Slide) {
    const url = await getDownloadUrl(slide.file_path)
    await viewFile(url)
  }

  async function handleDownload(slide: Slide) {
    const url = await getDownloadUrl(slide.file_path)
    await downloadFile(url, slide.title)
  }

  const filteredSlides = selectedCourseId
    ? slides.filter(s => s.course_id === selectedCourseId)
    : slides

  if (loading) return <Spinner />
  if (error) return <PageError message={error} onRetry={refetch} />

  return (
    <div>
      {confirmDelete && (
        <ConfirmDialog
          title="Delete slide"
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={async () => {
            try { await deleteSlide(confirmDelete); setConfirmDelete(null) }
            catch (err: unknown) { setPageError(err instanceof Error ? err.message : 'Failed to delete slide') }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      <PageHeader title="Slides" subtitle="Upload and manage course materials." />
      {pageError && (
        <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' }}>
          {pageError} <button onClick={() => setPageError('')} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontWeight: 600 }}>✕</button>
        </div>
      )}
      <UploadZone courses={courses} onUpload={handleUpload} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <select
          value={selectedCourseId}
          onChange={e => setSelectedCourseId(e.target.value)}
          style={{
            padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
            border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
            fontFamily: 'Inter, sans-serif', outline: 'none', minWidth: '200px',
          }}
        >
          <option value="">All courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.section ? ` · Section ${c.section}` : ''}
            </option>
          ))}
        </select>
      </div>
      <SlideGrid slides={filteredSlides} isFaculty onDelete={setConfirmDelete} onView={handleView} onDownload={handleDownload} />
    </div>
  )
}
