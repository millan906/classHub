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

  useEffect(() => { if (institution) fetchMembers() }, [institution])

  async function fetchMembers() {
    if (!institution) return
    setLoading(true)
    const { data } = await supabase
      .from('institution_members')
      .select('id, user_id, role, profiles:user_id(full_name, email, avatar_seed)')
      .eq('institution_id', institution.id)
    const flat = (data || []).map((m: any) => ({
      id: m.id, user_id: m.user_id, role: m.role,
      full_name: m.profiles?.full_name ?? 'Unknown',
      email: m.profiles?.email ?? '',
      avatar_seed: m.profiles?.avatar_seed ?? null,
    }))
    setMembers(flat)
    setLoading(false)
  }

  async function removeMember(memberId: string) {
    await supabase.from('institution_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
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
