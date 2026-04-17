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

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
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
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>Sign in to your account</div>

        <form onSubmit={handleLogin}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Email</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Password</div>
            <Link to="/forgot-password" style={{ fontSize: '12px', color: '#1D9E75', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />
          {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px',
            border: 'none', background: '#1D9E75', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ fontSize: '12px', color: '#888', marginTop: '1rem', textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#1D9E75', textDecoration: 'none' }}>Register</Link>
        </div>
      </div>
    </div>
  )
}
