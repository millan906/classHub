import type { Slide } from '../../types'

const THUMB_COLORS = ['#E1F5EE', '#E6F1FB', '#EEEDFE', '#FAEEDA', '#FAECE7', '#EAF3DE']
const THUMB_ICON_COLORS = ['#1D9E75', '#185FA5', '#6C5CE7', '#D4900A', '#C0541A', '#4A7C4E']

function FileIcon({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" fill={color} opacity="0.15" />
      <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M20 2l4 4h-4V2z" fill={color} opacity="0.4" />
      <line x1="8" y1="10" x2="16" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="14" x2="16" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="18" x2="13" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

interface SlideGridProps {
  slides: Slide[]
  isFaculty?: boolean
  onDelete?: (slide: Slide) => void
  onView: (slide: Slide) => void
  onDownload: (slide: Slide) => void
}

export function SlideGrid({ slides, isFaculty, onDelete, onView, onDownload }: SlideGridProps) {
  if (slides.length === 0) {
    return <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '2rem' }}>No slides yet.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
      {slides.map((slide, i) => (
        <div key={slide.id} style={{
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)',
          borderRadius: '14px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Thumbnail */}
          <div style={{
            height: '90px',
            background: THUMB_COLORS[i % THUMB_COLORS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FileIcon color={THUMB_ICON_COLORS[i % THUMB_ICON_COLORS.length]} />
          </div>

          {/* Info + actions */}
          <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{
              fontSize: '13px', fontWeight: 600, color: '#1a1a1a',
              marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={slide.title}>
              {slide.title}
            </div>
            <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '10px' }}>
              {new Date(slide.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {slide.file_size_mb ? ` · ${slide.file_size_mb} MB` : ''}
            </div>

            {/* Primary action */}
            <button
              onClick={() => onView(slide)}
              style={{
                width: '100%', padding: '7px', fontSize: '12px', fontWeight: 500,
                borderRadius: '8px', border: 'none', background: '#1D9E75', color: '#fff',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: '5px',
              }}
            >
              View
            </button>

            {/* Secondary actions */}
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => onDownload(slide)}
                style={{
                  flex: 1, padding: '6px', fontSize: '12px', fontWeight: 500,
                  borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)',
                  background: '#fff', color: '#444', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Download
              </button>
              {isFaculty && onDelete && (
                <button
                  onClick={() => onDelete(slide)}
                  style={{
                    padding: '6px 10px', fontSize: '12px', fontWeight: 500,
                    borderRadius: '8px', border: '0.5px solid rgba(163,45,45,0.3)',
                    background: '#fff', color: '#A32D2D', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
