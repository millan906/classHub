const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  green:  { bg: '#E1F5EE', color: '#0F6E56' },
  amber:  { bg: '#FAEEDA', color: '#854F0B' },
  blue:   { bg: '#E6F1FB', color: '#185FA5' },
  red:    { bg: '#FCEBEB', color: '#A32D2D' },
  purple: { bg: '#EEEDFE', color: '#3C3489' },
}

interface BadgeProps {
  label: string
  color?: keyof typeof BADGE_COLORS
}

export function Badge({ label, color = 'green' }: BadgeProps) {
  const { bg, color: textColor } = BADGE_COLORS[color] ?? BADGE_COLORS.green
  return (
    <span style={{
      background: bg, color: textColor,
      fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '999px',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
