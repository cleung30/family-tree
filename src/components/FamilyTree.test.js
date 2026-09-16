import { describe, it, expect } from 'vitest'
import { buildLayout } from './FamilyTree'

describe('buildLayout', () => {
  it('returns no nodes or edges for an empty tree', () => {
    expect(buildLayout([], [])).toEqual({ nodes: [], edges: [] })
  })

  it('places a single person with no edges', () => {
    const people = [{ id: 1, first_name: 'Solo', birth_year: 1990 }]
    const { nodes, edges } = buildLayout(people, [])
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(1)
    expect(edges).toHaveLength(0)
  })

  it('places a child below its parent with a parent-type edge', () => {
    const people = [
      { id: 1, first_name: 'Parent', birth_year: 1970 },
      { id: 2, first_name: 'Child', birth_year: 1995 },
    ]
    const relationships = [{ person1_id: 1, person2_id: 2, type: 'parent' }]
    const { nodes, edges } = buildLayout(people, relationships)
    const parent = nodes.find(n => n.id === 1)
    const child = nodes.find(n => n.id === 2)
    expect(child.y).toBeGreaterThan(parent.y)
    expect(edges.some(e => e.type === 'parent')).toBe(true)
    expect(edges.every(e => e.type === 'parent')).toBe(true)
  })

  it('places a spouse beside their partner with a spouse-type edge', () => {
    const people = [
      { id: 1, first_name: 'A', birth_year: 1970 },
      { id: 2, first_name: 'B', birth_year: 1972 },
    ]
    const relationships = [{ person1_id: 1, person2_id: 2, type: 'spouse' }]
    const { nodes, edges } = buildLayout(people, relationships)
    expect(nodes).toHaveLength(2)
    const a = nodes.find(n => n.id === 1)
    const b = nodes.find(n => n.id === 2)
    expect(a.y).toBe(b.y)
    expect(edges).toEqual([expect.objectContaining({ type: 'spouse' })])
  })

  it('lays out a person unreachable from the blood line as a stray, without erroring', () => {
    const people = [
      { id: 1, first_name: 'Parent', birth_year: 1970 },
      { id: 2, first_name: 'Child', birth_year: 1995 },
      { id: 3, first_name: 'Unconnected', birth_year: 1960 },
    ]
    const relationships = [{ person1_id: 1, person2_id: 2, type: 'parent' }]
    const { nodes } = buildLayout(people, relationships)
    expect(nodes.map(n => n.id).sort()).toEqual([1, 2, 3])
  })

  // A child recorded with two blood-line parents (e.g. cousins who married)
  // must still be placed exactly once, under the lower-id parent — otherwise
  // it would be double-counted in width measurement and drawn twice.
  it('places a child with two blood-line parents exactly once', () => {
    const people = [
      { id: 1, first_name: 'Grandparent', birth_year: 1940 },
      { id: 2, first_name: 'ChildA', birth_year: 1965 },
      { id: 3, first_name: 'ChildB', birth_year: 1967 },
      { id: 4, first_name: 'GrandchildOfBoth', birth_year: 1990 },
    ]
    const relationships = [
      { person1_id: 1, person2_id: 2, type: 'parent' },
      { person1_id: 1, person2_id: 3, type: 'parent' },
      { person1_id: 2, person2_id: 3, type: 'spouse' },
      { person1_id: 2, person2_id: 4, type: 'parent' },
      { person1_id: 3, person2_id: 4, type: 'parent' },
    ]
    const { nodes } = buildLayout(people, relationships)
    const idCounts = nodes.reduce((c, n) => ({ ...c, [n.id]: (c[n.id] || 0) + 1 }), {})
    expect(idCounts).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1 })
  })
})
