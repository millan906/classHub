import React, { useState, useEffect } from 'react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close sidebar on mobile when navigating
  function handleNavigate() { if (isMobile) setSidebarOpen(false) }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F3' }}>

      {/* Sidebar — always visible on desktop, overlay on mobile */}
      {!isMobile && <Sidebar profile={profile} onNavigate={handleNavigate} />}

      {isMobile && sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
              zIndex: 40,
            }}
          />
          {/* Drawer */}
          <div style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 50 }}>
            <Sidebar profile={profile} onNavigate={handleNavigate} />
          </div>
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: '48px', flexShrink: 0,
          background: '#ffffff',
          borderBottom: '0.5px solid rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1rem', gap: '10px',
        }}>
          {/* Hamburger on mobile */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '18px', padding: '4px 6px', color: '#555',
                lineHeight: 1,
              }}
            >
              ☰
            </button>
          )}
          {!isMobile && <div />}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
        </div>

        {/* Page content */}
        <main style={{ flex: 1, padding: isMobile ? '1rem' : '1.25rem', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
