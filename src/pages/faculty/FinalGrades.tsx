import { useState, useEffect } from 'react'
import { useCourses } from '../../hooks/useCourses'
import { useFinalGrades } from '../../hooks/useFinalGrades'
import { useStudents } from '../../hooks/useStudents'
import { useCourseEnrollments } from '../../hooks/useEnrollments'
import { PageHeader } from '../../components/ui/Card'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'

export default function FacultyFinalGrades() {
  const { courses } = useCourses()
  const { finalGrades, upsertGrade, publishGrade, unpublishGrade, publishAllForCourse } = useFinalGrades()
  const { students: allStudents } = useStudents()
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const { enrollments } = useCourseEnrollments(selectedCourseId)
  const [inputs, setInputs] = useState<Record<string, string>>({})
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
        if (existing?.grade != null && !(s.id in next)) {
          next[s.id] = String(existing.grade)
        }
      }
      return next
    })
  }, [students.length, finalGrades.length, selectedCourseId])

  async function handleSave(studentId: string) {
    const raw = inputs[studentId] ?? ''
    const grade = parseFloat(raw)
    if (isNaN(grade) || grade < 0 || grade > 100) return
    setSaving(prev => ({ ...prev, [studentId]: true }))
    await upsertGrade(studentId, selectedCourseId!, grade)
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
    return g?.grade != null && !g.published
  })

  return (
    <div>
      <PageHeader title="Final Grades" subtitle="Enter and publish final grades per student per course." />

      {/* Course tabs */}
      {courses.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#aaa' }}>No courses found.</div>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourseId(c.id)}
              style={{
                padding: '5px 14px', fontSize: '12px', borderRadius: '999px',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                border: '0.5px solid',
                borderColor: selectedCourseId === c.id ? '#1D9E75' : 'rgba(0,0,0,0.15)',
                background: selectedCourseId === c.id ? '#E1F5EE' : 'transparent',
                color: selectedCourseId === c.id ? '#0F6E56' : '#555',
                fontWeight: selectedCourseId === c.id ? 600 : 400,
              }}
            >
              {c.name}
            </button>
          ))}
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
                    {['Student', 'Grade (%)', 'GWA', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ background: '#F1EFE8', padding: '7px 12px', textAlign: 'left', border: '0.5px solid #ddd', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const existing = courseGrades.find(g => g.student_id === student.id)
                    const inputVal = inputs[student.id] ?? ''
                    const parsedGrade = parseFloat(inputVal)
                    const gwa = !isNaN(parsedGrade) && parsedGrade >= 0 && parsedGrade <= 100
                      ? percentageToGWA(parsedGrade)
                      : '—'
                    const isPublished = existing?.published ?? false
                    const hasGrade = existing?.grade != null
                    const isSaving = saving[student.id] ?? false
                    const isPublishing = publishing[student.id] ?? false
                    const savedVal = existing?.grade != null ? String(existing.grade) : ''
                    const isDirty = inputVal !== savedVal && inputVal !== ''

                    return (
                      <tr key={student.id}>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          <div style={{ fontWeight: 500 }}>{student.full_name}</div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>{student.email}</div>
                        </td>
                        <td style={{ padding: '8px 12px', border: '0.5px solid #eee' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={inputVal}
                              onChange={e => setInputs(prev => ({ ...prev, [student.id]: e.target.value }))}
                              placeholder="e.g. 92.2"
                              style={{
                                width: '90px', padding: '4px 8px', borderRadius: '6px',
                                border: '0.5px solid #ddd', fontSize: '13px',
                                fontFamily: 'Inter, sans-serif',
                              }}
                            />
                            {isDirty && (
                              <button
                                onClick={() => handleSave(student.id)}
                                disabled={isSaving}
                                style={{
                                  fontSize: '11px', padding: '3px 8px', borderRadius: '5px',
                                  background: '#185FA5', color: '#fff', border: 'none',
                                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                  opacity: isSaving ? 0.6 : 1,
                                }}
                              >
                                {isSaving ? '...' : 'Save'}
                              </button>
                            )}
                          </div>
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
                              <button
                                onClick={() => handleUnpublish(student.id)}
                                disabled={isPublishing}
                                style={{
                                  fontSize: '11px', padding: '3px 8px', borderRadius: '5px',
                                  background: '#FFF3E0', color: '#C87000',
                                  border: '0.5px solid #C87000',
                                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                  opacity: isPublishing ? 0.6 : 1,
                                }}
                              >
                                {isPublishing ? '...' : 'Unpublish'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePublish(student.id)}
                                disabled={isPublishing}
                                style={{
                                  fontSize: '11px', padding: '3px 8px', borderRadius: '5px',
                                  background: '#E1F5EE', color: '#0F6E56',
                                  border: '0.5px solid #1D9E75',
                                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                  opacity: isPublishing ? 0.6 : 1,
                                }}
                              >
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
