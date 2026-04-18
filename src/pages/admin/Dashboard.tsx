/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useInstitutionContext } from '../../contexts/InstitutionContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Avatar, getInitials, getAvatarColors } from '../../components/ui/Avatar'

interface Member {
  id: string
  user_id: string
  role: 'admin' | 'faculty' | 'student'
  full_name: string
  email: string
  avatar_seed?: string | null
}

export default function AdminDashboard() {
  const { profile } = useAuth()
  const { institution } = useInstitutionContext()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'admin' | 'faculty' | 'student'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'student' | 'faculty' | 'admin'>('student')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState('')
  const [importCoursesLoading, setImportCoursesLoading] = useState(false)
  const [importCoursesResult, setImportCoursesResult] = useState('')

  useEffect(() => { if (institution) fetchMembers() }, [institution])

  async function fetchMembers() {
    if (!institution) return
    setLoading(true)
    const { data: mems } = await supabase
      .from('institution_members')
      .select('id, user_id, role')
      .eq('institution_id', institution.id)
    if (!mems || mems.length === 0) { setMembers([]); setLoading(false); return }

    const userIds = mems.map((m: any) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_seed')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]))
    const flat = mems.map((m: any) => ({
      id: m.id, user_id: m.user_id, role: m.role,
      full_name: profileMap[m.user_id]?.full_name ?? 'Unknown',
      email: profileMap[m.user_id]?.email ?? '',
      avatar_seed: profileMap[m.user_id]?.avatar_seed ?? null,
    }))
    setMembers(flat)
    setLoading(false)
  }

  async function removeMember(memberId: string) {
    await supabase.from('institution_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function importEnrolledStudents() {
    if (!institution) return
    setImportLoading(true)
    setImportResult('')
    try {
      // Get all student_ids from course_enrollments
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id')
      if (!enrollments || enrollments.length === 0) {
        setImportResult('No enrolled students found.')
        return
      }

      const allStudentIds = [...new Set(enrollments.map((e: any) => e.student_id))]
      const existingIds = new Set(members.map(m => m.user_id))
      const newIds = allStudentIds.filter(id => !existingIds.has(id))

      if (newIds.length === 0) {
        setImportResult('All enrolled students are already members.')
        return
      }

      // Fetch their profiles (including existing role)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_seed, role')
        .in('id', newIds)

      if (!profiles || profiles.length === 0) {
        setImportResult('No matching profiles found.')
        return
      }

      // Bulk insert into institution_members using each user's existing role
      const inserts = profiles.map((p: any) => ({
        institution_id: institution.id,
        user_id: p.id,
        role: p.role ?? 'student',
      }))
      const { data: inserted, error } = await supabase
        .from('institution_members')
        .insert(inserts)
        .select('id, user_id, role')

      if (error) throw error

      // Update profiles.institution_id
      await supabase.from('profiles').update({ institution_id: institution.id }).in('id', newIds)

      const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]))
      const newMembers = (inserted || []).map((m: any) => ({
        id: m.id, user_id: m.user_id, role: (profileMap[m.user_id]?.role ?? 'student') as Member['role'],
        full_name: profileMap[m.user_id]?.full_name ?? 'Unknown',
        email: profileMap[m.user_id]?.email ?? '',
        avatar_seed: profileMap[m.user_id]?.avatar_seed ?? null,
      }))
      setMembers(prev => [...prev, ...newMembers])
      setImportResult(`✓ Imported ${newMembers.length} student${newMembers.length !== 1 ? 's' : ''} successfully.`)
    } catch (err: unknown) {
      setImportResult(`Error: ${err instanceof Error ? err.message : 'Import failed.'}`)
    } finally {
      setImportLoading(false)
    }
  }

  async function importExistingCourses() {
    if (!institution) return
    setImportCoursesLoading(true)
    setImportCoursesResult('')
    try {
      const { data: courses, error } = await supabase
        .from('courses')
        .select('id')
        .is('institution_id', null)
      if (error) throw error
      if (!courses || courses.length === 0) {
        setImportCoursesResult('No unassigned courses found.')
        return
      }
      const ids = courses.map((c: any) => c.id)
      const { error: updateError } = await supabase
        .from('courses')
        .update({ institution_id: institution.id })
        .in('id', ids)
      if (updateError) throw updateError
      setImportCoursesResult(`✓ Imported ${ids.length} course${ids.length !== 1 ? 's' : ''}.`)
    } catch (err: unknown) {
      setImportCoursesResult(`Error: ${err instanceof Error ? err.message : 'Import failed.'}`)
    } finally {
      setImportCoursesLoading(false)
    }
  }

  async function addMember() {
    if (!addEmail.trim() || !institution) return
    setAddLoading(true)
    setAddError('')
    setAddSuccess('')
    try {
      // Look up user by email
      const { data: found } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_seed')
        .eq('email', addEmail.trim().toLowerCase())
        .maybeSingle()

      if (!found) {
        setAddError('No account found with that email. They need to sign up first.')
        return
      }

      // Check if already a member
      if (members.some(m => m.user_id === found.id)) {
        setAddError('This person is already a member of this institution.')
        return
      }

      // Add to institution_members
      const { data: newMem, error } = await supabase
        .from('institution_members')
        .insert({ institution_id: institution.id, user_id: found.id, role: addRole })
        .select('id')
        .single()

      if (error) throw error

      // Update profile institution_id
      await supabase.from('profiles').update({ institution_id: institution.id }).eq('id', found.id)

      setMembers(prev => [...prev, {
        id: newMem.id, user_id: found.id, role: addRole,
        full_name: found.full_name, email: found.email, avatar_seed: found.avatar_seed,
      }])
      setAddSuccess(`${found.full_name} added as ${addRole}.`)
      setAddEmail('')
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add member.')
    } finally {
      setAddLoading(false)
    }
  }

  const filtered = filter === 'all' ? members : members.filter(m => m.role === filter)

  const roleBadge: Record<string, { bg: string; color: string }> = {
    admin:   { bg: '#EEEDFE', color: '#3C3489' },
    faculty: { bg: '#E1F5EE', color: '#0F6E56' },
    student: { bg: '#E6F1FB', color: '#0C447C' },
  }

  return (
    <div>
      <PageHeader title={institution?.name ?? 'Institution'} subtitle={`Code: ${institution?.slug ?? ''} · ${members.length} members`} />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {(['all', 'admin', 'faculty', 'student'] as const).map(r => {
          const count = r === 'all' ? members.length : members.filter(m => m.role === r).length
          return (
            <button
              key={r}
              onClick={() => setFilter(r)}
              style={{
                padding: '8px 16px', fontSize: '12px', fontWeight: 500, borderRadius: '8px',
                border: filter === r ? 'none' : '0.5px solid rgba(0,0,0,0.15)',
                background: filter === r ? '#1D9E75' : '#fff',
                color: filter === r ? '#fff' : '#555',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)} ({count})
            </button>
          )
        })}
      </div>

      {/* Institution code banner */}
      <div style={{
        background: '#E1F5EE', border: '0.5px solid rgba(29,158,117,0.3)',
        borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: '#0F6E56', fontWeight: 500, marginBottom: '2px' }}>Institution Code</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#085041', letterSpacing: '0.05em' }}>{institution?.slug}</div>
          <div style={{ fontSize: '11px', color: '#1D9E75', marginTop: '2px' }}>Share this code with faculty and students to join</div>
        </div>
      </div>

      {loading && <Spinner />}

      {/* Add member */}
      <div style={{ marginBottom: '12px' }}>
        {!showAddForm ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowAddForm(true); setAddError(''); setAddSuccess(''); setImportResult('') }}
              style={{
                padding: '7px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
                border: 'none', background: '#1D9E75', color: '#fff',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              + Add member
            </button>
            <button
              onClick={importEnrolledStudents}
              disabled={importLoading}
              style={{
                padding: '7px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
                border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#333',
                cursor: importLoading ? 'not-allowed' : 'pointer',
                opacity: importLoading ? 0.6 : 1,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {importLoading ? 'Importing...' : '⬇ Import enrolled students'}
            </button>
            {importResult && (
              <span style={{
                fontSize: '12px', padding: '5px 10px', borderRadius: '6px',
                background: importResult.startsWith('✓') ? '#E1F5EE' : '#FCEBEB',
                color: importResult.startsWith('✓') ? '#0F6E56' : '#A32D2D',
              }}>
                {importResult}
              </span>
            )}
            <button
              onClick={importExistingCourses}
              disabled={importCoursesLoading}
              style={{
                padding: '7px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
                border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#333',
                cursor: importCoursesLoading ? 'not-allowed' : 'pointer',
                opacity: importCoursesLoading ? 0.6 : 1,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {importCoursesLoading ? 'Importing...' : '⬇ Import existing courses'}
            </button>
            {importCoursesResult && (
              <span style={{
                fontSize: '12px', padding: '5px 10px', borderRadius: '6px',
                background: importCoursesResult.startsWith('✓') ? '#E1F5EE' : '#FCEBEB',
                color: importCoursesResult.startsWith('✓') ? '#0F6E56' : '#A32D2D',
              }}>
                {importCoursesResult}
              </span>
            )}
          </div>
        ) : (
          <div style={{
            background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
            borderRadius: '12px', padding: '14px 16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>Add existing user</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Email address</div>
                <input
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addMember()}
                  placeholder="student@email.com"
                  style={{
                    padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
                    border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
                    fontFamily: 'Inter, sans-serif', outline: 'none', width: '240px',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Role</div>
                <select
                  value={addRole}
                  onChange={e => setAddRole(e.target.value as 'student' | 'faculty' | 'admin')}
                  style={{
                    padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
                    border: '0.5px solid rgba(0,0,0,0.25)', background: '#fff',
                    fontFamily: 'Inter, sans-serif', outline: 'none',
                  }}
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={addMember}
                disabled={addLoading || !addEmail.trim()}
                style={{
                  padding: '7px 16px', fontSize: '13px', fontWeight: 500, borderRadius: '8px',
                  border: 'none', background: '#1D9E75', color: '#fff',
                  cursor: addLoading || !addEmail.trim() ? 'not-allowed' : 'pointer',
                  opacity: addLoading || !addEmail.trim() ? 0.6 : 1,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {addLoading ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddError(''); setAddSuccess(''); setAddEmail('') }}
                style={{
                  padding: '7px 14px', fontSize: '13px', borderRadius: '8px',
                  border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif', color: '#555',
                }}
              >
                Cancel
              </button>
            </div>
            {addError && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '6px', padding: '8px 12px' }}>
                {addError}
              </div>
            )}
            {addSuccess && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', borderRadius: '6px', padding: '8px 12px' }}>
                ✓ {addSuccess}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Members list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(member => {
          const colors = getAvatarColors(member.full_name)
          const badge = roleBadge[member.role]
          const isMe = member.user_id === profile?.id
          return (
            <div key={member.id} style={{
              background: '#fff', border: '0.5px solid rgba(0,0,0,0.10)',
              borderRadius: '10px', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <Avatar initials={getInitials(member.full_name)} bg={colors.bg} color={colors.color} size={32} seed={member.avatar_seed} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{member.full_name}{isMe ? ' (you)' : ''}</div>
                <div style={{ fontSize: '11px', color: '#aaa' }}>{member.email}</div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 500, padding: '2px 8px',
                borderRadius: '999px', background: badge.bg, color: badge.color,
              }}>
                {member.role}
              </span>
              {!isMe && (
                <button
                  onClick={() => removeMember(member.id)}
                  style={{
                    padding: '4px 8px', fontSize: '11px', borderRadius: '6px',
                    border: '0.5px solid rgba(163,45,45,0.3)', background: 'transparent',
                    color: '#A32D2D', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && !loading && (
          <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '2rem' }}>No members found.</div>
        )}
      </div>
    </div>
  )
}
