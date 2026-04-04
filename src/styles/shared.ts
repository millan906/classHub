import type React from 'react'

export const inputStyle: React.CSSProperties = {
  padding: '5px 9px', fontSize: '12px',
  border: '0.5px solid rgba(0,0,0,0.25)', borderRadius: '6px',
  background: '#fff', fontFamily: 'Inter, sans-serif',
  outline: 'none', color: '#1a1a1a',
}

// Variant used in form builders — includes bottom margin and box-sizing for full-width fields
export const formInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '7px 11px', fontSize: '13px', borderRadius: '8px',
  marginBottom: '8px', boxSizing: 'border-box', width: '100%',
}
