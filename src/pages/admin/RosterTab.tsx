/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCourses } from '../../hooks/useCourses'
import { supabase } from '../../lib/supabase'

interface RosterTabProps {
  institutionId: string | undefined
}

interface ParsedRow {
  student_no: string
  last_name: string
  first_name: string
  program?: string
  section?: string
}

interface EnrollResult {
  enrolled: number
  pending: number
  notFoundEntries: { student_no: string; name: string }[]
  errors: string[]
}

export default function RosterTab({ institutionId }: RosterTabProps) {
  const { profile } = useAuth()
  const { courses } = useCourses(institutionId)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null)
  const [parseError, setParseError] = useState('')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<EnrollResult | null>(null)

  function normalizeHeaders(row: Record<string, any>): ParsedRow | null {
    const lower: Record<string, any> = {}
    for (const key of Object.keys(row)) {
      lower[key.trim().toLowerCase()] = row[key]
    }
    const studentNo = (lower['student_no'] ?? lower['student no'] ?? lower['studentno'] ?? '').toString().trim()
    const firstName = (lower['first_name'] ?? lower['firstname'] ?? '').toString().trim()
    const lastName = (lower['last_name'] ?? lower['lastname'] ?? '').toString().trim()
    if (!studentNo) return null
    return {
      student_no: studentNo,
      first_name: firstName,
      last_name: lastName,
      program: lower['program'] ? lower['program'].toString().trim() : undefined,
      section: lower['section'] ? lower['section'].toString().trim() : undefined,
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    setParsedRows(null)
    setResult(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx')
        const data = evt.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const parsed: ParsedRow[] = []
        for (const row of rawRows) {
          const normalized = normalizeHeaders(row)
          if (normalized) parsed.push(normalized)
        }
        if (parsed.length === 0) {
          setParseError('No valid rows found. Make sure the file has a "student_no" column.')
          return
        }
        setParsedRows(parsed)
      } catch (err: unknown) {
        setParseError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset input so re-selecting same file triggers onChange
    e.target.value = ''
  }

  async function handleUpload() {
    if (!parsedRows || !selectedCourseId || !profile) return
    setUploading(true)
    setResult(null)

    const notFoundEntries: { student_no: string; name: string }[] = []
    const errors: string[] = []
    let enrolled = 0
    let pending = 0

    for (const row of parsedRows) {
      try {
        const { data: found } = await supabase
          .from('profiles')
          .select('id, status, institution_id')
          .eq('student_no', row.student_no)
          .maybeSingle()

        if (!found) {
          // Insert into pending_roster — will auto-enroll when student registers
          const { error: pendingError } = await supabase
            .from('pending_roster')
            .upsert(
              {
                student_no: row.student_no,
                course_id: selectedCourseId,
                last_name: row.last_name || null,
                first_name: row.first_name || null,
                uploaded_by: profile.id,
              },
              { onConflict: 'student_no,course_id', ignoreDuplicates: true }
            )
          if (pendingError) {
            errors.push(`${row.student_no}: ${pendingError.message}`)
          } else {
            pending++
            notFoundEntries.push({
              student_no: row.student_no,
              name: [row.last_name, row.first_name].filter(Boolean).join(', ') || '—',
            })
          }
          continue
        }

        // If pending, approve them first
        if (found.status === 'pending') {
          await supabase
            .from('profiles')
            .update({ status: 'approved', institution_id: institutionId ?? found.institution_id })
            .eq('id', found.id)
        }

        // Upsert enrollment
        const { error: enrollError } = await supabase
          .from('course_enrollments')
          .upsert(
            { course_id: selectedCourseId, student_id: found.id, invited_by: profile.id },
            { onConflict: 'course_id,student_id', ignoreDuplicates: true }
          )

        if (enrollError) {
          errors.push(`${row.student_no}: ${enrollError.message}`)
        } else {
          enrolled++
        }
      } catch (err: unknown) {
        errors.push(`${row.student_no}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    setResult({ enrolled, pending, notFoundEntries, errors })
    setUploading(false)
  }

  const selectedCourse = courses.find(c => c.id === selectedCourseId)

  return (
    <div>
      {/* Course selector */}
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Select Course
        </div>
        <select
          value={selectedCourseId}
          onChange={e => { setSelectedCourseId(e.target.value); setParsedRows(null); setResult(null); setParseError('') }}
          style={{
            padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
            border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
            fontFamily: 'Inter, sans-serif', outline: 'none', minWidth: '260px',
          }}
        >
          <option value="">— Choose a course —</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.section ? ` · Section ${c.section}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* File upload */}
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Upload Roster File
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
          Accepts .csv or .xlsx. Required column: <code style={{ background: '#F5F5F5', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>student_no</code>. Optional: <code style={{ background: '#F5F5F5', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>last_name</code>, <code style={{ background: '#F5F5F5', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>first_name</code>, <code style={{ background: '#F5F5F5', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>program</code>, <code style={{ background: '#F5F5F5', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>section</code>. Headers are case-insensitive.
        </div>
        <label style={{
          display: 'inline-block', padding: '7px 14px', fontSize: '13px', fontWeight: 500,
          borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff',
          color: '#333', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>
          {fileName ? `📄 ${fileName}` : '📂 Choose file'}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
        {parseError && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '6px', padding: '8px 12px' }}>
            {parseError}
          </div>
        )}
      </div>

      {/* Preview table */}
      {parsedRows && parsedRows.length > 0 && (
        <div style={{
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Preview
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 500, padding: '2px 8px',
              borderRadius: '999px', background: '#E1F5EE', color: '#0F6E56',
            }}>
              {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Student No.', 'Name', 'Program', 'Section'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 10px',
                      fontSize: '10px', fontWeight: 700, color: '#888',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: '0.5px solid rgba(0,0,0,0.1)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '6px 10px', color: '#333', fontFamily: 'monospace', fontSize: '11px' }}>{row.student_no}</td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>
                      {[row.last_name, row.first_name].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>{row.program || '—'}</td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>{row.section || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsedRows.length > 50 && (
            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '8px', paddingLeft: '10px' }}>
              Showing first 50 of {parsedRows.length} rows. All rows will be uploaded.
            </div>
          )}
        </div>
      )}

      {/* Upload button */}
      {parsedRows && parsedRows.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedCourseId}
            style={{
              padding: '8px 20px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
              border: 'none', background: '#1D9E75', color: '#fff',
              cursor: uploading || !selectedCourseId ? 'not-allowed' : 'pointer',
              opacity: uploading || !selectedCourseId ? 0.6 : 1,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {uploading
              ? 'Enrolling...'
              : selectedCourse
                ? `Upload & Enroll into ${selectedCourse.name}${selectedCourse.section ? ` · ${selectedCourse.section}` : ''}`
                : 'Upload & Enroll (select a course first)'}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{
          background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
          borderRadius: '12px', padding: '14px 16px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Upload Result
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{
              padding: '10px 16px', borderRadius: '10px',
              background: '#E1F5EE', border: '0.5px solid rgba(29,158,117,0.3)',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#085041' }}>{result.enrolled}</div>
              <div style={{ fontSize: '11px', color: '#1D9E75', fontWeight: 500 }}>enrolled now</div>
            </div>
            <div style={{
              padding: '10px 16px', borderRadius: '10px',
              background: result.pending > 0 ? '#FFF8EC' : '#F5F5F5',
              border: `0.5px solid ${result.pending > 0 ? 'rgba(239,159,39,0.4)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: result.pending > 0 ? '#8C5B00' : '#888' }}>{result.pending}</div>
              <div style={{ fontSize: '11px', color: result.pending > 0 ? '#B87900' : '#888', fontWeight: 500 }}>pending roster</div>
            </div>
          </div>

          {result.pending > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#B87900', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Added to Pending Roster (will auto-enroll when they register)
              </div>
              <div style={{
                background: '#FFF8EC', border: '0.5px solid rgba(239,159,39,0.3)',
                borderRadius: '8px', padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: '3px',
              }}>
                {result.notFoundEntries.map(entry => (
                  <div key={entry.student_no} style={{ fontSize: '12px', color: '#7A4F00', display: 'flex', gap: '10px' }}>
                    <span style={{ fontFamily: 'monospace', minWidth: '120px' }}>{entry.student_no}</span>
                    <span style={{ color: '#9A6800' }}>{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                Errors
              </div>
              <div style={{
                background: '#FCEBEB', border: '0.5px solid rgba(163,45,45,0.2)',
                borderRadius: '8px', padding: '10px 12px',
                display: 'flex', flexDirection: 'column', gap: '3px',
              }}>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#A32D2D' }}>{err}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
