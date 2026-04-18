import { describe, it, expect } from 'vitest'
import { toTitleCase } from '../nameFormat'

describe('toTitleCase', () => {
  it('converts all-caps to title case', () => {
    expect(toTitleCase('KRIZEL GONZALES')).toBe('Krizel Gonzales')
  })

  it('converts all-lowercase to title case', () => {
    expect(toTitleCase('juan dela cruz')).toBe('Juan Dela Cruz')
  })

  it('handles already-correct title case', () => {
    expect(toTitleCase('Marlon Canja')).toBe('Marlon Canja')
  })

  it('trims leading/trailing whitespace', () => {
    expect(toTitleCase('  irish pearl  ')).toBe('Irish Pearl')
  })

  it('handles mixed casing', () => {
    expect(toTitleCase('mARY jOY dE lA cRUZ')).toBe('Mary Joy De La Cruz')
  })

  it('handles single word', () => {
    expect(toTitleCase('FRANCIS')).toBe('Francis')
  })
})
