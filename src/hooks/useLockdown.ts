import { useEffect } from 'react'

export function useLockdown(enabled: boolean, onEvent: (type: string, severity: 'low' | 'medium' | 'high') => void) {
  useEffect(() => {
    if (!enabled) return
    const noContext = (e: MouseEvent) => e.preventDefault()
    document.addEventListener('contextmenu', noContext)
    const noCopy = (e: ClipboardEvent) => e.preventDefault()
    document.addEventListener('copy', noCopy)
    document.addEventListener('paste', noCopy)
    document.addEventListener('cut', noCopy)
    const onVisibility = () => { if (document.hidden) onEvent('tab_switch', 'medium') }
    document.addEventListener('visibilitychange', onVisibility)
    const onBlur = () => onEvent('focus_loss', 'low')
    window.addEventListener('blur', onBlur)
    const onFullscreen = () => { if (!document.fullscreenElement) onEvent('fullscreen_exit', 'high') }
    document.addEventListener('fullscreenchange', onFullscreen)
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => {
      document.removeEventListener('contextmenu', noContext)
      document.removeEventListener('copy', noCopy)
      document.removeEventListener('paste', noCopy)
      document.removeEventListener('cut', noCopy)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.exitFullscreen?.().catch(() => {})
    }
  }, [enabled])
}
