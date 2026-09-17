// Parses a birth/death date typed as free text, accepting either a
// full date or just a year when that's all that's known.

function isValidCalendarDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

// Returns { date, year } on success (both null for an empty input), or
// null if the text doesn't match a year or a recognized date format.
export function parsePartialDate(raw) {
  const input = (raw || '').trim()
  if (!input) return { date: null, year: null }

  if (/^\d{4}$/.test(input)) {
    return { date: null, year: Number(input) }
  }

  let m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m.map(Number)
    if (!isValidCalendarDate(y, mo, d)) return null
    return { date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, year: y }
  }

  m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, mo, d, y] = m.map(Number)
    if (!isValidCalendarDate(y, mo, d)) return null
    return { date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, year: y }
  }

  return null
}

// The inverse of parsePartialDate, for pre-filling the text input from
// stored values: prefers the full date, falls back to just the year.
export function formatPartialDate(date, year) {
  if (date) return date
  if (year) return String(year)
  return ''
}
