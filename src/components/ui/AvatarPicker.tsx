import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

const PRESET_SEEDS = [
  'alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot',
  'nova', 'orbit', 'pixel', 'quark', 'radar', 'sigma',
  'titan', 'ultra', 'vega', 'xenon', 'yolo', 'zeta',
  'blaze', 'cipher', 'drone', 'ember',
]

function randomSeed() {
  return Math.random().toString(36).slice(2, 10)
}

interface AvatarPickerProps {
  currentSeed: string | null
  onSave: (seed: string | null) => Promise<void>
}

export function AvatarPicker({ currentSeed, onSave }: AvatarPickerProps) {
  const { isDark } = useTheme()
  const [selected, setSelected] = useState<string | null>(currentSeed)
  const [saving, setSaving] = useState(false)
  const [seeds, setSeeds] = useState(PRESET_SEEDS)

  async function handleSave() {
    setSaving(true)
    try { await onSave(selected) } finally { setSaving(false) }
  }

  function handleRandomize() {
    const newSeed = randomSeed()
    setSeeds(prev => {
      const next = [...prev]
      next[next.length - 1] = newSeed
      return next
    })
    setSelected(newSeed)
  }

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
        Avatar
      </div>

      {/* Current preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          overflow: 'hidden', background: '#E1F5EE',
          border: '2px solid #1D9E75',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected ? (
            <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(selected)}&size=112`} alt="preview" width={56} height={56} />
          ) : (
            <span style={{ fontSize: '22px', color: '#1D9E75' }}>?</span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={handleRandomize}
            style={{
              padding: '5px 12px', fontSize: '12px', borderRadius: '7px',
              border: `0.5px solid var(--color-border-strong)`,
              background: 'transparent', color: 'var(--color-text)',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            🎲 Randomize
          </button>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              style={{
                padding: '5px 12px', fontSize: '12px', borderRadius: '7px',
                border: '0.5px solid rgba(163,45,45,0.3)',
                background: 'transparent', color: '#A32D2D',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Remove avatar
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {seeds.map(seed => (
          <div
            key={seed}
            onClick={() => setSelected(seed)}
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              overflow: 'hidden', cursor: 'pointer',
              border: selected === seed ? '2.5px solid #1D9E75' : `2px solid var(--color-border)`,
              background: isDark ? '#252829' : '#f0f0ee',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s',
            }}
          >
            <img
              src={`https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=96`}
              alt={seed}
              width={44}
              height={44}
              loading="lazy"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || selected === currentSeed}
        style={{
          padding: '7px 18px', fontSize: '12px', fontWeight: 500, borderRadius: '8px',
          border: 'none', background: '#1D9E75', color: '#fff',
          cursor: saving || selected === currentSeed ? 'not-allowed' : 'pointer',
          opacity: saving || selected === currentSeed ? 0.6 : 1,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {saving ? 'Saving...' : 'Save avatar'}
      </button>
    </div>
  )
}
