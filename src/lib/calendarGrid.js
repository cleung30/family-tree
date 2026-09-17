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

// Groups people by their birthday's "MM-DD", ignoring the year, so the
// calendar can look up who was born on a given day of any year.
export function birthdaysByMonthDay(people) {
  const map = {}
  for (const p of people) {
    if (!p.birth_date) continue
    const key = p.birth_date.slice(5)
    ;(map[key] ||= []).push(p)
  }
  return map
}

export function birthdayTitle(person, year) {
  const name = `${person.first_name} ${person.last_name || ''}`.trim()
  if (person.death_year) return `${name}'s Birthday`
  const age = year - Number(person.birth_date.slice(0, 4))
  return age > 0 ? `${name} turns ${age}` : `${name}'s Birthday`
}
