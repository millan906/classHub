import React from 'react'

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function Card({ children, style }: CardProps) {
  return (
    <div style={{
      background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.12)',
      borderRadius: '12px', padding: '1rem 1.1rem', marginBottom: '10px',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function MetricCard({ label, value, valueColor = '#1a1a1a' }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div style={{ background: '#F1EFE8', borderRadius: '8px', padding: '0.85rem' }}>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '21px', fontWeight: 500, color: valueColor }}>{value}</div>
    </div>
  )
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '3px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: '#888', marginBottom: '1.1rem' }}>{subtitle}</div>
    </>
  )
}

export function Divider() {
  return <div style={{ height: '0.5px', background: 'rgba(0,0,0,0.1)', margin: '1rem 0' }} />
}
