import { describe, it, expect } from 'vitest'
import { buildMonthGrid, monthLabel, formatEventTime, upcomingEvents } from './calendarGrid'

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

describe('upcomingEvents', () => {
  const events = [
    { id: 1, event_date: '2026-09-01', event_time: '10:00:00' },
    { id: 2, event_date: '2026-09-20', event_time: '09:00:00' },
    { id: 3, event_date: '2026-09-20', event_time: '08:00:00' },
    { id: 4, event_date: '2026-10-01', event_time: null },
  ]
  it('drops events before the given date and sorts the rest by date then time', () => {
    const result = upcomingEvents(events, '2026-09-17')
    expect(result.map(e => e.id)).toEqual([3, 2, 4])
  })
  it('limits the result', () => {
    expect(upcomingEvents(events, '2026-09-01', 2)).toHaveLength(2)
  })
})
