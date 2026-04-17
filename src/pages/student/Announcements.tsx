import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { AnnouncementCard } from '../../components/announcements/AnnouncementCard'

export default function StudentAnnouncements() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const { announcements } = useAnnouncements(institution?.id)
  const { courses } = useCourses()
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)

  const visibleAnnouncements = announcements.filter(a =>
    a.course_id == null || enrolledCourseIds.includes(a.course_id)
  )

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Stay up to date with class updates." />
      {visibleAnnouncements.length === 0
        ? <div style={{ fontSize: '13px', color: '#888' }}>No announcements yet.</div>
        : visibleAnnouncements.map(a => <AnnouncementCard key={a.id} ann={a} courses={courses} />)
      }
    </div>
  )
}
