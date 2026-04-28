import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMyFinalGrades } from '../../hooks/useFinalGrades'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useCourses } from '../../hooks/useCourses'
import { PageHeader } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { scoreBarColor } from '../../utils/scoreColors'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'
import { supabase } from '../../lib/supabase'
import type { GradeColumn, GradeEntry } from '../../types'

function getSemesterLabel(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 1–12
  const year = now.getFullYear()
  if (month >= 6 && month <= 11) {
    return `1st semester · AY ${year}–${year + 1}`
  }
  const ay1 = month === 12 ? year : year - 1
  return `2nd semester · AY ${ay1}–${ay1 + 1}`
}

const isUUID = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s)

function gwaStanding(gwa: string): string {
  const v = parseFloat(gwa)
  if (v <= 1.5) return 'Excellent'
  if (v <= 2.0) return 'Very good standing'
  if (v <= 2.5) return 'Good standing'
  if (v <= 3.0) return 'Passing'
  return 'Failed'
}

export default function StudentGrades() {
  const { profile } = useAuth()
  const { grades: finalGrades, loading: gradesLoading } = useMyFinalGrades(profile?.id ?? null)
  const { enrolledCourseIds, loading: enrollLoading } = useMyEnrollments(profile?.id ?? null)
  const { courses, loading: coursesLoading } = useCourses()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [releasedColumns, setReleasedColumns] = useState<GradeColumn[]>([])
  const [componentEntries, setComponentEntries] = useState<GradeEntry[]>([])

  useEffect(() => {
    if (!profile?.id || enrolledCourseIds.length === 0) {
      setReleasedColumns([])
      setComponentEntries([])
      return
    }
    async function fetchComponentGrades() {
      const { data: cols } = await supabase
        .from('grade_columns')
        .select('*')
        .eq('is_released', true)
        .in('course_id', enrolledCourseIds)
        .order('created_at', { ascending: true })
      const colList = (cols ?? []) as GradeColumn[]
      setReleasedColumns(colList)
      if (colList.length === 0) { setComponentEntries([]); return }
      const colIds = colList.map(c => c.id)
      const { data: ents } = await supabase
        .from('grade_entries')
        .select('*')
        .eq('student_id', profile!.id)
        .in('column_id', colIds)
      setComponentEntries((ents ?? []) as GradeEntry[])
    }
    void fetchComponentGrades()
  }, [profile?.id, enrolledCourseIds.join(',')])

  if (gradesLoading || enrollLoading || coursesLoading) return <Spinner />

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))

  const courseData = enrolledCourses.map(course => {
    const fg = finalGrades.find(g => g.course_id === course.id) ?? null
    const courseGrade =
      fg?.midterm_grade != null && fg?.grade != null
        ? (fg.midterm_grade + fg.grade) / 2
        : fg?.grade ?? fg?.midterm_grade ?? null
    const gwa = courseGrade != null ? percentageToGWA(courseGrade) : null
    return { course, fg, courseGrade, gwa }
  })

  const publishedCourses = courseData.filter(d => d.gwa !== null)
  const pendingCount = courseData.filter(d => d.gwa === null).length

  const overallGwa =
    publishedCourses.length > 0
      ? (
          publishedCourses.reduce((sum, d) => sum + parseFloat(d.gwa!), 0) /
          publishedCourses.length
        ).toFixed(2)
      : null

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <PageHeader title="My Grades" subtitle={getSemesterLabel()} />

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Overall GWA</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: overallGwa ? gwaColor(overallGwa) : '#ccc', lineHeight: 1 }}>
            {overallGwa ?? '—'}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
            {overallGwa ? gwaStanding(overallGwa) : 'No grades yet'}
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Courses</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1 }}>{enrolledCourses.length}</div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>enrolled this sem</div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Pending grades</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: pendingCount > 0 ? '#C87000' : '#1a1a1a', lineHeight: 1 }}>{pendingCount}</div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>not yet released</div>
        </div>
      </div>

      {/* Course breakdown */}
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Course Breakdown
      </div>

      {enrolledCourses.length === 0 ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No enrolled courses</div>
          <div style={{ fontSize: '12px', color: '#888' }}>You're not enrolled in any courses this semester.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {courseData.map(({ course, fg, courseGrade, gwa }) => {
            const expanded = expandedIds.has(course.id)
            const color = gwa ? gwaColor(gwa) : '#ccc'
            const coursePct = courseGrade != null ? `${courseGrade.toFixed(1)}%` : null

            return (
              <div key={course.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Card header */}
                <div
                  onClick={() => gwa && toggleExpand(course.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    cursor: gwa ? 'pointer' : 'default',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>
                        {isUUID(course.id) ? course.name : course.id}
                      </span>
                      {course.section && (
                        <span style={{ fontSize: '12px', color: '#888' }}>{course.section}</span>
                      )}
                      {!gwa && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: '#C87000',
                          background: '#FFF8E6', border: '0.5px solid #F5C842',
                          borderRadius: '999px', padding: '2px 8px',
                        }}>
                          Pending
                        </span>
                      )}
                    </div>
                    {!isUUID(course.id) && (
                      <div style={{ fontSize: '12px', color: '#888' }}>{course.name}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color, lineHeight: 1 }}>{gwa ?? '—'}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>GWA</div>
                      {coursePct && (
                        <div style={{ fontSize: '11px', color: '#aaa' }}>{coursePct}</div>
                      )}
                    </div>
                    {gwa && (
                      <span style={{ color: '#bbb', fontSize: '13px', flexShrink: 0 }}>
                        {expanded ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded grade rows */}
                {expanded && fg && (
                  <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.07)' }}>
                    {(
                      [
                        { label: 'Midterm grade', value: fg.midterm_grade, bold: false },
                        { label: 'Final grade', value: fg.grade, bold: false },
                        { label: 'Course grade', value: courseGrade, bold: true },
                      ] as { label: string; value: number | null; bold: boolean }[]
                    ).map(({ label, value, bold }, i) => {
                      const barColor = value != null ? scoreBarColor(Math.round(value)) : '#F1EFE8'
                      return (
                        <div
                          key={label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '14px',
                            padding: '10px 16px',
                            borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                            background: bold ? '#FAFAF8' : undefined,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px',
                              color: bold ? '#333' : '#666',
                              fontWeight: bold ? 600 : 400,
                              marginBottom: bold ? 0 : '5px',
                            }}>
                              {label}
                            </div>
                            {!bold && (
                              <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${value ?? 0}%`,
                                  background: value != null ? barColor : '#F1EFE8',
                                  borderRadius: '999px',
                                  transition: 'width 0.3s',
                                }} />
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: bold ? 700 : 500,
                            color: value != null ? (bold ? color : '#444') : '#ccc',
                            flexShrink: 0,
                          }}>
                            {value != null ? `${value.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Component Grades */}
      {releasedColumns.length > 0 && (() => {
        const byCourse = enrolledCourseIds
          .map(cid => ({
            course: courses.find(c => c.id === cid),
            cols: releasedColumns.filter(col => col.course_id === cid),
          }))
          .filter(g => g.course && g.cols.length > 0)

        if (byCourse.length === 0) return null
        return (
          <div style={{ marginTop: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Component Grades
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {byCourse.map(({ course, cols }) => (
                <div key={course!.id} style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>
                    {course!.name}{course!.section ? ` · ${course!.section}` : ''}
                  </div>
                  {cols.map((col, i) => {
                    const entry = componentEntries.find(e => e.column_id === col.id)
                    const score = entry?.score ?? null
                    const pct = score !== null && col.max_score > 0 ? (score / col.max_score) * 100 : null
                    const barColor = pct !== null ? scoreBarColor(Math.round(pct)) : '#F1EFE8'
                    return (
                      <div
                        key={col.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '14px',
                          padding: '10px 16px',
                          borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', color: '#555', marginBottom: '5px' }}>{col.title}</div>
                          <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                            <div style={{
                              height: '100%',
                              width: `${pct ?? 0}%`,
                              background: pct !== null ? barColor : '#F1EFE8',
                              borderRadius: '999px',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: score !== null ? '#444' : '#ccc', flexShrink: 0 }}>
                          {score !== null ? `${score} / ${col.max_score}` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '24px', paddingBottom: '8px' }}>
        GWA scale: 1.0 (highest) — 5.0 (lowest) · passing is 3.0 and below
      </div>
    </div>
  )
}
