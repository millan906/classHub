import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import type { Course, CourseResource } from '../../types'

const SCHEDULE_TYPE_LABELS: Record<string, string> = { lecture: 'Lecture', lab: 'Lab', other: 'Other' }
const CAT_LABELS: Record<CourseResource['category'], string> = {
  book: '📚 Books', journal: '📰 Journal Readings', lab: '🧪 Lab Materials', other: '📎 Other',
}

function CourseDetail({ course, onBack, getResourceUrl }: {
  course: Course
  onBack: () => void
  getResourceUrl: (p: string) => string
}) {
  const schedule = course.schedule ?? []
  const topics = course.topics ?? []
  const grading = course.grading_system ?? []
  const resources = course.resources ?? []

  const byCategory = (cat: CourseResource['category']) => resources.filter(r => r.category === cat)

  return (
    <div>
      {/* Back + header */}
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#555', marginBottom: '12px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        ← Back to courses
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
          🏫
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{course.name}</div>
          {course.section && <div style={{ fontSize: '13px', color: '#888' }}>Section {course.section}</div>}
        </div>
        <span style={{
          marginLeft: 'auto', fontSize: '11px', fontWeight: 500, padding: '3px 12px', borderRadius: '999px',
          background: course.status === 'open' ? '#E1F5EE' : '#F1EFE8',
          color: course.status === 'open' ? '#0F6E56' : '#888',
        }}>
          {course.status === 'open' ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Schedule */}
      {schedule.length > 0 && (
        <Section title="Class Schedule">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {schedule.map(s => (
              <div key={s.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: s.type === 'lab' ? '#FEF3CD' : '#E6F1FB', color: s.type === 'lab' ? '#D4900A' : '#185FA5', flexShrink: 0 }}>
                  {SCHEDULE_TYPE_LABELS[s.type] ?? s.type}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.day}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{s.time}{s.room ? ` · ${s.room}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Topics */}
      {topics.length > 0 && (
        <Section title="Topics / Modules">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {topics.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 12px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1D9E75', minWidth: '20px', flexShrink: 0, marginTop: '1px' }}>{i + 1}.</span>
                <span style={{ fontSize: '13px', color: '#333' }}>{t}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Resources by category */}
      {resources.length > 0 && (
        <Section title="Resources">
          {(['book', 'journal', 'lab', 'other'] as CourseResource['category'][]).map(cat => {
            const items = byCategory(cat)
            if (items.length === 0) return null
            return (
              <div key={cat} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  {CAT_LABELS[cat]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {items.map(r => {
                    const href = r.file_path ? getResourceUrl(r.file_path) : r.link
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{r.file_path ? '📎' : '🔗'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{r.title || r.file_name || r.link}</div>
                          {r.file_name && r.title && <div style={{ fontSize: '11px', color: '#aaa' }}>{r.file_name}</div>}
                        </div>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: '#185FA5', textDecoration: 'none', fontWeight: 500, flexShrink: 0, padding: '3px 10px', border: '0.5px solid #185FA5', borderRadius: '6px' }}
                          >
                            {r.file_path ? 'Download' : 'Open'}
                          </a>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </Section>
      )}

      {/* Grading system */}
      {grading.length > 0 && (
        <Section title="Grading System">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '320px' }}>
            {grading.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '9px', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: '#444' }}>{p.label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1D9E75', background: '#E1F5EE', padding: '2px 10px', borderRadius: '999px' }}>{p.weight}%</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '12px', color: '#888', marginTop: '2px', paddingRight: '4px' }}>
              Total: {grading.reduce((s, p) => s + p.weight, 0)}%
            </div>
          </div>
        </Section>
      )}

      {schedule.length === 0 && topics.length === 0 && resources.length === 0 && grading.length === 0 && (
        <div style={{ fontSize: '13px', color: '#aaa', marginTop: '8px' }}>
          Your professor hasn't added course details yet.
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function StudentCourses() {
  const { profile } = useAuth()
  const { courses, getResourceUrl } = useCourses()
  const { enrolledCourseIds, loading } = useMyEnrollments(profile?.id ?? null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  if (loading) return null

  if (selectedCourse) {
    return (
      <CourseDetail
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
        getResourceUrl={getResourceUrl}
      />
    )
  }

  return (
    <div>
      <PageHeader title="My Courses" subtitle="Courses you've been enrolled in." />

      {enrolledCourses.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>No courses yet</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor will enroll you in a course.</div>
        </div>
      ) : (
        enrolledCourses.map(course => {
          const hasInfo = (course.topics?.length ?? 0) > 0 || (course.schedule?.length ?? 0) > 0
            || (course.resources?.length ?? 0) > 0 || (course.grading_system?.length ?? 0) > 0
          return (
            <div
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                🏫
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{course.name}</div>
                {course.section && <div style={{ fontSize: '12px', color: '#888' }}>Section {course.section}</div>}
                {hasInfo && <div style={{ fontSize: '11px', color: '#1D9E75', marginTop: '2px' }}>Syllabus available →</div>}
              </div>
              <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '999px', flexShrink: 0, background: course.status === 'open' ? '#E1F5EE' : '#F1EFE8', color: course.status === 'open' ? '#0F6E56' : '#888' }}>
                {course.status === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
