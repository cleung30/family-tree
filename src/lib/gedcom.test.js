import { describe, it, expect } from 'vitest'
import { generateGedcom } from './gedcom'

describe('generateGedcom', () => {
  it('produces just a header and trailer for an empty tree', () => {
    const ged = generateGedcom([], [])
    expect(ged).toBe(['0 HEAD', '1 SOUR FamilyTreeApp', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 TRLR'].join('\n'))
  })

  it('writes one FAM record for a child with two parents, with HUSB/WIFE by gender', () => {
    const people = [
      { id: 1, first_name: 'Dad', last_name: 'X', gender: 'm', birth_year: 1970 },
      { id: 2, first_name: 'Mom', last_name: 'X', gender: 'f', birth_year: 1972 },
      { id: 3, first_name: 'Kid', last_name: 'X', gender: 'm', birth_year: 2000 },
    ]
    const relationships = [
      { person1_id: 1, person2_id: 2, type: 'spouse' },
      { person1_id: 1, person2_id: 3, type: 'parent' },
      { person1_id: 2, person2_id: 3, type: 'parent' },
    ]
    const ged = generateGedcom(people, relationships)
    const lines = ged.split('\n')
    expect(lines.filter(l => /^0 @F\d+@ FAM$/.test(l))).toHaveLength(1)
    expect(ged).toContain('1 HUSB @I1@')
    expect(ged).toContain('1 WIFE @I2@')
    expect(ged).toContain('1 CHIL @I3@')
    expect(ged).toContain('1 FAMC @F1@')
  })

  it('gives a childless married couple their own FAM record', () => {
    const people = [
      { id: 1, first_name: 'A', last_name: 'X', gender: 'm' },
      { id: 2, first_name: 'B', last_name: 'X', gender: 'f' },
    ]
    const relationships = [{ person1_id: 1, person2_id: 2, type: 'spouse' }]
    const ged = generateGedcom(people, relationships)
    expect(ged.split('\n').filter(l => /^0 @F\d+@ FAM$/.test(l))).toHaveLength(1)
    expect(ged).toContain('1 HUSB @I1@')
    expect(ged).toContain('1 WIFE @I2@')
  })

  it('includes the Chinese name as an alternate NAME tag', () => {
    const people = [{ id: 1, first_name: 'John', last_name: 'Leung', chinese_name: '梁約翰' }]
    const ged = generateGedcom(people, [])
    expect(ged).toContain('1 NAME 梁約翰')
    expect(ged).toContain('2 TYPE aka')
  })
})
