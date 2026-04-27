/**
 * Races a promise against a timeout. Rejects with a user-friendly error if the
 * timeout fires first. Does not cancel the underlying operation (Supabase
 * storage uploads don't expose an AbortSignal), but surfaces a visible error
 * instead of hanging silently.
 */
export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Upload timed out after ${ms / 1000}s. Check your connection and try again.`)),
        ms,
      )
    ),
  ])
}
