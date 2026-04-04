import { useNavigate, useLocation } from 'react-router-dom'
import { Avatar, getInitials, getAvatarColors } from '../ui/Avatar'
import { Button } from '../ui/Button'
import type { Profile } from '../../types'

interface TopbarProps {
  profile: Profile
  onSignOut: () => void
}

export function Topbar({ profile, onSignOut }: TopbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isFaculty = profile.role === 'faculty'

  const tabs = isFaculty
    ? ['Dashboard', 'Slides', 'Students', 'Assessments', 'Q&A', 'Announcements']
    : ['Dashboard', 'Slides', 'Assessments', 'Q&A', 'Announcements']

  const tabRoutes: Record<string, string> = isFaculty
    ? {
        Dashboard: '/faculty/dashboard',
        Slides: '/faculty/slides',
        Students: '/faculty/students',
        Assessments: '/faculty/quizzes',
        'Q&A': '/faculty/qa',
        Announcements: '/faculty/announcements',
      }
    : {
        Dashboard: '/student/dashboard',
        Slides: '/student/slides',
        Assessments: '/student/quizzes',
        'Q&A': '/student/qa',
        Announcements: '/student/announcements',
      }

  const colors = getAvatarColors(profile.full_name)
  const initials = getInitials(profile.full_name)

  return (
    <div style={{
      height: '52px', background: '#ffffff',
      borderBottom: '0.5px solid rgba(0,0,0,0.12)',
      display: 'flex', alignItems: 'center', padding: '0 1.25rem', gap: '10px',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ fontSize: '15px', fontWeight: 500 }}>
        class<span style={{ color: '#1D9E75' }}>hub</span>
      </div>

      <div style={{ display: 'flex', gap: '2px', marginLeft: '1rem' }}>
        {tabs.map(tab => {
          const isActive = location.pathname === tabRoutes[tab]
          return (
            <button key={tab} onClick={() => navigate(tabRoutes[tab])} style={{
              padding: '6px 13px', fontSize: '13px', borderRadius: '8px',
              border: 'none', background: isActive ? '#F1EFE8' : 'transparent',
              color: isActive ? '#1a1a1a' : '#666', fontWeight: isActive ? 500 : 400,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              {tab}
            </button>
          )
        })}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar initials={initials} bg={isFaculty ? '#9FE1CB' : colors.bg} color={isFaculty ? '#085041' : colors.color} size={28} />
        <span style={{ fontSize: '13px', color: '#666' }}>{profile.full_name}</span>
        <Button variant="default" onClick={onSignOut} style={{ fontSize: '11px', padding: '3px 8px' }}>Sign out</Button>
      </div>
    </div>
  )
}
