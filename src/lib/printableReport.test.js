import { describe, it, expect } from 'vitest'
import { buildPrintableHtml } from './printableReport'

describe('buildPrintableHtml', () => {
  it('lists each person once, sorted by name, with their relationships summarized', () => {
    const people = [
      { id: 1, first_name: 'Bob', last_name: 'X', birth_year: 1970 },
      { id: 2, first_name: 'Alice', last_name: 'X', birth_year: 2000 },
    ]
    const relationships = [{ person1_id: 1, person2_id: 2, type: 'parent' }]
    const html = buildPrintableHtml(people, relationships)
    expect(html.indexOf('Alice')).toBeLessThan(html.indexOf('Bob'))
    expect(html).toContain('Parent of Alice X')
    expect(html).toContain('Child of Bob X')
    expect(html).toContain('2 members')
  })

  it('escapes HTML-significant characters in free text', () => {
    const people = [{ id: 1, first_name: 'A', last_name: '<script>', notes: 'x & y' }]
    const html = buildPrintableHtml(people, [])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('x &amp; y')
  })
})
