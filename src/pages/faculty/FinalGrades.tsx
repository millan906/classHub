import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { useFinalGrades } from '../../hooks/useFinalGrades'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'

export default function FacultyFinalGrades() {
  const { profile } = useAuth()
  const { courses } = useCourses(null, profile?.id)
  const { finalGrades, upsertGrade, publishGrade, unpublishGrade, publishAllForCourse } = useFinalGrades()
  const { students: allStudents } = useStudents()
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const { enrollments } = useCourseEnrollments(selectedCourseId)
  const [inputs, setInputs] = useState<Record<string, { midterm: string; final: string }>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [publishing, setPublishing] = useState<Record<string, boolean>>({})
  const [publishingAll, setPublishingAll] = useState(false)

  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) setSelectedCourseId(courses[0].id)
  }, [courses])

  // Reset inputs when course changes
  useEffect(() => {
    setInputs({})
  }, [selectedCourseId])

  const enrolledIds = new Set(enrollments.map(e => e.student_id))
  const students = allStudents.filter(s => s.status === 'approved' && enrolledIds.has(s.id))

  // Sync inputs from saved grades
  useEffect(() => {
    if (!selectedCourseId) return
    setInputs(prev => {
      const next = { ...prev }
      for (const s of students) {
        const existing = finalGrades.find(g => g.student_id === s.id && g.course_id === selectedCourseId)
        if (!(s.id in next)) {
          next[s.id] = {
            midterm: existing?.midterm_grade != null ? String(existing.midterm_grade) : '',
            final: existing?.grade != null ? String(existing.grade) : '',
          }
        }
      }
      return next
    })
  }, [students.length, finalGrades.length, selectedCourseId])

  async function handleSave(studentId: string) {
    const inp = inputs[studentId] ?? { midterm: '', final: '' }
    const midterm = inp.midterm !== '' ? parseFloat(inp.midterm) : null
    const final = inp.final !== '' ? parseFloat(inp.final) : null
    if (midterm !== null && (isNaN(midterm) || midterm < 0 || midterm > 100)) return
    if (final !== null && (isNaN(final) || final < 0 || final > 100)) return
    setSaving(prev => ({ ...prev, [studentId]: true }))
    await upsertGrade(studentId, selectedCourseId!, midterm, final)
    setSaving(prev => ({ ...prev, [studentId]: false }))
  }

  async function handlePublish(studentId: string) {
    setPublishing(prev => ({ ...prev, [studentId]: true }))
    await publishGrade(studentId, selectedCourseId!)
    setPublishing(prev => ({ ...prev, [studentId]: false }))
  }

  async function handleUnpublish(studentId: string) {
    setPublishing(prev => ({ ...prev, [studentId]: true }))
    await unpublishGrade(studentId, selectedCourseId!)
    setPublishing(prev => ({ ...prev, [studentId]: false }))
  }

  async function handlePublishAll() {
    setPublishingAll(true)
    await publishAllForCourse(selectedCourseId!)
    setPublishingAll(false)
  }

  const courseGrades = finalGrades.filter(g => g.course_id === selectedCourseId)

  const unpublishedWithGrade = students.filter(s => {
    const g = courseGrades.find(fg => fg.student_id === s.id)
    return (g?.midterm_grade != null || g?.grade != null) && !g?.published
  })

  return (
    <div>
      <PageHeader title="Final Grades" subtitle="Enter and publish final grades per student per course." />

      {/* Course selector */}
      {courses.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#aaa' }}>No courses found.</div>
      ) : (
        <div style={{ marginBottom: '14px' }}>
          <select
            value={selectedCourseId ?? ''}
            onChange={e => setSelectedCourseId(e.target.value)}
            style={{
              padding: '7px 12px', fontSize: '13px', borderRadius: '8px',
              border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff',
              fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none',
              minWidth: '220px',
            }}
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.section ? ` — ${c.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedCourseId && (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {students.length} student{students.length !== 1 ? 's' : ''}
            </div>
            {unpublishedWithGrade.length > 0 && (
              <button
                onClick={handlePublishAll}
                disabled={publishingAll}
                style={{
                  fontSize: '12px', padding: '5px 14px', borderRadius: '7px',
                  cursor: 'pointer', background: '#0F6E56', color: '#fff',
                  border: 'none', fontFamily: 'Inter, sans-serif',
                  opacity: publishingAll ? 0.6 : 1,
                }}
              >
                {publishingAll ? 'Publishing...' : `Publish All (${unpublishedWithGrade.length})`}
              </button>
            )}
          </div>

          {students.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '2rem' }}>
              No students enrolled in this course.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Student', 'Midterm (%)', 'Final (%)', 'Course Grade', 'GWA', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ background: '#F1EFE8', padding: '7px 12px', textAlign: 'left', border: '0.5px solid #ddd', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const existing = courseGrades.find(g => g.student_id === student.id)
                    const inp = inputs[student.id] ?? { midterm: '', final: '' }

                    const parsedMidterm = inp.midterm !== '' ? parseFloat(inp.midterm) : null
                    const parsedFinal = inp.final !== '' ? parseFloat(inp.final) : null
                    const courseGrade = parsedMidterm !== null && parsedFinal !== null && !isNaN(parsedMidterm) && !isNaN(parsedFinal)
                      ? (parsedMidterm + parsedFinal) / 2
                      : null
                    const gwa = courseGrade !== null ? percentageToGWA(courseGrade) : '—'

                    const isPublished = existing?.published ?? false
                    const hasGrade = existing?.midterm_grade != null || existing?.grade != null
                    const isSaving = saving[student.id] ?? false
                    const isPublishing = publishing[student.id] ?? false

                    const savedMidterm = existing?.midterm_grade != null ? String(existing.midterm_grade) : ''
                    const savedFinal = existing?.grade != null ? String(existing.grade) : ''
                    const isDirty = inp.midterm !== savedMidterm || inp.final !== savedFinal

                    const inputStyle = {
                      width: '80px', padding: '4px 8px', borderRadius: '6px',
                      border: '0.5px solid #ddd', fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                    }

                    return (
                      <tr key={student.id}>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          <div style={{ fontWeight: 500 }}>{student.full_name}</div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>{student.email}</div>
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={inp.midterm}
                            onChange={e => setInputs(prev => ({ ...prev, [student.id]: { ...prev[student.id] ?? { midterm: '', final: '' }, midterm: e.target.value } }))}
                            placeholder="e.g. 88"
                            style={inputStyle}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="number" min="0" max="100" step="0.1"
                              value={inp.final}
                              onChange={e => setInputs(prev => ({ ...prev, [student.id]: { ...prev[student.id] ?? { midterm: '', final: '' }, final: e.target.value } }))}
                              placeholder="e.g. 92"
                              style={inputStyle}
                            />
                            {isDirty && (
                              <button onClick={() => handleSave(student.id)} disabled={isSaving}
                                style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: '#185FA5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: isSaving ? 0.6 : 1 }}>
                                {isSaving ? '...' : 'Save'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee', fontWeight: 600, color: courseGrade !== null ? gwaColor(percentageToGWA(courseGrade)) : '#ccc' }}>
                          {courseGrade !== null ? `${courseGrade.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee', fontWeight: 600, color: gwa === '—' ? '#ccc' : gwaColor(gwa) }}>
                          {gwa}
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          {!hasGrade
                            ? <span style={{ fontSize: '11px', color: '#bbb' }}>Not entered</span>
                            : isPublished
                            ? <span style={{ fontSize: '11px', color: '#0F6E56', fontWeight: 600 }}>Published</span>
                            : <span style={{ fontSize: '11px', color: '#C87000', fontWeight: 600 }}>Draft</span>
                          }
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          {hasGrade && (
                            isPublished ? (
                              <button onClick={() => handleUnpublish(student.id)} disabled={isPublishing}
                                style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: '#FFF3E0', color: '#C87000', border: '0.5px solid #C87000', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: isPublishing ? 0.6 : 1 }}>
                                {isPublishing ? '...' : 'Unpublish'}
                              </button>
                            ) : (
                              <button onClick={() => handlePublish(student.id)} disabled={isPublishing}
                                style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '5px', background: '#E1F5EE', color: '#0F6E56', border: '0.5px solid #1D9E75', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: isPublishing ? 0.6 : 1 }}>
                                {isPublishing ? '...' : 'Publish'}
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
