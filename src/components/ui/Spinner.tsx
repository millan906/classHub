export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
      <div style={{
        width: '24px', height: '24px', borderRadius: '50%',
        border: '2px solid #E5E5E5', borderTopColor: '#1D9E75',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', color: '#A32D2D' }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '8px', border: '0.5px solid rgba(0,0,0,0.2)', background: 'transparent', cursor: 'pointer' }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
