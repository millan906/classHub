import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useQuizzes } from '../useQuizzes'

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

describe('useQuizzes', () => {
  it('returns correct initial shape', () => {
    const { result } = renderHook(() => useQuizzes())
    expect(result.current).toMatchObject({
      quizzes: [],
      submissions: [],
      loading: true,
      error: null,
    })
    expect(typeof result.current.createQuiz).toBe('function')
    expect(typeof result.current.updateQuiz).toBe('function')
    expect(typeof result.current.deleteQuiz).toBe('function')
    expect(typeof result.current.toggleQuiz).toBe('function')
    expect(typeof result.current.submitQuiz).toBe('function')
    expect(typeof result.current.copyQuiz).toBe('function')
  })

  it('sets loading=false and quizzes after fetch', async () => {
    const fakeQuizzes = [
      { id: 'q1', title: 'Quiz 1', questions: [], is_open: false },
      { id: 'q2', title: 'Quiz 2', questions: [], is_open: true },
    ]
    mockSupabase.from.mockReturnValue(makeChainable({ data: fakeQuizzes, error: null }))
    const { result } = renderHook(() => useQuizzes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.quizzes).toHaveLength(2)
  })

  it('filters by createdBy when provided', async () => {
    const chain = makeChainable({ data: [], error: null })
    const eqSpy = chain.eq as ReturnType<typeof vi.fn>
    mockSupabase.from.mockReturnValue(chain)

    const { result } = renderHook(() => useQuizzes('faculty-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(eqSpy).toHaveBeenCalledWith('created_by', 'faculty-1')
  })

  it('does NOT call eq("created_by") when createdBy is not provided', async () => {
    const chain = makeChainable({ data: [], error: null })
    const eqSpy = chain.eq as ReturnType<typeof vi.fn>
    mockSupabase.from.mockReturnValue(chain)

    const { result } = renderHook(() => useQuizzes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const createdByCalls = eqSpy.mock.calls.filter((args: unknown[]) => args[0] === 'created_by')
    expect(createdByCalls).toHaveLength(0)
  })

  it('exposes error when fetch fails', async () => {
    mockSupabase.from.mockReturnValue(makeChainable({ data: null, error: { message: 'access denied' } }))
    const { result } = renderHook(() => useQuizzes())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('access denied')
  })

  it('re-fetches when createdBy changes', async () => {
    let fetchCount = 0
    mockSupabase.from.mockImplementation(() => {
      fetchCount++
      return makeChainable({ data: [], error: null })
    })
    const { rerender } = renderHook(({ createdBy }) => useQuizzes(createdBy), {
      initialProps: { createdBy: 'fac-1' },
    })
    await waitFor(() => expect(fetchCount).toBeGreaterThanOrEqual(1))
    const countAfterFirst = fetchCount
    rerender({ createdBy: 'fac-2' })
    await waitFor(() => expect(fetchCount).toBeGreaterThan(countAfterFirst))
  })

  it('fetchAllSubmissions scopes to loaded quiz IDs', async () => {
    const fakeQuizzes = [
      { id: 'q1', title: 'Quiz 1', questions: [] },
      { id: 'q2', title: 'Quiz 2', questions: [] },
    ]
    const quizChain = makeChainable({ data: fakeQuizzes, error: null })
    const subChain = makeChainable({ data: [], error: null })
    const inSpy = subChain.in as ReturnType<typeof vi.fn>

    // First call (quizzes fetch) returns quizzes; subsequent calls (submissions) return subChain
    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      return callCount === 1 ? quizChain : subChain
    })

    const { result } = renderHook(() => useQuizzes('fac-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.fetchAllSubmissions()

    expect(inSpy).toHaveBeenCalledWith('quiz_id', ['q1', 'q2'])
  })

  it('cleans up realtime channel on unmount', async () => {
    const { unmount } = renderHook(() => useQuizzes())
    await waitFor(() => {})
    unmount()
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })
})
