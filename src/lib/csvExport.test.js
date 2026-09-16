import { describe, it, expect } from 'vitest'
import { peopleToCsv } from './csvExport'

describe('peopleToCsv', () => {
  it('returns just the header row for an empty tree', () => {
    const csv = peopleToCsv([], [])
    expect(csv.split('\r\n')).toHaveLength(1)
    expect(csv).toContain('First Name')
  })

  it('lists computed parent and spouse names, and quotes fields with commas', () => {
    const people = [
      { id: 1, first_name: 'Parent', last_name: 'One', gender: 'f', chinese_name_lang: 'cmn' },
      { id: 2, first_name: 'Spouse', last_name: 'Two', gender: 'm' },
      { id: 3, first_name: 'Child', last_name: 'Three', notes: 'Loves tea, coffee' },
    ]
    const relationships = [
      { person1_id: 1, person2_id: 2, type: 'spouse' },
      { person1_id: 1, person2_id: 3, type: 'parent' },
    ]
    const csv = peopleToCsv(people, relationships)
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('Mandarin')
    expect(lines[1]).toContain('Spouse Two') // Parent One's spouse
    expect(lines[3]).toContain('Parent One') // Child Three's parent
    expect(lines[3]).toContain('"Loves tea, coffee"')
  })
})
