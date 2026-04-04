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

  const visibleSlides = slides.filter(s =>
    s.course_id == null || enrolledCourseIds.includes(s.course_id)
  )

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
      <SlideGrid slides={visibleSlides} courses={courses} onView={handleView} onDownload={handleDownload} />
    </div>
  )
}
