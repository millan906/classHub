import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const PASSWORD_MIN = 15
const PASSWORD_MAX = 64

function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters required.`
  if (pw.length > PASSWORD_MAX) return `Maximum ${PASSWORD_MAX} characters allowed.`
  if (!/[a-zA-Z]/.test(pw)) return 'Must contain at least one letter.'
  if (!/[0-9]/.test(pw)) return 'Must contain at least one number.'
  return null
}

const inputStyle = {
  width: '100%', padding: '8px 12px', fontSize: '13px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '8px',
  background: '#fff', fontFamily: 'Inter, sans-serif', outline: 'none',
  color: '#1a1a1a', boxSizing: 'border-box' as const,
}

export function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const pwError = next.length > 0 ? validatePassword(next) : null
  const pwOk = next.length > 0 && pwError === null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validatePassword(next)
    if (validation) { setError(validation); return }
    if (next !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: current })
      if (signInErr) { setError('Current password is incorrect.'); setLoading(false); return }
      const { error: updateErr } = await supabase.auth.updateUser({ password: next })
      if (updateErr) throw updateErr
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: '14px', padding: '1.5rem',
        width: '100%', maxWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>Change Password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#aaa', lineHeight: 1 }}>×</button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Password updated</div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '1rem' }}>Your new password is active.</div>
            <button onClick={onClose} style={{ padding: '7px 20px', fontSize: '13px', borderRadius: '8px', border: 'none', background: '#1D9E75', color: '#fff', cursor: 'pointer' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Current password</div>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
              placeholder="••••••••••••••••" style={{ ...inputStyle, marginBottom: '12px' }} required />

            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>New password</div>
            <input type="password" value={next} onChange={e => setNext(e.target.value)}
              placeholder="••••••••••••••••"
              style={{ ...inputStyle, marginBottom: '4px', borderColor: next.length > 0 ? (pwOk ? '#1D9E75' : '#A32D2D') : undefined }}
              required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} />
            <div style={{ fontSize: '11px', marginBottom: '12px', color: pwOk ? '#1D9E75' : (next.length > 0 ? '#A32D2D' : '#aaa') }}>
              {pwOk ? '✓ Password looks good' : (pwError ?? `Min ${PASSWORD_MIN} chars, max ${PASSWORD_MAX}, letters + numbers`)}
            </div>

            <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>Confirm new password</div>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••••••••••"
              style={{ ...inputStyle, marginBottom: '4px', borderColor: confirm.length > 0 ? (confirm === next ? '#1D9E75' : '#A32D2D') : undefined }}
              required />
            {confirm.length > 0 && confirm !== next && (
              <div style={{ fontSize: '11px', color: '#A32D2D', marginBottom: '8px' }}>Passwords do not match.</div>
            )}

            {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '10px', marginTop: '4px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading || !pwOk || confirm !== next} style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '8px', border: 'none', background: '#1D9E75', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
