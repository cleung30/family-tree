import { describe, it, expect } from 'vitest'
import { buildClaimRelationship } from './claimProfile'

describe('buildClaimRelationship', () => {
  it('makes the existing person the parent when the new person is their child', () => {
    expect(buildClaimRelationship(10, 'child', 5)).toEqual({ person1_id: 5, person2_id: 10, type: 'parent' })
  })

  it('makes the new person the parent when they are the existing person\'s parent', () => {
    expect(buildClaimRelationship(10, 'parent', 5)).toEqual({ person1_id: 10, person2_id: 5, type: 'parent' })
  })

  it('records a spouse relationship with the new person first', () => {
    expect(buildClaimRelationship(10, 'spouse', 5)).toEqual({ person1_id: 10, person2_id: 5, type: 'spouse' })
  })
})
