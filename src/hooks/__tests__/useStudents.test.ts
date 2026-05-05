import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStudents } from '../useStudents'

// ── Supabase mock ─────────────────────────────────────────────────────────────

const { mockSupabase, mockChannel } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  }
  mockChannel.subscribe.mockReturnValue(mockChannel)

  const mockSupabase = {
    from: vi.fn(),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  }
  return { mockSupabase, mockChannel }
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
  mockSupabase.channel.mockReturnValue(mockChannel)
  mockChannel.on.mockReturnThis()
  mockChannel.subscribe.mockReturnValue(mockChannel)
  mockSupabase.from.mockReturnValue(makeChainable({ data: [], error: null }))
})

describe('useStudents', () => {
  it('returns correct initial shape', () => {
    const { result } = renderHook(() => useStudents())
    expect(result.current).toMatchObject({
      students: [],
      loading: true,
      loadingMore: false,
      hasMore: false,
    })
    expect(typeof result.current.loadMore).toBe('function')
    expect(typeof result.current.approveWithCourses).toBe('function')
    expect(typeof result.current.rejectStudent).toBe('function')
  })

  it('sets loading=false and students after fetch', async () => {
    const fakeStudents = [
      { id: 's1', full_name: 'Alice', role: 'student', status: 'approved' },
      { id: 's2', full_name: 'Bob', role: 'student', status: 'pending' },
    ]
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeStudents, error: null }))
    const { result } = renderHook(() => useStudents())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.students).toHaveLength(2)
  })

  it('sets hasMore=false when result is fewer than PAGE_SIZE (150)', async () => {
    const fakeStudents = Array.from({ length: 80 }, (_, i) => ({ id: `s${i}`, role: 'student' }))
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeStudents, error: null }))
    const { result } = renderHook(() => useStudents())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(false)
  })

  it('sets hasMore=true when result equals PAGE_SIZE (150)', async () => {
    const fakeStudents = Array.from({ length: 150 }, (_, i) => ({ id: `s${i}`, role: 'student' }))
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeStudents, error: null }))
    const { result } = renderHook(() => useStudents())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(true)
  })

  it('cleans up realtime channel on unmount', async () => {
    const { unmount } = renderHook(() => useStudents())
    await waitFor(() => {})
    unmount()
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })

  it('resolves institution IDs when institutionId is provided', async () => {
    const { rerender } = renderHook(({ id }) => useStudents(id), {
      initialProps: { id: undefined as string | undefined },
    })
    await waitFor(() => {})
    rerender({ id: 'inst-1' })
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('institution_members')
    })
  })
})
