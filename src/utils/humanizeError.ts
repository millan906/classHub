/**
 * Maps raw Supabase / PostgREST error objects or strings to plain-English
 * messages suitable for display in toasts and error states.
 *
 * @param err    - The raw error (Supabase error object, Error, string, or unknown)
 * @param fallback - Message to use when no specific mapping matches
 */
export function humanizeError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = extractRaw(err)
  if (!raw) return fallback

  const msg = raw.message ?? ''
  const code = raw.code ?? ''

  // ── PostgREST / Postgres error codes ──────────────────────────────────────
  if (code === 'PGRST116') return 'Record not found.'
  if (code === '23505') return 'This record already exists.'
  if (code === '23503') return 'This item is linked to other data and cannot be removed.'
  if (code === '42501' || msg.includes('permission denied')) return 'You don\'t have permission to do that.'
  if (code === '42P01') return 'A required table is missing — contact support.'

  // ── Auth / JWT errors ──────────────────────────────────────────────────────
  if (msg.includes('JWT expired') || msg.includes('token is expired')) return 'Your session has expired. Please log in again.'
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.'
  if (msg.includes('Email not confirmed')) return 'Please confirm your email before logging in.'
  if (msg.includes('User already registered')) return 'An account with this email already exists.'

  // ── Network / timeout ──────────────────────────────────────────────────────
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network')) {
    return 'Connection problem. Please check your internet and try again.'
  }
  if (msg.includes('timeout') || msg.includes('Timeout')) {
    return 'The request timed out. Please try again.'
  }

  // ── Storage errors ─────────────────────────────────────────────────────────
  if (msg.includes('The resource already exists')) return 'A file with that name already exists.'
  if (msg.includes('Payload too large') || msg.includes('413')) return 'File is too large to upload.'

  // ── Fallback: return the raw message if it reads like plain English,
  //    otherwise use the provided fallback ────────────────────────────────────
  if (msg && isReadable(msg)) return msg

  return fallback
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface RawError {
  message?: string
  code?: string
}

function extractRaw(err: unknown): RawError | null {
  if (!err) return null
  if (typeof err === 'string') return { message: err }
  if (err instanceof Error) return { message: err.message }
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>
    return {
      message: typeof e.message === 'string' ? e.message : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
    }
  }
  return null
}

/** Heuristic: a message is readable if it starts with a capital letter and has no
 *  SQL/technical keywords that would confuse a non-technical user. */
function isReadable(msg: string): boolean {
  const technicalPatterns = /\b(violates|constraint|relation|column|tuple|syntax|operator|pgrst|uuid|integer|boolean)\b/i
  return /^[A-Z]/.test(msg) && !technicalPatterns.test(msg)
}
