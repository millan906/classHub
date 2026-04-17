import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  marginBottom: '12px', color: '#1a1a1a',
}

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
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
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.5rem' }}>Set a new password</div>

        {!ready ? (
          <div style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '1rem 0' }}>
            Verifying reset link…
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>New password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              required
            />
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Confirm password</div>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
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
              {loading ? 'Saving...' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
