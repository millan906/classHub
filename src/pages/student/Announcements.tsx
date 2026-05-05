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
  const { announcements, loading, loadingMore, hasMore, loadMore } = useAnnouncements(institution?.id)
  const { courses } = useCourses()
  const { enrolledCourseIds, loading: enrollLoading } = useMyEnrollments(profile?.id ?? null)

  const visibleAnnouncements = announcements.filter(a =>
    a.course_id == null || enrolledCourseIds.includes(a.course_id)
  )

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Stay up to date with class updates." />
      {loading || enrollLoading
        ? null
        : visibleAnnouncements.length === 0
          ? <div style={{ fontSize: '13px', color: '#888' }}>No announcements yet.</div>
          : visibleAnnouncements.map(a => <AnnouncementCard key={a.id} ann={a} courses={courses} />)
      }
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button onClick={loadMore} disabled={loadingMore} style={{
            fontSize: '13px', padding: '7px 20px', borderRadius: '8px',
            border: '0.5px solid rgba(0,0,0,0.25)', background: 'transparent',
            cursor: loadingMore ? 'default' : 'pointer', opacity: loadingMore ? 0.5 : 1,
            fontFamily: 'Inter, sans-serif',
          }}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
