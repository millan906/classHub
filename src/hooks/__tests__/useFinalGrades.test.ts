import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFinalGrades } from '../useFinalGrades'

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
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
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
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
})

describe('useFinalGrades', () => {
  it('returns correct initial shape', () => {
    const { result } = renderHook(() => useFinalGrades())
    expect(result.current).toMatchObject({
      finalGrades: [],
      loading: true,
      loadingMore: false,
      hasMore: false,
      error: null,
    })
    expect(typeof result.current.loadMore).toBe('function')
    expect(typeof result.current.upsertGrade).toBe('function')
    expect(typeof result.current.publishGrade).toBe('function')
    expect(typeof result.current.unpublishGrade).toBe('function')
    expect(typeof result.current.publishAllForCourse).toBe('function')
  })

  it('sets loading=false and finalGrades after fetch', async () => {
    const fakeGrades = [
      { id: 'g1', student_id: 's1', course_id: 'c1', midterm_grade: 85, grade: 90, published: false },
      { id: 'g2', student_id: 's2', course_id: 'c1', midterm_grade: 70, grade: 75, published: true },
    ]
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeGrades, error: null }))
    const { result } = renderHook(() => useFinalGrades())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.finalGrades).toHaveLength(2)
  })

  it('sets hasMore=false when result is fewer than PAGE_SIZE (50)', async () => {
    const fakeGrades = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}` }))
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeGrades, error: null }))
    const { result } = renderHook(() => useFinalGrades())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(false)
  })

  it('sets hasMore=true when result equals PAGE_SIZE (50)', async () => {
    const fakeGrades = Array.from({ length: 50 }, (_, i) => ({ id: `g${i}` }))
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeGrades, error: null }))
    const { result } = renderHook(() => useFinalGrades())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(true)
  })

  it('exposes error on fetch failure', async () => {
    mockSupabase.from.mockReturnValue(makeChainable({ data: null, error: { message: 'permission denied', code: '42501' } }))
    const { result } = renderHook(() => useFinalGrades())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("You don't have permission to do that.")
  })

  it('cleans up realtime channel on unmount', async () => {
    const { unmount } = renderHook(() => useFinalGrades())
    await waitFor(() => {})
    unmount()
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })
})
