import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
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
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [announcementBadge, setAnnouncementBadge] = useState(0)
  const location = useLocation()
  const seenKey = `announcements_seen_${profile.id}`

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Compute badge count from DB on mount
  useEffect(() => {
    async function computeBadge() {
      const lastSeen = localStorage.getItem(seenKey)
      let query = supabase.from('announcements').select('id', { count: 'exact', head: true })
      if (lastSeen) query = query.gt('created_at', lastSeen)
      const { count } = await query
      setAnnouncementBadge(count ?? 0)
    }
    computeBadge()

    // Bump badge by 1 whenever a new announcement is inserted
    const channel = supabase
      .channel(`announcement-badge-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        setAnnouncementBadge(n => n + 1)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  // Clear badge when user is on the announcements page
  useEffect(() => {
    if (location.pathname.includes('/announcements')) {
      localStorage.setItem(seenKey, new Date().toISOString())
      setAnnouncementBadge(0)
    }
  }, [location.pathname])

  // Close sidebar on mobile when navigating
  function handleNavigate() { if (isMobile) setSidebarOpen(false) }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F5F5F3' }}>

      {/* Sidebar — always visible on desktop, overlay on mobile */}
      {!isMobile && <Sidebar profile={profile} onNavigate={handleNavigate} announcementBadge={announcementBadge} />}

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
            <Sidebar profile={profile} onNavigate={handleNavigate} announcementBadge={announcementBadge} />
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Announcement bell */}
            <button
              onClick={() => navigate(isFaculty ? '/faculty/announcements' : '/student/announcements')}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', lineHeight: 1, fontSize: '18px' }}
              title="Announcements"
            >
              🔔
              {announcementBadge > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  background: '#A32D2D', color: '#fff',
                  fontSize: '9px', fontWeight: 700, borderRadius: '999px',
                  minWidth: '15px', height: '15px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', lineHeight: 1,
                }}>
                  {announcementBadge > 99 ? '99+' : announcementBadge}
                </span>
              )}
            </button>

            <Avatar
              initials={getInitials(profile.full_name)}
              bg={isFaculty ? '#9FE1CB' : colors.bg}
              color={isFaculty ? '#085041' : colors.color}
              size={28}
            />
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
