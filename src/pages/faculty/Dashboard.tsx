import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import { useStudents } from '../../hooks/useStudents'
import { useQA } from '../../hooks/useQA'
import { useQuizzes } from '../../hooks/useQuizzes'
import { useGradeBook } from '../../hooks/useGradeBook'
import { useAllEnrollments } from '../../hooks/useEnrollments'
import { useCourses } from '../../hooks/useCourses'
import { computeWeightedGrade } from '../../utils/gradeCalculations'
import { scoreBarColor } from '../../utils/scoreColors'
import { MetricCard, PageHeader, Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import type { GradeColumn } from '../../hooks/useGradeBook'

export default function FacultyDashboard() {
  const { profile } = useAuth()
  const { students } = useStudents()
  const { questions } = useQA()
  const { quizzes, submissions } = useQuizzes()
  const { groups, columns, entries } = useGradeBook()
  const { enrollments } = useAllEnrollments()
  const { courses } = useCourses()
  const navigate = useNavigate()

  const [selectedCourseId, setSelectedCourseId] = useState<string>('all')

  const enrolled = students.filter(s => s.status === 'approved')
  const pending = students.filter(s => s.status === 'pending')
  const openQuestions = questions.filter(q => !q.is_answered).length

  // ── Essays pending grading ────────────────────────────────────────────────
  const essayPendingCount = submissions.filter(sub => {
    const quiz = quizzes.find(q => q.id === sub.quiz_id)
    if (!quiz) return false
    return (quiz.questions ?? []).some(q => q.type === 'essay') && !sub.essay_scores
  }).length

  // ── Assessments closing soon (within 48 hrs) ─────────────────────────────
  const now = Date.now()
  const in48h = now + 48 * 60 * 60 * 1000
  const closingSoon = quizzes.filter(q =>
    q.is_open && q.due_date &&
    new Date(q.due_date).getTime() <= in48h &&
    new Date(q.due_date).getTime() > now
  )

  // ── Students with no submissions at all ──────────────────────────────────
  const submittedStudentIds = new Set(submissions.map(s => s.student_id))
  const noSubmissionStudents = enrolled.filter(s => !submittedStudentIds.has(s.id))

  // ── Course-scoped helpers ─────────────────────────────────────────────────
  // Students enrolled in the selected course (or all enrolled if "all")
  const courseStudentIds: Set<string> = selectedCourseId === 'all'
    ? new Set(enrolled.map(s => s.id))
    : new Set(enrollments.filter(e => e.course_id === selectedCourseId).map(e => e.student_id))

  const courseEnrolledCount = courseStudentIds.size

  // Quizzes for the selected course
  const courseQuizzes = selectedCourseId === 'all'
    ? quizzes
    : quizzes.filter(q => q.course_id === selectedCourseId)

  // Latest assessment for selected course
  const latestQuiz = courseQuizzes[0] ?? null
  const latestQuizSubs = latestQuiz
    ? submissions.filter(s => s.quiz_id === latestQuiz.id && courseStudentIds.has(s.student_id))
    : []
  const submissionRate = courseEnrolledCount > 0 && latestQuiz
    ? Math.round((latestQuizSubs.length / courseEnrolledCount) * 100)
    : 0
  const avgScore = latestQuizSubs.length > 0
    ? Math.round(latestQuizSubs.reduce((a, s) => a + (s.score ?? 0), 0) / latestQuizSubs.length)
    : 0

  // ── Weighted grade helpers (mirrors GradeBook exactly) ───────────────────
  const entryMap = useMemo(
    () => new Map(entries.map(e => [`${e.student_id}:${e.column_id}`, e])),
    [entries],
  )
  const submissionsByKey = useMemo(
    () => submissions.reduce<Map<string, typeof submissions>>((acc, s) => {
      const key = `${s.student_id}:${s.quiz_id}`
      const list = acc.get(key) ?? []; list.push(s); acc.set(key, list); return acc
    }, new Map()),
    [submissions],
  )

  function getBestSub(studentId: string, quizId: string) {
    const subs = submissionsByKey.get(`${studentId}:${quizId}`) ?? []
    return subs.length === 0 ? null : subs.reduce((b, s) => s.score > b.score ? s : b)
  }
  function getQuizRaw(studentId: string, quizId: string) {
    const best = getBestSub(studentId, quizId)
    if (!best) return null
    const total = best.total_points ?? 100
    const earned = best.earned_points ?? Math.round((best.score / 100) * total)
    return { earned, total }
  }
  function getColumnScore(studentId: string, col: GradeColumn): number | null {
    const entry = entryMap.get(`${studentId}:${col.id}`)
    if (entry !== undefined && entry.score !== null) return entry.score
    if (col.entry_type === 'quiz_linked' && col.linked_quiz_id) {
      const best = getBestSub(studentId, col.linked_quiz_id)
      if (!best) return null
      if (best.earned_points != null && best.total_points != null && best.total_points > 0)
        return Math.round((best.earned_points / best.total_points) * col.max_score)
      return Math.round((best.score / 100) * col.max_score)
    }
    return null
  }

  const quizzesGroup = groups.find(g => g.name === 'Quizzes')
  const manualGroups = groups.filter(g => g.name !== 'Quizzes')
  const scopedQuizzes = courseQuizzes.filter(q => !q.item_type || q.item_type === 'quiz')

  // ── Bar chart: weighted final grade distribution ──────────────────────────
  const distribution = useMemo(() => {
    const dist = { low: 0, mid: 0, high: 0 }
    for (const studentId of courseStudentIds) {
      const grade = computeWeightedGrade(studentId, quizzesGroup, scopedQuizzes, manualGroups, columns, getQuizRaw, getColumnScore)
      if (grade === null) continue
      if (grade >= 75) dist.high++
      else if (grade >= 50) dist.mid++
      else dist.low++
    }
    return dist
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseStudentIds, quizzesGroup, scopedQuizzes, manualGroups, columns, entryMap, submissionsByKey])
  const chartData = [
    { name: 'Low  0–49%',  count: distribution.low,  color: '#EF4444' },
    { name: 'Mid  50–74%', count: distribution.mid,  color: '#F59E0B' },
    { name: 'High  75%+',  count: distribution.high, color: '#1D9E75' },
  ]
  const hasChartData = chartData.some(d => d.count > 0)

  const selectedCourse = selectedCourseId !== 'all' ? courses.find(c => c.id === selectedCourseId) : null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      {/* Header + course selector */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <PageHeader
          title={`${greeting}, ${profile?.full_name ?? 'Professor'}`}
          subtitle="Here's your class at a glance."
        />
        <select
          value={selectedCourseId}
          onChange={e => setSelectedCourseId(e.target.value)}
          style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#1a1a1a', cursor: 'pointer', marginTop: '4px', flexShrink: 0 }}
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Top metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', marginBottom: '1rem' }}>
        <MetricCard label="Enrolled students" value={enrolled.length} />
        <MetricCard label="Pending approvals" value={pending.length} valueColor={pending.length > 0 ? '#854F0B' : '#1a1a1a'} />
        <MetricCard label="Open questions" value={openQuestions} valueColor={openQuestions > 0 ? '#854F0B' : '#1a1a1a'} />
        <MetricCard label="Essays to grade" value={essayPendingCount} valueColor={essayPendingCount > 0 ? '#854F0B' : '#1a1a1a'} />
      </div>

      {/* Action alerts */}
      {(closingSoon.length > 0 || essayPendingCount > 0 || pending.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
          {pending.length > 0 && (
            <AlertBanner color="#EF9F27" bg="#FEFDF7"
              label={`${pending.length} student${pending.length > 1 ? 's' : ''} waiting for enrollment approval`}
              action="Review" onAction={() => navigate('/faculty/students')} />
          )}
          {essayPendingCount > 0 && (
            <AlertBanner color="#378ADD" bg="#EEF5FC"
              label={`${essayPendingCount} essay submission${essayPendingCount > 1 ? 's' : ''} need grading`}
              action="Grade" onAction={() => navigate('/faculty/quizzes')} />
          )}
          {closingSoon.map(q => (
            <AlertBanner key={q.id} color="#A32D2D" bg="#FEF2F2"
              label={`"${q.title}" closes ${new Date(q.due_date!).toLocaleString()}`}
              action="View" onAction={() => navigate('/faculty/quizzes')} />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        {/* Class avg per course — bar chart */}
        <Card>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>Grade distribution</div>
          {!hasChartData
            ? <div style={{ fontSize: '12px', color: '#aaa' }}>No submission data yet.</div>
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barSize={52} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#aaa' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.12)' }}
                    formatter={(val: number) => [`${val} student${val !== 1 ? 's' : ''}`, 'Count']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Card>

        {/* Latest assessment for selected course */}
        <Card>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
            Latest assessment
            {selectedCourse && (
              <span style={{ fontSize: '11px', fontWeight: 400, color: '#aaa', marginLeft: '6px' }}>
                {selectedCourse.name}{selectedCourse.section ? ` · ${selectedCourse.section}` : ''}
              </span>
            )}
          </div>
          {latestQuiz ? (
            <>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>{latestQuiz.title}</div>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                Submissions — {latestQuizSubs.length} / {courseEnrolledCount}
              </div>
              <div style={{ height: '6px', background: '#F1EFE8', borderRadius: '999px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ height: '100%', width: submissionRate + '%', background: '#1D9E75', borderRadius: '999px' }} />
              </div>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>
                Avg score — {avgScore}%
              </div>
              <div style={{ height: '6px', background: '#F1EFE8', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: avgScore + '%', background: scoreBarColor(avgScore), borderRadius: '999px' }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: '#aaa' }}>No assessments for this course yet.</div>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* Recent activity */}
        <Card>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>Recent activity</div>
          {questions.slice(0, 3).map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: q.is_answered ? '#1D9E75' : '#EF9F27', flexShrink: 0 }} />
              <div style={{ fontSize: '12px', flex: 1 }}>
                <span style={{ fontWeight: 500 }}>{q.poster?.full_name ?? 'Student'}</span> asked: {q.title}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap' }}>
                {new Date(q.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
          {pending.slice(0, 2).map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#EF9F27', flexShrink: 0 }} />
              <div style={{ fontSize: '12px' }}>
                <span style={{ fontWeight: 500 }}>{s.full_name}</span> requested enrollment
              </div>
            </div>
          ))}
          {questions.length === 0 && pending.length === 0 && (
            <div style={{ fontSize: '12px', color: '#aaa' }}>No recent activity.</div>
          )}
        </Card>

        {/* No submissions yet */}
        <Card>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
            No submissions yet
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#aaa', marginLeft: '6px' }}>({noSubmissionStudents.length})</span>
          </div>
          {noSubmissionStudents.length === 0
            ? <div style={{ fontSize: '12px', color: '#aaa' }}>All students have submitted at least once.</div>
            : noSubmissionStudents.slice(0, 6).map(s => (
                <div key={s.id} style={{ fontSize: '12px', color: '#555', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#E5E5E5', flexShrink: 0 }} />
                  {s.full_name}
                </div>
              ))
          }
          {noSubmissionStudents.length > 6 && (
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>+{noSubmissionStudents.length - 6} more</div>
          )}
        </Card>
      </div>
    </div>
  )
}

function AlertBanner({ color, bg, label, action, onAction }: {
  color: string; bg: string; label: string; action: string; onAction: () => void
}) {
  return (
    <div style={{
      background: bg, border: `0.5px solid ${color}40`,
      borderLeft: `3px solid ${color}`, borderRadius: '0 10px 10px 0',
      padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <div style={{ flex: 1, fontSize: '12px', color: '#444' }}>{label}</div>
      <Button onClick={onAction} style={{ fontSize: '11px', padding: '3px 10px' }}>{action}</Button>
    </div>
  )
}
