import type React from 'react'
import type { Slide } from '../../types'

const ROW_COLORS = ['#E1F5EE', '#E6F1FB', '#EEEDFE', '#FAEEDA', '#FAECE7', '#EAF3DE']
const ICON_COLORS = ['#1D9E75', '#185FA5', '#6C5CE7', '#D4900A', '#C0541A', '#4A7C4E']

function FileThumb({ color, bg }: { color: string; bg: string }) {
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '8px', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="13" height="17" rx="2" fill={color} opacity="0.18" stroke={color} strokeWidth="1.4" />
        <path d="M16 2l5 5h-5V2z" fill={color} opacity="0.35" />
        <line x1="7" y1="9" x2="13" y2="9" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        <line x1="7" y1="12" x2="13" y2="12" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        <line x1="7" y1="15" x2="10" y2="15" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {slides.map((slide, i) => (
        <div key={slide.id} style={{
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)',
          borderRadius: '10px', padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <FileThumb color={ICON_COLORS[i % ICON_COLORS.length]} bg={ROW_COLORS[i % ROW_COLORS.length]} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px', fontWeight: 500, color: '#1a1a1a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {slide.title}
            </div>
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>
              {new Date(slide.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {slide.file_size_mb ? ` · ${slide.file_size_mb} MB` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
            <button onClick={() => onView(slide)} style={btnStyle('#1D9E75', '#fff', 'none')}>View</button>
            <button onClick={() => onDownload(slide)} style={btnStyle('transparent', '#444', '0.5px solid rgba(0,0,0,0.2)')}>↓</button>
            {isFaculty && onDelete && (
              <button onClick={() => onDelete(slide)} style={btnStyle('transparent', '#A32D2D', '0.5px solid rgba(163,45,45,0.3)')}>✕</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function btnStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    padding: '5px 12px', fontSize: '12px', fontWeight: 500,
    borderRadius: '7px', border, background: bg, color,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
  }
}
