import { describe, it, expect } from 'vitest'
import { normalizeEmail } from './accessRequest'

describe('normalizeEmail', () => {
  it('trims whitespace', () => {
    expect(normalizeEmail('  calvin@example.com  ')).toBe('calvin@example.com')
  })

  it('lowercases', () => {
    expect(normalizeEmail('Calvin@Example.COM')).toBe('calvin@example.com')
  })

  it('handles both at once', () => {
    expect(normalizeEmail('  Calvin@Example.COM ')).toBe('calvin@example.com')
  })

  it('handles empty and nullish input', () => {
    expect(normalizeEmail('')).toBe('')
    expect(normalizeEmail(null)).toBe('')
    expect(normalizeEmail(undefined)).toBe('')
  })
})
