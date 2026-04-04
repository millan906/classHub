import { useState, useRef } from 'react'
import { Button } from '../ui/Button'
import type { Course } from '../../types'

interface UploadZoneProps {
  courses: Course[]
  onUpload: (file: File, title: string, courseId: string | null) => Promise<void>
}

export function UploadZone({ courses, onUpload }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); setTitle(f.name.replace(/\.[^/.]+$/, '')) }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setTitle(f.name.replace(/\.[^/.]+$/, '')) }
  }

  async function handleUpload() {
    if (!file || !title.trim()) return
    setUploading(true)
    try {
      await onUpload(file, title.trim(), courseId || null)
      setFile(null)
      setTitle('')
      setCourseId('')
    } finally {
      setUploading(false)
    }
  }

  const inputStyle = {
    flex: 1, padding: '7px 11px', fontSize: '13px',
    border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
    background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragging ? '#1D9E75' : 'rgba(0,0,0,0.2)'}`,
          borderRadius: '12px', padding: '1.5rem', textAlign: 'center',
          color: '#888', fontSize: '13px', cursor: 'pointer',
          background: dragging ? '#E1F5EE' : 'transparent',
        }}
      >
        <div style={{ fontSize: '22px', marginBottom: '6px' }}>+</div>
        <div style={{ fontWeight: 500, color: '#1a1a1a', marginBottom: '3px' }}>
          {file ? file.name : 'Upload slides'}
        </div>
        <div>.pptx, .pdf, .key supported</div>
      </div>
      <input ref={inputRef} type="file" accept=".pptx,.pdf,.key" style={{ display: 'none' }} onChange={handleFileChange} />
      {file && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Slide title"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="">All courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.section ? ` · Section ${c.section}` : ''}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button onClick={() => { setFile(null); setTitle(''); setCourseId('') }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
