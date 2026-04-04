interface AvatarProps {
  initials: string
  bg: string
  color: string
  size?: number
}

export function Avatar({ initials, bg, color, size = 34 }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 500, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

const AVATAR_COLORS = [
  { bg: '#E1F5EE', color: '#085041' },
  { bg: '#E6F1FB', color: '#0C447C' },
  { bg: '#EEEDFE', color: '#3C3489' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#9FE1CB', color: '#085041' },
]

export function getAvatarColors(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
