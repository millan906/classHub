import React, { useState } from 'react'
import { useInstitution } from '../../hooks/useInstitution'
import type { Profile } from '../../types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '12px', color: '#1a1a1a',
  boxSizing: 'border-box',
}

interface Props {
  profile: Profile
  onDone: () => void
  signOut: () => void
}

export default function InstitutionOnboarding({ profile, onDone, signOut }: Props) {
  const { createInstitution, joinInstitution } = useInstitution(profile.id)
  const isFaculty = profile.role === 'faculty'

  const [mode, setMode] = useState<'pick' | 'create' | 'join'>('pick')
  const [instName, setInstName] = useState('')
  const [slug, setSlug] = useState('')
  const [joinSlug, setJoinSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function generateSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!instName.trim() || !slug.trim()) return
    setLoading(true); setError('')
    try {
      await createInstitution(instName.trim(), slug.trim(), profile.id)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create institution')
    } finally { setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinSlug.trim()) return
    setLoading(true); setError('')
    try {
      await joinInstitution(joinSlug.trim(), profile.id, isFaculty ? 'faculty' : 'student')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join institution')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F5F5F3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 500, marginBottom: '4px' }}>
          class<span style={{ color: '#1D9E75' }}>hub</span>
        </div>

        {mode === 'pick' && (
          <>
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px', marginTop: '16px' }}>
              Welcome, {profile.first_name}!
            </div>
            <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>
              You're not part of an institution yet. {isFaculty ? 'Create one or join an existing one.' : 'Enter your institution code to join.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isFaculty && (
                <button onClick={() => setMode('create')} style={{
                  width: '100%', padding: '10px', fontSize: '13px', fontWeight: 500,
                  borderRadius: '8px', border: 'none', background: '#1D9E75', color: '#fff',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}>
                  Create new institution
                </button>
              )}
              <button onClick={() => setMode('join')} style={{
                width: '100%', padding: '10px', fontSize: '13px', fontWeight: 500,
                borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: '#fff', color: '#333',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}>
                Join with institution code
              </button>
            </div>
            <button onClick={signOut} style={{
              width: '100%', marginTop: '12px', padding: '8px', fontSize: '12px',
              background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              Sign out
            </button>
          </>
        )}

        {mode === 'create' && (
          <>
            <div style={{ fontSize: '14px', fontWeight: 500, margin: '16px 0 4px' }}>Create institution</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>Set up your school or organization on ClassHub.</div>
            <form onSubmit={handleCreate}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Institution name</div>
              <input
                value={instName}
                onChange={e => { setInstName(e.target.value); setSlug(generateSlug(e.target.value)) }}
                placeholder="e.g. Mapúa University"
                style={inputStyle}
                required
              />
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Institution code</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Students and faculty use this to join. Lowercase, no spaces.</div>
              <input
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. mapua"
                style={inputStyle}
                required
              />
              {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px',
                border: 'none', background: '#1D9E75', color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                fontFamily: 'Inter, sans-serif',
              }}>
                {loading ? 'Creating...' : 'Create institution'}
              </button>
            </form>
            <button onClick={() => { setMode('pick'); setError('') }} style={{
              width: '100%', marginTop: '8px', padding: '8px', fontSize: '12px',
              background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>← Back</button>
          </>
        )}

        {mode === 'join' && (
          <>
            <div style={{ fontSize: '14px', fontWeight: 500, margin: '16px 0 4px' }}>Join institution</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>Enter the code provided by your institution admin or professor.</div>
            <form onSubmit={handleJoin}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Institution code</div>
              <input
                value={joinSlug}
                onChange={e => setJoinSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. mapua"
                style={inputStyle}
                required
              />
              {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px',
                border: 'none', background: '#1D9E75', color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                fontFamily: 'Inter, sans-serif',
              }}>
                {loading ? 'Joining...' : 'Join institution'}
              </button>
            </form>
            {isFaculty && (
              <button onClick={() => { setMode('pick'); setError('') }} style={{
                width: '100%', marginTop: '8px', padding: '8px', fontSize: '12px',
                background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>← Back</button>
            )}
            {!isFaculty && (
              <button onClick={signOut} style={{
                width: '100%', marginTop: '8px', padding: '8px', fontSize: '12px',
                background: 'none', border: 'none', color: '#aaa', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>Sign out</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
