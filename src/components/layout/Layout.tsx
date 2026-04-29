import React, { useState, useEffect, useRef } from 'react'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Sidebar } from './Sidebar'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { ChangePasswordModal } from '../ui/ChangePasswordModal'
import { useNotifications } from '../../hooks/useNotifications'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTheme } from '../../contexts/ThemeContext'
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
  const { isDark } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAllRead } = useNotifications(!isFaculty ? profile.id : null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const isMobile = useIsMobile()
  const [announcementBadge, setAnnouncementBadge] = useState(0)
  const location = useLocation()
  const seenKey = `announcements_seen_${profile.id}`

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
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--color-page)' }}>

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
        {/* Top bar — fixed on mobile so it stays visible when the browser chrome appears/disappears */}
        <div style={{
          height: '48px', flexShrink: 0,
          background: 'var(--color-topbar)',
          borderBottom: '0.5px solid var(--color-border)',
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
            {/* Bell — faculty navigates to announcements; students open notification dropdown */}
            {isFaculty ? (
              <button
                onClick={() => navigate('/faculty/announcements')}
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
            ) : (
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => { setNotifOpen(o => !o); if (!notifOpen) markAllRead() }}
                  style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', lineHeight: 1, fontSize: '18px' }}
                  title="Notifications"
                >
                  🔔
                  {(announcementBadge + unreadCount) > 0 && (
                    <span style={{
                      position: 'absolute', top: 0, right: 0,
                      background: '#A32D2D', color: '#fff',
                      fontSize: '9px', fontWeight: 700, borderRadius: '999px',
                      minWidth: '15px', height: '15px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px', lineHeight: 1,
                    }}>
                      {(announcementBadge + unreadCount) > 99 ? '99+' : (announcementBadge + unreadCount)}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div style={{
                    position: 'absolute', top: '36px', right: 0,
                    background: 'var(--color-surface)',
                    border: '0.5px solid var(--color-border)', borderRadius: '10px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', width: '280px', zIndex: 50,
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '10px 14px 8px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Notifications</div>
                      <button onClick={() => navigate('/student/announcements')} style={{ fontSize: '11px', color: '#1D9E75', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        Announcements →
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: '12px', color: 'var(--color-text-faint)', textAlign: 'center' }}>No notifications yet.</div>
                    ) : (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {notifications.slice(0, 15).map(n => {
                          const dest = n.type === 'final_grade_published' ? '/student/grades'
                            : n.type?.startsWith('announcement') ? '/student/announcements'
                            : ['quiz_created', 'quiz_updated', 'quiz_open', 'quiz_reminder'].includes(n.type ?? '') ? '/student/quizzes'
                            : null
                          return (
                            <div
                              key={n.id}
                              onClick={() => { if (dest) { setNotifOpen(false); navigate(dest) } }}
                              style={{
                                padding: '9px 14px',
                                borderBottom: '0.5px solid var(--color-border)',
                                background: n.read ? 'transparent' : (isDark ? 'rgba(29,158,117,0.08)' : '#F6FFF9'),
                                cursor: dest ? 'pointer' : 'default',
                              }}
                            >
                              <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '1px', color: 'var(--color-text)' }}>{n.title}</div>
                              {n.course_name && <div style={{ fontSize: '10px', color: '#1D9E75', fontWeight: 500, marginBottom: '2px' }}>📚 {n.course_name}</div>}
                              {n.body && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{n.body}</div>}
                              <div style={{ fontSize: '10px', color: 'var(--color-text-faint)', marginTop: '2px' }}>{timeAgo(n.created_at)}</div>
                              {dest && <div style={{ fontSize: '10px', color: '#1D9E75', marginTop: '2px' }}>Tap to view →</div>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Avatar with dropdown */}
            <div ref={avatarRef} style={{ position: 'relative' }}>
              <div onClick={() => setAvatarMenuOpen(o => !o)} style={{ cursor: 'pointer' }}>
                <Avatar
                  initials={getInitials(profile.full_name)}
                  bg={isFaculty ? '#9FE1CB' : colors.bg}
                  color={isFaculty ? '#085041' : colors.color}
                  size={28}
                  seed={profile.avatar_seed}
                />
              </div>
              {avatarMenuOpen && (
                <div style={{
                  position: 'absolute', top: '36px', right: 0,
                  background: 'var(--color-surface)',
                  border: '0.5px solid var(--color-border)', borderRadius: '10px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: '170px', zIndex: 50,
                  overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px 8px', borderBottom: '0.5px solid var(--color-border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{profile.full_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>{profile.email}</div>
                  </div>
                  {!isFaculty && (
                    <button onClick={() => { navigate('/student/profile'); setAvatarMenuOpen(false) }} style={{
                      width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: '13px',
                      background: 'var(--color-surface)', border: 'none', cursor: 'pointer', color: 'var(--color-text)',
                      borderBottom: '0.5px solid var(--color-border)',
                    }}>
                      👤 My Profile
                    </button>
                  )}
                  <button onClick={() => { setAvatarMenuOpen(false); setShowChangePw(true) }} style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: '13px',
                    background: 'var(--color-surface)', border: 'none', cursor: 'pointer', color: 'var(--color-text)',
                    borderBottom: '0.5px solid var(--color-border)',
                  }}>
                    🔑 Change password
                  </button>
                  <button onClick={onSignOut} style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: '13px',
                    background: 'var(--color-surface)', border: 'none', cursor: 'pointer', color: '#A32D2D',
                  }}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {showChangePw && (
            <ChangePasswordModal email={profile.email} onClose={() => setShowChangePw(false)} />
          )}
        </div>

        {/* Page content */}
        <main style={{ flex: 1, padding: isMobile ? '1rem' : '1.25rem', overflowY: 'auto', background: 'var(--color-page)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
