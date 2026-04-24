const LOGIN_LIMIT = 5
const BASE_COOLDOWN_MS = 30_000 // 30s, doubles each lockout tier

interface RateLimitEntry {
  attempts: number
  lockedUntil: number
  tier: number
}

function getEntry(key: string): RateLimitEntry {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as RateLimitEntry
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: 0, tier: 0 }
}

function saveEntry(key: string, entry: RateLimitEntry) {
  try { localStorage.setItem(key, JSON.stringify(entry)) } catch { /* ignore */ }
}

export function checkRateLimit(key: string): { blocked: boolean; remainingMs: number } {
  const entry = getEntry(key)
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
    return { blocked: true, remainingMs: entry.lockedUntil - Date.now() }
  }
  return { blocked: false, remainingMs: 0 }
}

export function recordFailure(key: string): void {
  const entry = getEntry(key)

  // Reset attempt count if previous lockout fully expired
  if (entry.lockedUntil && Date.now() > entry.lockedUntil) {
    entry.attempts = 0
    entry.lockedUntil = 0
  }

  entry.attempts++

  if (entry.attempts >= LOGIN_LIMIT) {
    entry.tier++
    entry.lockedUntil = Date.now() + BASE_COOLDOWN_MS * Math.pow(2, entry.tier - 1)
    entry.attempts = 0
  }

  saveEntry(key, entry)
}

export function clearRateLimit(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

export function loginKey(email: string) {
  return `rl_login_${email.trim().toLowerCase()}`
}

export function registerKey() {
  return 'rl_register'
}
