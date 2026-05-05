import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { PageHeader } from '../../components/ui/Card'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import { supabase } from '../../lib/supabase'

export default function FacultySettings() {
  const { profile, refetchProfile } = useAuth()
  const { settings, loading, updateSettings } = useSettings(profile?.id ?? null)
  const [avatarSaved, setAvatarSaved] = useState(false)

  async function saveAvatar(seed: string | null) {
    await supabase.from('profiles').update({ avatar_seed: seed }).eq('id', profile!.id)
    refetchProfile?.()
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 1800)
  }

  if (loading) return null

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage class preferences." />

      {/* Avatar section */}
      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '16px 20px', marginBottom: '12px' }}>
        <AvatarPicker currentSeed={profile?.avatar_seed ?? null} onSave={saveAvatar} />
        {avatarSaved && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#1D9E75', fontWeight: 500 }}>✓ Avatar saved</div>
        )}
      </div>

      <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: '12px', padding: '16px 20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
          Assessment Notifications
        </div>
        <SettingRow
          title="Notify students 1 hour before due date"
          description="Sends a reminder notification one hour before any assessment is due."
          value={settings.notify_before_due}
          onChange={v => updateSettings({ notify_before_due: v })}
          hint="Requires the scheduled cron Edge Function to be deployed"
        />
      </div>
    </div>
  )
}

function SettingRow({ title, description, value, onChange, hint, saved }: {
  title: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
  hint?: string
  saved?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.5 }}>{description}</div>
        {hint && <div style={{ fontSize: '11px', color: '#C87000', marginTop: '3px' }}>⚠ {hint}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {saved && <span style={{ fontSize: '11px', color: '#1D9E75' }}>Saved</span>}
      </div>
      <button
        onClick={() => onChange(!value)}
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
    </div>
  )
}
