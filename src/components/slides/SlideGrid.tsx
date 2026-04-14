import { Button } from '../ui/Button'
import type { Slide, Course } from '../../types'

const THUMB_COLORS = ['#E1F5EE', '#E6F1FB', '#EEEDFE', '#FAEEDA', '#FAECE7', '#EAF3DE']
const ICONS = ['📊', '📋', '📈', '📉', '📌', '🗂️']

interface SlideGridProps {
  slides: Slide[]
  courses?: Course[]
  isFaculty?: boolean
  onDelete?: (slide: Slide) => void
  onView: (slide: Slide) => void
  onDownload: (slide: Slide) => void
}

export function SlideGrid({ slides, courses, isFaculty, onDelete, onView, onDownload }: SlideGridProps) {
  if (slides.length === 0) {
    return <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '2rem' }}>No slides yet.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
      {slides.map((slide, i) => {
        const course = slide.course_id && courses ? courses.find(c => c.id === slide.course_id) : null
        return (
          <div key={slide.id} style={{
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px', padding: '0.9rem', cursor: 'default',
          }}>
            <div style={{
              height: '72px', borderRadius: '8px',
              background: THUMB_COLORS[i % THUMB_COLORS.length],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', marginBottom: '8px',
            }}>
              {ICONS[i % ICONS.length]}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '3px' }}>{slide.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {new Date(slide.created_at).toLocaleDateString()}{slide.file_size_mb ? ` · ${slide.file_size_mb} MB` : ''}
              </span>
              {course ? (
                <span style={{
                  fontSize: '11px', fontWeight: 500, padding: '1px 7px',
                  borderRadius: '999px', background: '#E6F1FB', color: '#185FA5',
                }}>
                  {course.name}{course.section ? ` · Section ${course.section}` : ''}
                </span>
              ) : (
                <span style={{
                  fontSize: '11px', fontWeight: 500, padding: '1px 7px',
                  borderRadius: '999px', background: '#F1EFE8', color: '#888',
                }}>
                  All courses
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <Button variant="primary" onClick={() => onView(slide)}>View</Button>
              <Button onClick={() => onDownload(slide)}>Download</Button>
              {isFaculty && onDelete && <Button variant="danger" onClick={() => onDelete(slide)}>Delete</Button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
