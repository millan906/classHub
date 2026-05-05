import { describe, it, expect } from 'vitest'
import { humanizeError } from '../humanizeError'

describe('humanizeError', () => {
  it('returns fallback for null/undefined', () => {
    expect(humanizeError(null)).toBe('Something went wrong. Please try again.')
    expect(humanizeError(undefined)).toBe('Something went wrong. Please try again.')
  })

  it('uses custom fallback when provided', () => {
    expect(humanizeError(null, 'Custom fallback.')).toBe('Custom fallback.')
  })

  it('maps PGRST116 (no rows) to readable message', () => {
    expect(humanizeError({ code: 'PGRST116', message: 'The result contains 0 rows' })).toBe('Record not found.')
  })

  it('maps 23505 (duplicate key) to readable message', () => {
    expect(humanizeError({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_pkey"' }))
      .toBe('This record already exists.')
  })

  it('maps 23503 (foreign key) to readable message', () => {
    expect(humanizeError({ code: '23503', message: 'violates foreign key constraint' }))
      .toBe('This item is linked to other data and cannot be removed.')
  })

  it('maps 42501 (permission denied) to readable message', () => {
    expect(humanizeError({ code: '42501', message: 'permission denied for table profiles' }))
      .toBe("You don't have permission to do that.")
  })

  it('maps JWT expired to readable message', () => {
    expect(humanizeError({ message: 'JWT expired' })).toBe('Your session has expired. Please log in again.')
    expect(humanizeError({ message: 'token is expired' })).toBe('Your session has expired. Please log in again.')
  })

  it('maps invalid login credentials', () => {
    expect(humanizeError({ message: 'Invalid login credentials' })).toBe('Incorrect email or password.')
  })

  it('maps network errors', () => {
    expect(humanizeError(new Error('Failed to fetch'))).toBe('Connection problem. Please check your internet and try again.')
    expect(humanizeError({ message: 'NetworkError when attempting to fetch resource' }))
      .toBe('Connection problem. Please check your internet and try again.')
  })

  it('maps timeout errors', () => {
    expect(humanizeError({ message: 'Request timeout' })).toBe('The request timed out. Please try again.')
  })

  it('maps storage duplicate file error', () => {
    expect(humanizeError({ message: 'The resource already exists' })).toBe('A file with that name already exists.')
  })

  it('passes through plain-English messages unchanged', () => {
    expect(humanizeError({ message: 'Failed to load assessments.' })).toBe('Failed to load assessments.')
  })

  it('uses fallback for technical messages that are not mapped', () => {
    expect(humanizeError({ message: 'relation "foo" does not exist' }))
      .toBe('Something went wrong. Please try again.')
  })

  it('handles plain string errors', () => {
    expect(humanizeError('Something specific happened.')).toBe('Something specific happened.')
  })
})
