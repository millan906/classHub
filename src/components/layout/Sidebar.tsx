import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Profile } from '../../types'

interface SidebarProps {
  profile: Profile
  onNavigate?: () => void
}

export function Sidebar({ profile, onNavigate }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isFaculty = profile.role === 'faculty'
  const base = isFaculty ? '/faculty' : '/student'
  const isActive = (path: string) => location.pathname === path

  function go(path: string) {
    navigate(path)
    onNavigate?.()
  }

  return (
    <div style={{
      width: '220px', flexShrink: 0,
      background: 'var(--color-sidebar)',
      borderRight: '0.5px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '0.5px solid var(--color-border)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>
          class<span style={{ color: '#1D9E75' }}>hub</span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
        <SidebarGroup label="Overview">
          <SidebarItem icon="⊞" text="Dashboard" path={`${base}/dashboard`} isActive={isActive(`${base}/dashboard`)} navigate={go} />
          <SidebarItem icon="📄" text="Slides" path={`${base}/slides`} isActive={isActive(`${base}/slides`)} navigate={go} />
        </SidebarGroup>

        <SidebarGroup label="Class">
          {isFaculty
            ? <SidebarItem icon="🏫" text="Courses" path="/faculty/courses" isActive={isActive('/faculty/courses')} navigate={go} />
            : <SidebarItem icon="🏫" text="My Courses" path="/student/courses" isActive={isActive('/student/courses')} navigate={go} />
          }
          {isFaculty && <SidebarItem icon="👥" text="Students" path={`${base}/students`} isActive={isActive(`${base}/students`)} navigate={go} />}
          <SidebarItem icon="📝" text="Assessments" path={`${base}/quizzes`} isActive={isActive(`${base}/quizzes`)} navigate={go} />
          <SidebarItem icon="💬" text="Q&A" path={`${base}/qa`} isActive={isActive(`${base}/qa`)} navigate={go} />
          {isFaculty && <SidebarItem icon="📊" text="Grade Book" path="/faculty/gradebook" isActive={isActive('/faculty/gradebook')} navigate={go} />}
          {isFaculty && <SidebarItem icon="🎓" text="Final Grades" path="/faculty/final-grades" isActive={isActive('/faculty/final-grades')} navigate={go} />}
          {isFaculty && <SidebarItem icon="📋" text="Attendance" path="/faculty/attendance" isActive={isActive('/faculty/attendance')} navigate={go} />}
          {!isFaculty && <SidebarItem icon="📊" text="My Grades" path="/student/grades" isActive={isActive('/student/grades')} navigate={go} />}
          {!isFaculty && <SidebarItem icon="📋" text="Attendance" path="/student/attendance" isActive={isActive('/student/attendance')} navigate={go} />}
        </SidebarGroup>

        {isFaculty && (
          <SidebarGroup label="System">
            <SidebarItem icon="⚙️" text="Settings" path="/faculty/settings" isActive={isActive('/faculty/settings')} navigate={go} />
          </SidebarGroup>
        )}

        {!isFaculty && (
          <SidebarGroup label="Account">
            <SidebarItem icon="👤" text="Profile" path="/student/profile" isActive={isActive('/student/profile')} navigate={go} />
          </SidebarGroup>
        )}
      </div>
    </div>
  )
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{
        fontSize: '10px', fontWeight: 600, color: '#bbb',
        padding: '0 1rem', marginBottom: '4px',
        letterSpacing: '0.07em', textTransform: 'uppercase',
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function SidebarItem({ icon, text, path, isActive, navigate, badge = 0 }: {
  icon: string; text: string; path: string; isActive: boolean; navigate: (path: string) => void; badge?: number
}) {
  return (
    <div onClick={() => navigate(path)} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 1rem', fontSize: '13px', cursor: 'pointer',
      background: isActive ? '#E1F5EE' : 'transparent',
      color: isActive ? '#0F6E56' : 'var(--color-text-muted)',
      fontWeight: isActive ? 500 : 400,
      borderRadius: '0',
    }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{text}</span>
      {badge > 0 && (
        <span style={{
          background: '#A32D2D', color: '#fff',
          fontSize: '10px', fontWeight: 700,
          borderRadius: '999px', minWidth: '17px', height: '17px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', lineHeight: 1,
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
  )
}
