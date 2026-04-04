import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Profile } from '../../types'

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isFaculty = profile.role === 'faculty'
  const base = isFaculty ? '/faculty' : '/student'
  const isActive = (path: string) => location.pathname === path

  return (
    <div style={{
      width: '220px', flexShrink: 0,
      background: '#ffffff',
      borderRight: '0.5px solid rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '0.5px solid rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>
          class<span style={{ color: '#1D9E75' }}>hub</span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
        <SidebarGroup label="Overview">
          <SidebarItem icon="⊞" text="Dashboard" path={`${base}/dashboard`} isActive={isActive(`${base}/dashboard`)} navigate={navigate} />
          <SidebarItem icon="📄" text="Slides" path={`${base}/slides`} isActive={isActive(`${base}/slides`)} navigate={navigate} />
        </SidebarGroup>

        <SidebarGroup label="Class">
          {isFaculty
            ? <SidebarItem icon="🏫" text="Courses" path="/faculty/courses" isActive={isActive('/faculty/courses')} navigate={navigate} />
            : <SidebarItem icon="🏫" text="My Courses" path="/student/courses" isActive={isActive('/student/courses')} navigate={navigate} />
          }
          {isFaculty && <SidebarItem icon="👥" text="Students" path={`${base}/students`} isActive={isActive(`${base}/students`)} navigate={navigate} />}
          <SidebarItem icon="📝" text="Assessments" path={`${base}/quizzes`} isActive={isActive(`${base}/quizzes`)} navigate={navigate} />
          <SidebarItem icon="💬" text="Q&A" path={`${base}/qa`} isActive={isActive(`${base}/qa`)} navigate={navigate} />
          <SidebarItem icon="📢" text="Announcements" path={`${base}/announcements`} isActive={isActive(`${base}/announcements`)} navigate={navigate} />
          {isFaculty && <SidebarItem icon="📊" text="Grade Book" path="/faculty/gradebook" isActive={isActive('/faculty/gradebook')} navigate={navigate} />}
        </SidebarGroup>
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

function SidebarItem({ icon, text, path, isActive, navigate }: {
  icon: string; text: string; path: string; isActive: boolean; navigate: (path: string) => void
}) {
  return (
    <div onClick={() => navigate(path)} style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 1rem', fontSize: '13px', cursor: 'pointer',
      background: isActive ? '#E1F5EE' : 'transparent',
      color: isActive ? '#0F6E56' : '#555',
      fontWeight: isActive ? 500 : 400,
      borderRadius: '0',
    }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      {text}
    </div>
  )
}
