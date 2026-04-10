import React from 'react'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '12px', color: '#1a1a1a',
}

export default function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-user`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ firstName, lastName, email, password, inviteCode }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Registration failed')

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F5F5F3',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '360px',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 500, marginBottom: '4px' }}>
          class<span style={{ color: '#1D9E75' }}>hub</span>
        </div>
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>Create your account</div>

        <form onSubmit={handleRegister}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>First name</div>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Last name</div>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} required />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Password</div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required minLength={6} />
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Faculty invite code (optional)</div>
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="Leave blank if student" style={inputStyle} />
          {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px',
            border: 'none', background: '#1D9E75', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div style={{ fontSize: '12px', color: '#888', marginTop: '1rem', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#1D9E75', textDecoration: 'none' }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}
