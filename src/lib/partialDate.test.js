import { describe, it, expect } from 'vitest'
import { parsePartialDate, formatPartialDate } from './partialDate'

describe('parsePartialDate', () => {
  it('treats an empty string as no value', () => {
    expect(parsePartialDate('')).toEqual({ date: null, year: null })
    expect(parsePartialDate('   ')).toEqual({ date: null, year: null })
  })

  it('accepts a bare 4-digit year', () => {
    expect(parsePartialDate('1945')).toEqual({ date: null, year: 1945 })
  })

  it('accepts an ISO date and derives the year', () => {
    expect(parsePartialDate('1945-03-10')).toEqual({ date: '1945-03-10', year: 1945 })
  })

  it('accepts an ISO date without zero-padding', () => {
    expect(parsePartialDate('1945-3-9')).toEqual({ date: '1945-03-09', year: 1945 })
  })

  it('accepts M/D/YYYY', () => {
    expect(parsePartialDate('3/10/1945')).toEqual({ date: '1945-03-10', year: 1945 })
  })

  it('accepts MM/DD/YYYY', () => {
    expect(parsePartialDate('03/10/1945')).toEqual({ date: '1945-03-10', year: 1945 })
  })

  it('rejects a calendar date that does not exist', () => {
    expect(parsePartialDate('1945-02-30')).toBeNull()
    expect(parsePartialDate('2023-02-29')).toBeNull()
  })

  it('accepts Feb 29 on a leap year', () => {
    expect(parsePartialDate('2024-02-29')).toEqual({ date: '2024-02-29', year: 2024 })
  })

  it('rejects unrecognized text', () => {
    expect(parsePartialDate('March 1945')).toBeNull()
    expect(parsePartialDate('not a date')).toBeNull()
    expect(parsePartialDate('45')).toBeNull()
  })
})

describe('formatPartialDate', () => {
  it('prefers the full date when both are present', () => {
    expect(formatPartialDate('1945-03-10', 1945)).toBe('1945-03-10')
  })
  it('falls back to the year alone', () => {
    expect(formatPartialDate(null, 1945)).toBe('1945')
  })
  it('returns an empty string when neither is set', () => {
    expect(formatPartialDate(null, null)).toBe('')
  })
})
