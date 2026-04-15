import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onDone: () => void
}

export function Toast({ message, type = 'success', onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [message])

  const bg = type === 'success' ? '#1D9E75' : '#A32D2D'

  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: bg, color: '#fff', fontSize: '13px', fontWeight: 500,
      padding: '10px 20px', borderRadius: '10px', zIndex: 9999,
      boxShadow: '0 4px 16px rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
      animation: 'fadeSlideUp 0.2s ease',
    }}>
      {message}
      <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateX(-50%) translateY(8px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </div>
  )
}
