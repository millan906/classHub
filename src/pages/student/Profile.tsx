import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../contexts/ThemeContext'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import { PageHeader } from '../../components/ui/Card'
import { supabase } from '../../lib/supabase'

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        flexShrink: 0, width: '40px', height: '22px',
        borderRadius: '999px', border: 'none',
        background: value ? '#1D9E75' : '#ddd',
        cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: '3px',
        left: value ? '21px' : '3px',
        width: '16px', height: '16px',
        borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function StudentProfile() {
  const { profile, refetchProfile } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()
  const [darkSaved, setDarkSaved] = useState(false)
  const [avatarSaved, setAvatarSaved] = useState(false)

  async function saveAvatar(seed: string | null) {
    if (!profile) return
    await supabase.from('profiles').update({ avatar_seed: seed }).eq('id', profile.id)
    refetchProfile?.()
    setAvatarSaved(true)
    setTimeout(() => navigate(-1), 900)
  }

  function handleDarkToggle() {
    toggle()
    setDarkSaved(true)
    setTimeout(() => setDarkSaved(false), 1800)
  }

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#555', marginBottom: '12px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        ← Back
      </button>

      <PageHeader title="Profile" subtitle="Manage your avatar and preferences." />

      {/* Avatar */}
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '12px',
      }}>
        <AvatarPicker currentSeed={profile?.avatar_seed ?? null} onSave={saveAvatar} />
        {avatarSaved && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#1D9E75', fontWeight: 500 }}>✓ Avatar saved</div>
        )}
      </div>

      {/* Appearance */}
      <div style={{
        background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '12px', padding: '16px 20px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
          Appearance
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>Dark mode</div>
            <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>Switch between light and dark theme.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {darkSaved && <span style={{ fontSize: '11px', color: '#1D9E75' }}>Saved</span>}
            <ToggleSwitch value={isDark} onChange={handleDarkToggle} />
          </div>
        </div>
      </div>
    </div>
  )
}
