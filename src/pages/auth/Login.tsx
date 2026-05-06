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
  const [showPassword, setShowPassword] = useState(false)
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
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email, password }),
        },
      )
      const data = await res.json()

      if (!res.ok) {
        if (data.blocked && data.remainingMs) {
          // Server confirmed lockout — sync client-side limiter and show timer
          recordFailure(key)
          startCooldownTimer(data.remainingMs)
          setError(`Too many failed attempts. Try again in ${Math.ceil(data.remainingMs / 1000)}s.`)
        } else {
          recordFailure(key)
          const { blocked: nowBlocked, remainingMs: ms } = checkRateLimit(key)
          if (nowBlocked) {
            startCooldownTimer(ms)
            setError(`Too many failed attempts. Try again in ${Math.ceil(ms / 1000)}s.`)
          } else {
            setError(data.error ?? 'Login failed')
          }
        }
      } else {
        clearRateLimit(key)
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
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
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ ...inputStyle, marginBottom: 0, paddingRight: '36px', boxSizing: 'border-box', width: '100%' }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: '#888', display: 'flex', alignItems: 'center',
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          </div>
          <div style={{ marginBottom: '12px' }} />

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
