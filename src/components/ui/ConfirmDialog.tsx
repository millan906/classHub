import { Button } from './Button'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px',
          padding: '1.4rem 1.5rem', width: '100%', maxWidth: '380px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: '#555', marginBottom: '1.2rem', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}
            style={{ background: '#FCEBEB', fontWeight: 500 }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
