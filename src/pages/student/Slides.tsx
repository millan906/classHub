import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSlides } from '../../hooks/useSlides'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { SlideGrid } from '../../components/slides/SlideGrid'
import { Spinner, PageError } from '../../components/ui/Spinner'
import type { Slide } from '../../types'

export default function StudentSlides() {
  const { profile } = useAuth()
  const { slides, loading, error, getDownloadUrl, refetch } = useSlides()
  const { courses } = useCourses()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  const visibleSlides = slides.filter(s =>
    s.course_id != null && enrolledCourseIds.includes(s.course_id)
  )

  const filteredSlides = selectedCourseId
    ? visibleSlides.filter(s => s.course_id === selectedCourseId)
    : visibleSlides

  async function handleView(slide: Slide) {
    const url = await getDownloadUrl(slide.file_path)
    window.open(url, '_blank')
  }

  async function handleDownload(slide: Slide) {
    const url = await getDownloadUrl(slide.file_path)
    const a = document.createElement('a')
    a.href = url; a.download = slide.title; a.click()
  }

  if (loading) return <Spinner />
  if (error) return <PageError message={error} onRetry={refetch} />

  return (
    <div>
      <PageHeader title="Slides" subtitle="View and download course materials." />
      <div style={{ marginBottom: '12px' }}>
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
          {enrolledCourses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.section ? ` · Section ${c.section}` : ''}
            </option>
          ))}
        </select>
      </div>
      <SlideGrid slides={filteredSlides} onView={handleView} onDownload={handleDownload} />
    </div>
  )
}
