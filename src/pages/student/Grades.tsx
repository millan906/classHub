import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useGradesVisible } from '../../hooks/useSettings'
import { useMyFinalGrades } from '../../hooks/useFinalGrades'
import { useMyEnrollments } from '../../hooks/useEnrollments'
import { useCourses } from '../../hooks/useCourses'
import { PageHeader } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { scoreBarColor } from '../../utils/scoreColors'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'

export default function StudentGrades() {
  const { profile } = useAuth()
  const { groups, columns, entries, loading } = useGradeBook()
  const { gradesVisible, loading: settingsLoading } = useGradesVisible(profile?.id ?? null)
  const { grades: finalGrades } = useMyFinalGrades(profile?.id ?? null)
  const { enrolledCourseIds } = useMyEnrollments(profile?.id ?? null)
  const { courses } = useCourses()
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  const enrolledCourses = courses.filter(c => enrolledCourseIds.includes(c.id))
  const activeCourseId = selectedCourseId ?? enrolledCourseIds[0] ?? null
  const visibleGroups = activeCourseId
    ? groups.filter(g => !g.course_id || g.course_id === activeCourseId)
    : groups
  const visibleColumns = activeCourseId
    ? columns.filter(c => !c.course_id || c.course_id === activeCourseId)
    : columns

  const myEntries = entries.filter(e => e.student_id === profile?.id)

  const weightedRows = visibleGroups.map(g => {
    const cols = visibleColumns.filter(c => c.group_id === g.id)
    const graded = cols.filter(c => myEntries.some(e => e.column_id === c.id && e.score !== null))
    const totalEarned = graded.reduce((sum, c) => {
      const entry = myEntries.find(e => e.column_id === c.id)
      return sum + (entry?.score ?? 0)
    }, 0)
    const totalMax = graded.reduce((sum, c) => sum + c.max_score, 0)
    const rawPct = totalMax > 0 ? (totalEarned / totalMax) * 100 : null
    const weighted = rawPct !== null ? (rawPct * g.weight_percent) / 100 : null
    return { group: g, rawPct, weighted, graded: graded.length, total: cols.length }
  })

  const hasAnyGrade = weightedRows.some(r => r.weighted !== null)
  const finalGrade = weightedRows.reduce((sum, r) => sum + (r.weighted ?? 0), 0)
  const totalWeight = weightedRows.filter(r => r.weighted !== null).reduce((sum, r) => sum + r.group.weight_percent, 0)
  const gwa = hasAnyGrade ? percentageToGWA(finalGrade) : null

  const activeGroup = selectedGroupId
    ? visibleGroups.find(g => g.id === selectedGroupId)
    : visibleGroups[0] ?? null

  useEffect(() => {
    if (visibleGroups.length > 0) setSelectedGroupId(visibleGroups[0].id)
  }, [activeCourseId, visibleGroups.length === 0])

  const detailCols = activeGroup ? visibleColumns.filter(c => c.group_id === activeGroup.id) : []

  if (loading || settingsLoading) return <Spinner />

  return (
    <div>
      <PageHeader title="My Grades" />

      {/* Published final grades */}
      {finalGrades.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Official Final Grades
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {finalGrades.map(fg => {
              const courseGrade = fg.midterm_grade != null && fg.grade != null
                ? (fg.midterm_grade + fg.grade) / 2
                : fg.grade ?? fg.midterm_grade ?? null
              const fgGwa = courseGrade != null ? percentageToGWA(courseGrade) : '—'
              const fgColor = courseGrade != null ? gwaColor(fgGwa) : '#ccc'
              return (
                <div key={fg.id} style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{fg.course_name}</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '22px', fontWeight: 700, color: fgColor, lineHeight: 1 }}>{fgGwa}</div>
                      <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>GWA</div>
                    </div>
                  </div>
                  {/* Rows */}
                  {[
                    { label: 'Midterm Grade', value: fg.midterm_grade },
                    { label: 'Final Grade', value: fg.grade },
                    { label: 'Course Grade', value: courseGrade, bold: true },
                  ].map(({ label, value, bold }, i) => (
                    <div key={label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 16px',
                      borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                      background: bold ? '#FAFAF8' : undefined,
                    }}>
                      <span style={{ fontSize: '13px', color: bold ? '#333' : '#666', fontWeight: bold ? 600 : 400 }}>{label}</span>
                      <span style={{ fontSize: '13px', fontWeight: bold ? 700 : 500, color: value != null ? (bold ? fgColor : '#444') : '#ccc' }}>
                        {value != null ? `${value.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Course selector */}
      {enrolledCourses.length > 1 && (
        <div style={{ marginBottom: '12px' }}>
          <select
            value={activeCourseId ?? ''}
            onChange={e => setSelectedCourseId(e.target.value || null)}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            {enrolledCourses.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` · Section ${c.section}` : ''}</option>
            ))}
          </select>
        </div>
      )}

      {/* Detailed gradebook */}
      {!gradesVisible ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Grades not yet published</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor hasn't released the grade breakdown yet.</div>
        </div>
      ) : groups.length === 0 || !hasAnyGrade ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>📋</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>No grades yet</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor hasn't posted any grades yet.</div>
        </div>
      ) : (
        <>
          {/* Grade summary card */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
            {/* Hero: current grade */}
            <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(0,0,0,0.07)' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  Running Grade
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '38px', fontWeight: 700, color: scoreBarColor(Math.round(finalGrade)), lineHeight: 1 }}>
                    {finalGrade.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '16px', color: '#aaa', fontWeight: 400 }}>%</span>
                </div>
                {totalWeight < 100 && (
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>{totalWeight}% of total weight graded</div>
                )}
              </div>
              {gwa && (
                <div style={{ textAlign: 'center', background: '#FAFAF8', borderRadius: '12px', padding: '12px 18px', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: gwaColor(gwa), lineHeight: 1 }}>{gwa}</div>
                  <div style={{ fontSize: '10px', color: '#aaa', fontWeight: 500, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GWA</div>
                </div>
              )}
            </div>

            {/* Component rows */}
            <div>
              {weightedRows.map(({ group, rawPct, weighted, graded, total }, i) => (
                <div
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  style={{
                    padding: '12px 20px',
                    borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                    cursor: 'pointer',
                    background: selectedGroupId === group.id ? '#F6FFF9' : undefined,
                    display: 'flex', alignItems: 'center', gap: '14px',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Left: name + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{group.name}</span>
                      <span style={{ fontSize: '10px', color: '#aaa', background: '#F1EFE8', padding: '1px 6px', borderRadius: '999px' }}>
                        {group.weight_percent}%
                      </span>
                      {graded < total && (
                        <span style={{ fontSize: '10px', color: '#aaa' }}>{graded}/{total} graded</span>
                      )}
                    </div>
                    <div style={{ height: '5px', background: '#F1EFE8', borderRadius: '999px' }}>
                      <div style={{
                        height: '100%',
                        width: `${rawPct ?? 0}%`,
                        background: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#F1EFE8',
                        borderRadius: '999px',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>

                  {/* Right: score + weighted */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#ccc' }}>
                      {rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>
                      {weighted !== null ? `${weighted.toFixed(2)} pts` : '—'}
                    </div>
                  </div>

                  <span style={{ fontSize: '12px', color: '#ccc', flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-component detail */}
          {activeGroup && detailCols.length > 0 && (
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Group tabs */}
              <div style={{ display: 'flex', gap: '4px', padding: '10px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.07)', overflowX: 'auto' }}>
                {visibleGroups.map(g => (
                  <button key={g.id} onClick={() => setSelectedGroupId(g.id)} style={{
                    padding: '5px 14px', fontSize: '12px', borderRadius: '999px', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', border: 'none', flexShrink: 0,
                    background: selectedGroupId === g.id ? '#1D9E75' : '#F1EFE8',
                    color: selectedGroupId === g.id ? '#fff' : '#555',
                    fontWeight: selectedGroupId === g.id ? 600 : 400,
                  }}>
                    {g.name}
                  </button>
                ))}
              </div>

              {/* Score rows */}
              <div style={{ padding: '4px 0' }}>
                {detailCols.map((col, i) => {
                  const entry = myEntries.find(e => e.column_id === col.id)
                  const score = entry?.score ?? null
                  const pct = score !== null && col.max_score > 0 ? Math.round((score / col.max_score) * 100) : null
                  const color = scoreBarColor(pct)
                  return (
                    <div key={col.id} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '11px 20px',
                      borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {col.title}
                        </div>
                        <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                          <div style={{ height: '100%', width: `${pct ?? 0}%`, background: pct !== null ? color : '#F1EFE8', borderRadius: '999px', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: score !== null ? color : '#ccc' }}>
                          {score !== null ? `${score} / ${col.max_score}` : '—'}
                        </div>
                        {pct !== null && <div style={{ fontSize: '11px', color: '#aaa' }}>{pct}%</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
