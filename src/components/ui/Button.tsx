import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'blue'
  children: React.ReactNode
}

export function Button({ variant = 'default', children, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: '6px 16px', fontSize: '12px', borderRadius: '8px',
    border: '0.5px solid rgba(0,0,0,0.25)', background: 'transparent',
    color: '#1a1a1a', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    transition: 'background 0.1s, opacity 0.1s',
  }
  const variants: Record<string, React.CSSProperties> = {
    default: {},
    primary: { background: '#1D9E75', borderColor: '#1D9E75', color: '#ffffff' },
    danger:  { color: '#A32D2D', borderColor: '#F7C1C1' },
    blue:    { background: '#378ADD', borderColor: '#378ADD', color: '#ffffff' },
  }
  return (
    <button style={{ ...base, ...variants[variant], ...style }} {...props}>
      {children}
    </button>
  )
}
