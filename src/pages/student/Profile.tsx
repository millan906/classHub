import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import { PageHeader } from '../../components/ui/Card'
import { supabase } from '../../lib/supabase'

export default function StudentProfile() {
  const { profile, refetchProfile } = useAuth()
  const navigate = useNavigate()
  const [avatarSaved, setAvatarSaved] = useState(false)

  async function saveAvatar(seed: string | null) {
    if (!profile) return
    await supabase.from('profiles').update({ avatar_seed: seed }).eq('id', profile.id)
    refetchProfile?.()
    setAvatarSaved(true)
    setTimeout(() => navigate(-1), 900)
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

    </div>
  )
}
