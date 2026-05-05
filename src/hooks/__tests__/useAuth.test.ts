import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const { mockSupabase, mockUnsubscribe } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn()
  const mockChannel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn() }
  mockChannel.subscribe.mockReturnValue(mockChannel)

  const mockSupabase = {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: mockUnsubscribe } } })),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  }
  return { mockSupabase, mockUnsubscribe }
})

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

// Thenable chainable mock — await-able and all methods return `this`
function makeChainable(result: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'or', 'order', 'in', 'range', 'update', 'insert', 'upsert', 'delete', 'single', 'maybeSingle', 'limit', 'not']
  methods.forEach(m => { chain[m] = vi.fn().mockReturnValue(chain) })
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockSupabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  })
  mockSupabase.from.mockReturnValue(makeChainable({ data: null, error: null }))
})

describe('useAuth', () => {
  it('returns correct initial shape', () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth())
    expect(result.current).toMatchObject({
      profile: null,
      loading: true,
      error: null,
    })
    expect(typeof result.current.signOut).toBe('function')
    expect(typeof result.current.refetchProfile).toBe('function')
  })

  it('sets loading=false when no session exists', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('exposes error when getSession rejects', async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load session. Please refresh.')
  })

  it('fetches profile when session has a user', async () => {
    const mockUser = { id: 'user-1' }
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } } })
    mockSupabase.from.mockReturnValue(makeChainable({ data: { id: 'user-1', role: 'faculty' }, error: null }))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.profile).toMatchObject({ id: 'user-1', role: 'faculty' })
  })

  it('sets error when profile fetch fails', async () => {
    const mockUser = { id: 'user-1' }
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } } })
    mockSupabase.from.mockReturnValue(makeChainable({ data: null, error: new Error('db error') }))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to load profile. Please refresh.')
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })
})
