import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useGradesVisible } from '../../hooks/useSettings'
import { useMyFinalGrades } from '../../hooks/useFinalGrades'
import { PageHeader } from '../../components/ui/Card'
import { scoreBarColor } from '../../utils/scoreColors'
import { percentageToGWA, gwaColor } from '../../utils/gwaConversion'

export default function StudentGrades() {
  const { profile } = useAuth()
  const { groups, columns, entries, loading } = useGradeBook()
  const { gradesVisible, loading: settingsLoading } = useGradesVisible(profile?.id ?? null)
  const { grades: finalGrades } = useMyFinalGrades(profile?.id ?? null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const myEntries = entries.filter(e => e.student_id === profile?.id)

  // Weighted summary
  const weightedRows = groups.map(g => {
    const cols = columns.filter(c => c.group_id === g.id)
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

  const activeGroup = selectedGroupId
    ? groups.find(g => g.id === selectedGroupId)
    : groups[0] ?? null

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) setSelectedGroupId(groups[0].id)
  }, [groups])

  const detailCols = activeGroup ? columns.filter(c => c.group_id === activeGroup.id) : []

  if (loading || settingsLoading) return null

  return (
    <div>
      <PageHeader title="My Grades" subtitle="Your grade breakdown by component." />

      {/* Final Grades — always visible when published */}
      {finalGrades.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Final Grades
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {finalGrades.map(fg => {
              const courseGrade = fg.midterm_grade != null && fg.grade != null
                ? (fg.midterm_grade + fg.grade) / 2
                : fg.grade ?? fg.midterm_grade ?? null
              const gwa = courseGrade != null ? percentageToGWA(courseGrade) : '—'
              const color = courseGrade != null ? gwaColor(gwa) : '#ccc'
              const rows = [
                { label: 'Midterm Grade', value: fg.midterm_grade },
                { label: 'Final Grade', value: fg.grade },
                { label: 'Course Grade', value: courseGrade, bold: true },
              ]
              return (
                <div key={fg.id} style={{ background: '#fff', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.1)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{fg.course_name}</div>
                    <div style={{ fontSize: '11px', color: '#aaa' }}>GWA: <span style={{ fontSize: '15px', fontWeight: 700, color }}>{gwa}</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {rows.map(({ label, value, bold }, i) => (
                      <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0',
                        borderTop: i > 0 ? '0.5px solid #F1EFE8' : undefined,
                      }}>
                        <span style={{ fontSize: '13px', color: bold ? '#333' : '#666', fontWeight: bold ? 600 : 400 }}>{label}</span>
                        <span style={{ fontSize: '13px', fontWeight: bold ? 700 : 500, color: value != null ? (bold ? color : '#444') : '#ccc' }}>
                          {value != null ? `${value.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detailed gradebook — gated by faculty visibility toggle */}
      {!gradesVisible ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔒</div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Detailed grades not yet published</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor hasn't released the grade breakdown yet.</div>
        </div>
      ) : groups.length === 0 || !hasAnyGrade ? (
        <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>No detailed grades yet</div>
          <div style={{ fontSize: '12px', color: '#888' }}>Your professor hasn't posted any grades yet.</div>
        </div>
      ) : (
        <>
          {/* Weighted summary table */}
          <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Weighted Grade Summary
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Component', 'Weight', 'Items Graded', 'Score', 'Weighted'].map(h => (
                      <th key={h} style={{ background: '#F1EFE8', padding: '7px 12px', textAlign: 'left', border: '0.5px solid #ddd', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weightedRows.map(({ group, rawPct, weighted, graded, total }) => (
                    <tr
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      style={{ cursor: 'pointer', background: selectedGroupId === group.id ? '#F6FFF9' : undefined }}
                    >
                      <td style={{ padding: '7px 12px', border: '0.5px solid #eee', fontWeight: 500 }}>{group.name}</td>
                      <td style={{ padding: '7px 12px', border: '0.5px solid #eee', color: '#888' }}>{group.weight_percent}%</td>
                      <td style={{ padding: '7px 12px', border: '0.5px solid #eee', color: '#888' }}>{graded} / {total}</td>
                      <td style={{ padding: '7px 12px', border: '0.5px solid #eee', color: rawPct !== null ? scoreBarColor(Math.round(rawPct)) : '#bbb', fontWeight: rawPct !== null ? 600 : 400 }}>
                        {rawPct !== null ? `${rawPct.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', border: '0.5px solid #eee', fontWeight: 600, color: weighted !== null ? scoreBarColor(Math.round((weighted / group.weight_percent) * 100)) : '#bbb' }}>
                        {weighted !== null ? weighted.toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ padding: '7px 12px', border: '0.5px solid #eee', fontWeight: 700, background: '#F9F9F7' }}>
                      Final Grade
                      {totalWeight < 100 && <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 400, marginLeft: '6px' }}>({totalWeight}% of total weight graded)</span>}
                    </td>
                    <td style={{ padding: '7px 12px', border: '0.5px solid #eee', background: '#F9F9F7' }} />
                    <td style={{ padding: '7px 12px', border: '0.5px solid #eee', fontWeight: 700, fontSize: '14px', background: '#F9F9F7', color: scoreBarColor(Math.round(finalGrade)) }}>
                      {finalGrade.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '11px', color: '#bbb', marginTop: '6px' }}>Click a row to view individual scores below.</div>
          </div>

          {/* Per-component detail */}
          {activeGroup && detailCols.length > 0 && (
            <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                {activeGroup.name} — Individual Scores
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {groups.map(g => (
                  <button key={g.id} onClick={() => setSelectedGroupId(g.id)} style={{
                    padding: '4px 12px', fontSize: '12px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                    border: '0.5px solid', borderColor: selectedGroupId === g.id ? '#1D9E75' : 'rgba(0,0,0,0.15)',
                    background: selectedGroupId === g.id ? '#E1F5EE' : 'transparent',
                    color: selectedGroupId === g.id ? '#0F6E56' : '#555',
                    fontWeight: selectedGroupId === g.id ? 600 : 400,
                  }}>
                    {g.name}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {detailCols.map(col => {
                  const entry = myEntries.find(e => e.column_id === col.id)
                  const score = entry?.score ?? null
                  const pct = score !== null && col.max_score > 0 ? Math.round((score / col.max_score) * 100) : null
                  const color = scoreBarColor(pct)
                  return (
                    <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#FAFAF8', borderRadius: '9px', border: '0.5px solid rgba(0,0,0,0.07)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.title}</div>
                        <div style={{ height: '4px', background: '#F1EFE8', borderRadius: '999px' }}>
                          <div style={{ height: '100%', width: `${pct ?? 0}%`, background: color, borderRadius: '999px', transition: 'width 0.3s' }} />
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
