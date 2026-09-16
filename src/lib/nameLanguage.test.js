import { describe, it, expect } from 'vitest'
import { isVietnameseName } from './nameLanguage'

describe('isVietnameseName', () => {
  it('detects diacritics in either the first or last name', () => {
    expect(isVietnameseName({ first_name: 'Nguyễn', last_name: 'Văn An' })).toBe(true)
    expect(isVietnameseName({ first_name: 'Anh', last_name: 'Đặng' })).toBe(true)
  })

  it('treats plain-ASCII names as English', () => {
    expect(isVietnameseName({ first_name: 'John', last_name: 'Leung' })).toBe(false)
  })

  it('handles a missing last name', () => {
    expect(isVietnameseName({ first_name: 'Solo', last_name: '' })).toBe(false)
  })
})
