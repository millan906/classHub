import React from 'react'
import { Sidebar } from './Sidebar'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import type { Profile } from '../../types'

interface LayoutProps {
  children: React.ReactNode
  profile: Profile
  onSignOut: () => void
}

export function Layout({ children, profile, onSignOut }: LayoutProps) {
  const isFaculty = profile.role === 'faculty'
  const colors = getAvatarColors(profile.full_name)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F3' }}>
      <Sidebar profile={profile} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: '48px', flexShrink: 0,
          background: '#ffffff',
          borderBottom: '0.5px solid rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 1.25rem', gap: '10px',
        }}>
          <Avatar
            initials={getInitials(profile.full_name)}
            bg={isFaculty ? '#9FE1CB' : colors.bg}
            color={isFaculty ? '#085041' : colors.color}
            size={28}
          />
          <span style={{ fontSize: '13px', color: '#555' }}>{profile.full_name}</span>
          <button
            onClick={onSignOut}
            style={{
              fontSize: '12px', color: '#888', background: 'none',
              border: '0.5px solid rgba(0,0,0,0.18)', borderRadius: '6px',
              padding: '3px 10px', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, padding: '1.25rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
