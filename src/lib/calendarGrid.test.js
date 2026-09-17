import { describe, it, expect } from 'vitest'
import { buildMonthGrid, monthLabel, formatEventTime, birthdaysByMonthDay, birthdayTitle } from './calendarGrid'

describe('buildMonthGrid', () => {
  it('returns exactly 4 full weeks when the month starts on Sunday and has 28 days', () => {
    const cells = buildMonthGrid(2026, 1) // February 2026 starts on a Sunday
    expect(cells).toHaveLength(28)
    expect(cells[0].iso).toBe('2026-02-01')
    expect(cells[0].inMonth).toBe(true)
    expect(cells[27].iso).toBe('2026-02-28')
  })

  it('pads leading and trailing days from adjacent months', () => {
    const cells = buildMonthGrid(2026, 8) // September 2026 starts on a Tuesday
    expect(cells).toHaveLength(35)
    expect(cells[0].iso).toBe('2026-08-30')
    expect(cells[0].inMonth).toBe(false)
    expect(cells[2].iso).toBe('2026-09-01')
    expect(cells[2].inMonth).toBe(true)
    expect(cells[cells.length - 1].inMonth).toBe(false)
  })
})

describe('monthLabel', () => {
  it('formats the month and year', () => {
    expect(monthLabel(2026, 8)).toBe('September 2026')
  })
})

describe('formatEventTime', () => {
  it('returns null when no time is set', () => {
    expect(formatEventTime(null)).toBeNull()
  })
  it('formats a morning time', () => {
    expect(formatEventTime('09:05:00')).toBe('9:05 AM')
  })
  it('formats an afternoon time and noon/midnight edges', () => {
    expect(formatEventTime('13:30:00')).toBe('1:30 PM')
    expect(formatEventTime('00:00:00')).toBe('12:00 AM')
    expect(formatEventTime('12:00:00')).toBe('12:00 PM')
  })
})

describe('birthdaysByMonthDay', () => {
  it('groups people by month-day, ignoring people without a birth_date', () => {
    const people = [
      { id: 1, birth_date: '1990-09-25' },
      { id: 2, birth_date: '1955-09-25' },
      { id: 3, birth_date: '2001-01-01' },
      { id: 4, birth_date: null },
    ]
    const map = birthdaysByMonthDay(people)
    expect(map['09-25'].map(p => p.id)).toEqual([1, 2])
    expect(map['01-01'].map(p => p.id)).toEqual([3])
    expect(Object.keys(map)).not.toContain('undefined')
  })
})

describe('birthdayTitle', () => {
  it('never includes the age, regardless of birth or death year', () => {
    expect(birthdayTitle({ first_name: 'Calvin', last_name: 'Leung', birth_date: '1990-09-25' })).toBe("Calvin Leung's Birthday")
    expect(birthdayTitle({ first_name: 'Ah', last_name: 'Ma', birth_date: '1945-03-10', death_year: 2020 })).toBe("Ah Ma's Birthday")
  })
  it('handles a missing last name', () => {
    expect(birthdayTitle({ first_name: 'Cher', last_name: '', birth_date: '1946-05-20' })).toBe("Cher's Birthday")
  })
})
