import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { checkRateLimit, recordFailure, clearRateLimit, loginKey } from '../../utils/rateLimiter'

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
  const [cooldownSecs, setCooldownSecs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = useNavigate()

  function startCooldownTimer(remainingMs: number) {
    setCooldownSecs(Math.ceil(remainingMs / 1000))
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldownSecs(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const key = loginKey(email)
    const { blocked, remainingMs } = checkRateLimit(key)
    if (blocked) {
      startCooldownTimer(remainingMs)
      return
    }

    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        recordFailure(key)
        const { blocked: nowBlocked, remainingMs: ms } = checkRateLimit(key)
        if (nowBlocked) {
          startCooldownTimer(ms)
          setError(`Too many failed attempts. Try again in ${Math.ceil(ms / 1000)}s.`)
        } else {
          throw authError
        }
      } else {
        clearRateLimit(key)
        navigate('/')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const isBlocked = cooldownSecs > 0

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
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} required />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Password</div>
            <Link to="/forgot-password" style={{ fontSize: '12px', color: '#1D9E75', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />

          {isBlocked && (
            <div style={{ fontSize: '12px', color: '#7A4F00', background: '#FFF8EC', border: '0.5px solid rgba(239,159,39,0.4)', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
              Too many failed attempts. Try again in <strong>{cooldownSecs}s</strong>.
            </div>
          )}
          {!isBlocked && error && (
            <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px' }}>{error}</div>
          )}

          <button type="submit" disabled={loading || isBlocked} style={{
            width: '100%', padding: '8px', fontSize: '13px', borderRadius: '8px',
            border: 'none', background: isBlocked ? '#ccc' : '#1D9E75', color: '#fff',
            cursor: loading || isBlocked ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Signing in...' : isBlocked ? `Locked (${cooldownSecs}s)` : 'Sign in'}
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
