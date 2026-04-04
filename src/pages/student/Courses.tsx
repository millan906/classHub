import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'

export default function StudentCourses() {
  const { profile } = useAuth()
  const { courses } = useCourses()
  const { enrolledCourseIds, loading } = useMyEnrollments(profile?.id ?? null)

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  if (loading) return null

  return (
    <div>
      <PageHeader title="My Courses" subtitle="Courses you've been enrolled in." />

      {enrolledCourses.length === 0 ? (
        <div style={{
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: '12px', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>No courses yet</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor will enroll you in a course.</div>
        </div>
      ) : (
        enrolledCourses.map(course => (
          <div key={course.id} style={{
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: '#E1F5EE', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '18px', flexShrink: 0,
            }}>
              🏫
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{course.name}</div>
              {course.section && (
                <div style={{ fontSize: '12px', color: '#888' }}>Section {course.section}</div>
              )}
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 500, padding: '3px 10px',
              borderRadius: '999px',
              background: course.status === 'open' ? '#E1F5EE' : '#F1EFE8',
              color: course.status === 'open' ? '#0F6E56' : '#888',
            }}>
              {course.status === 'open' ? 'Open' : 'Closed'}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
