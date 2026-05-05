import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGradeBook } from '../useGradeBook'

// ── Supabase mock ─────────────────────────────────────────────────────────────

type FilterArg = { event: string; table: string }
type HandlerFn = (payload: unknown) => void

const { mockSupabase, mockChannel } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  }
  mockChannel.on.mockImplementation(
    (_: string, filter: FilterArg, handler: HandlerFn) => {
      (mockChannel as Record<string, unknown>)[`__handler_${filter.event}_${filter.table}`] = handler
      return mockChannel
    }
  )
  mockChannel.subscribe.mockReturnValue(mockChannel)

  const mockSupabase = {
    from: vi.fn(),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  }
  return { mockSupabase, mockChannel }
})

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

// Retrieve a captured realtime handler by event+table key
function getHandler(event: string, table: string): HandlerFn | undefined {
  return (mockChannel as Record<string, unknown>)[`__handler_${event}_${table}`] as HandlerFn | undefined
}

// Thenable chainable mock — all methods return `this`; `await chain` resolves to `result`
function makeChainable(result: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'or', 'order', 'in', 'range', 'update', 'insert', 'upsert', 'delete', 'single', 'maybeSingle', 'not', 'limit']
  methods.forEach(m => { chain[m] = vi.fn().mockReturnValue(chain) })
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Re-wire channel after clearAllMocks
  mockSupabase.channel.mockReturnValue(mockChannel)
  mockChannel.on.mockImplementation((_: string, filter: FilterArg, handler: HandlerFn) => {
    (mockChannel as Record<string, unknown>)[`__handler_${filter.event}_${filter.table}`] = handler
    return mockChannel
  })
  mockChannel.subscribe.mockReturnValue(mockChannel)
  // Default: all from() calls return empty data
  mockSupabase.from.mockReturnValue(makeChainable({ data: [], error: null }))
})

describe('useGradeBook', () => {
  it('returns correct initial shape', () => {
    const { result } = renderHook(() => useGradeBook())
    expect(result.current).toMatchObject({
      groups: [],
      columns: [],
      entries: [],
      loading: true,
      error: null,
    })
    expect(typeof result.current.addGroup).toBe('function')
    expect(typeof result.current.updateGroup).toBe('function')
    expect(typeof result.current.addColumn).toBe('function')
    expect(typeof result.current.upsertEntry).toBe('function')
    expect(typeof result.current.refetch).toBe('function')
  })

  it('sets loading=false after fetch completes', async () => {
    const { result } = renderHook(() => useGradeBook())
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('incremental INSERT: appends new entry without full refetch', async () => {
    const initialEntry = { id: 'e1', column_id: 'col1', student_id: 's1', score: 80, manually_overridden: false }
    mockSupabase.from.mockReturnValue(makeChainable({ data: [initialEntry], error: null }))
    const { result } = renderHook(() => useGradeBook())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const fromCallCount = (mockSupabase.from as ReturnType<typeof vi.fn>).mock.calls.length

    const newEntry = { id: 'e2', column_id: 'col1', student_id: 's2', score: 90, manually_overridden: false }
    act(() => {
      getHandler('INSERT', 'grade_entries')?.({ new: newEntry })
    })

    expect(result.current.entries).toContainEqual(newEntry)
    // No additional from() calls — incremental, not full refetch
    expect(mockSupabase.from).toHaveBeenCalledTimes(fromCallCount)
  })

  it('incremental UPDATE: replaces existing entry by id', async () => {
    const initialEntry = { id: 'e1', column_id: 'col1', student_id: 's1', score: 80, manually_overridden: false }
    mockSupabase.from.mockReturnValue(makeChainable({ data: [initialEntry], error: null }))
    const { result } = renderHook(() => useGradeBook())
    await waitFor(() => expect(result.current.loading).toBe(false))
    // Verify initial state
    expect(result.current.entries).toContainEqual(initialEntry)

    const updatedEntry = { ...initialEntry, score: 95 }
    act(() => {
      getHandler('UPDATE', 'grade_entries')?.({ new: updatedEntry })
    })
    expect(result.current.entries.find(e => e.id === 'e1')?.score).toBe(95)
    expect(result.current.entries).toHaveLength(1)
  })

  it('incremental DELETE: removes entry by id', async () => {
    const initialEntry = { id: 'e1', column_id: 'col1', student_id: 's1', score: 80, manually_overridden: false }
    mockSupabase.from.mockReturnValue(makeChainable({ data: [initialEntry], error: null }))
    const { result } = renderHook(() => useGradeBook())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toHaveLength(1)

    act(() => {
      getHandler('DELETE', 'grade_entries')?.({ old: { id: 'e1' } })
    })
    expect(result.current.entries.find(e => e.id === 'e1')).toBeUndefined()
    expect(result.current.entries).toHaveLength(0)
  })

  it('cleans up realtime channel on unmount', async () => {
    const { unmount } = renderHook(() => useGradeBook())
    await waitFor(() => {})
    unmount()
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })
})
