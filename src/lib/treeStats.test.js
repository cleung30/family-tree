import { describe, it, expect } from 'vitest'
import { earliestBirthYear, survivingCount } from './treeStats'

describe('earliestBirthYear', () => {
  it('returns null when no one has a recorded birth year', () => {
    expect(earliestBirthYear([{ id: 1 }, { id: 2, birth_year: null }])).toBeNull()
  })

  it('returns the minimum birth year, ignoring people without one', () => {
    const people = [{ birth_year: 1955 }, { birth_year: null }, { birth_year: 1930 }, { birth_year: 1988 }]
    expect(earliestBirthYear(people)).toBe(1930)
  })
})

describe('survivingCount', () => {
  it('counts people with no recorded death year', () => {
    const people = [{ death_year: null }, { death_year: 2005 }, { death_year: null }]
    expect(survivingCount(people)).toBe(2)
  })
})
