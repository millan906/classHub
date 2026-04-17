import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '12px', color: '#1a1a1a',
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '360px' }}>
        <div style={{ fontSize: '20px', fontWeight: 500, marginBottom: '4px' }}>
          class<span style={{ color: '#1D9E75' }}>hub</span>
        </div>
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>Reset your password</div>

        {sent ? (
          <div>
            <div style={{ background: '#E1F5EE', border: '0.5px solid #1D9E75', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#0F6E56', marginBottom: '1rem' }}>
              Check your email — we sent a password reset link to <strong>{email}</strong>.
            </div>
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#1D9E75', textDecoration: 'none' }}>Back to sign in</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Email address</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              required
            />
            {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px',
              border: 'none', background: '#1D9E75', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '1rem', textAlign: 'center' }}>
              <Link to="/login" style={{ color: '#1D9E75', textDecoration: 'none' }}>Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
