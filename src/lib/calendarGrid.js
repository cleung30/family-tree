// Pure date/calendar helpers for the family events calendar, kept
// framework-free so the month-grid math can be unit tested directly.

export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function buildMonthGrid(year, month) {
  const startOffset = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(year, month, 1 - startOffset + i)
    cells.push({ date, iso: toIsoDate(date), inMonth: date.getMonth() === month })
  }
  return cells
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function formatEventTime(time) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function upcomingEvents(events, fromIso, limit = 5) {
  return events
    .filter(e => e.event_date >= fromIso)
    .sort((a, b) => a.event_date === b.event_date
      ? (a.event_time || '').localeCompare(b.event_time || '')
      : a.event_date.localeCompare(b.event_date))
    .slice(0, limit)
}
