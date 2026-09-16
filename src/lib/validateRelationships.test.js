import { describe, it, expect } from 'vitest'
import { findRelationshipIssues } from './validateRelationships'

const person = (id, overrides = {}) => ({ id, first_name: `P${id}`, last_name: '', ...overrides })

describe('findRelationshipIssues', () => {
  it('finds nothing wrong with a clean two-generation tree', () => {
    const people = [
      person(1, { birth_year: 1950 }),
      person(2, { birth_year: 1952 }),
      person(3, { birth_year: 1980 }),
    ]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 2, type: 'spouse' },
      { id: 2, person1_id: 1, person2_id: 3, type: 'parent' },
      { id: 3, person1_id: 2, person2_id: 3, type: 'parent' },
    ]
    expect(findRelationshipIssues(people, relationships)).toEqual([])
  })

  it('flags a relationship pointing at a nonexistent person', () => {
    const issues = findRelationshipIssues([person(1)], [{ id: 1, person1_id: 1, person2_id: 99, type: 'parent' }])
    expect(issues.some(i => i.type === 'missing-person' && i.personIds.includes(99))).toBe(true)
  })

  it('flags a person listed as their own parent', () => {
    const issues = findRelationshipIssues([person(1)], [{ id: 1, person1_id: 1, person2_id: 1, type: 'parent' }])
    expect(issues).toEqual([expect.objectContaining({ type: 'self-relationship' })])
  })

  it('flags a duplicate parent edge', () => {
    const people = [person(1), person(2)]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 2, type: 'parent' },
      { id: 2, person1_id: 1, person2_id: 2, type: 'parent' },
    ]
    expect(findRelationshipIssues(people, relationships).some(i => i.type === 'duplicate-edge')).toBe(true)
  })

  it('flags a duplicate spouse pair regardless of column order', () => {
    const people = [person(1), person(2)]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 2, type: 'spouse' },
      { id: 2, person1_id: 2, person2_id: 1, type: 'spouse' },
    ]
    expect(findRelationshipIssues(people, relationships).some(i => i.type === 'duplicate-edge')).toBe(true)
  })

  it('flags two people each recorded as the other\'s parent', () => {
    const people = [person(1), person(2)]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 2, type: 'parent' },
      { id: 2, person1_id: 2, person2_id: 1, type: 'parent' },
    ]
    const issues = findRelationshipIssues(people, relationships)
    expect(issues.some(i => i.type === 'mutual-parents')).toBe(true)
  })

  it('flags a child with three recorded parents', () => {
    const people = [person(1), person(2), person(3), person(4)]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 4, type: 'parent' },
      { id: 2, person1_id: 2, person2_id: 4, type: 'parent' },
      { id: 3, person1_id: 3, person2_id: 4, type: 'parent' },
    ]
    const issues = findRelationshipIssues(people, relationships)
    expect(issues).toEqual([expect.objectContaining({ type: 'too-many-parents', personIds: expect.arrayContaining([4]) })])
  })

  it('detects a longer ancestor cycle', () => {
    const people = [person(1), person(2), person(3)]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 2, type: 'parent' },
      { id: 2, person1_id: 2, person2_id: 3, type: 'parent' },
      { id: 3, person1_id: 3, person2_id: 1, type: 'parent' },
    ]
    const issues = findRelationshipIssues(people, relationships)
    expect(issues.some(i => i.type === 'ancestor-cycle')).toBe(true)
  })

  it('flags the same pair recorded as both spouses and parent/child', () => {
    const people = [person(1), person(2)]
    const relationships = [
      { id: 1, person1_id: 1, person2_id: 2, type: 'spouse' },
      { id: 2, person1_id: 1, person2_id: 2, type: 'parent' },
    ]
    const issues = findRelationshipIssues(people, relationships)
    expect(issues.some(i => i.type === 'spouse-and-parent')).toBe(true)
  })

  it('flags a parent born the same year or after their child', () => {
    const people = [person(1, { birth_year: 2000 }), person(2, { birth_year: 1990 })]
    const relationships = [{ id: 1, person1_id: 1, person2_id: 2, type: 'parent' }]
    const issues = findRelationshipIssues(people, relationships)
    expect(issues.some(i => i.type === 'impossible-birth-order')).toBe(true)
  })

  it('flags a parent who died more than a year before the child was born', () => {
    const people = [person(1, { death_year: 1950 }), person(2, { birth_year: 1990 })]
    const relationships = [{ id: 1, person1_id: 1, person2_id: 2, type: 'parent' }]
    const issues = findRelationshipIssues(people, relationships)
    expect(issues.some(i => i.type === 'impossible-birth-order')).toBe(true)
  })

  it('does not flag a parent who died the year the child was born', () => {
    const people = [person(1, { death_year: 1990 }), person(2, { birth_year: 1990 })]
    const relationships = [{ id: 1, person1_id: 1, person2_id: 2, type: 'parent' }]
    expect(findRelationshipIssues(people, relationships)).toEqual([])
  })
})
