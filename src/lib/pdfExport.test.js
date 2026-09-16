import { describe, it, expect } from 'vitest'
import { buildFamilyTreePdf } from './pdfExport'

describe('buildFamilyTreePdf', () => {
  it('produces a non-empty PDF blob with no tree image', () => {
    const people = [{ id: 1, first_name: 'Solo', last_name: 'X', birth_year: 1990 }]
    const blob = buildFamilyTreePdf(people, [], null)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('handles an empty tree without throwing', () => {
    const blob = buildFamilyTreePdf([], [], null)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(0)
  })
})
