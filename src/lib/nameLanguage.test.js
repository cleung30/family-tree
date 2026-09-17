import { describe, it, expect } from 'vitest'
import { isVietnameseName, OTHER_NAME_LANGUAGES } from './nameLanguage'

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

describe('OTHER_NAME_LANGUAGES', () => {
  it('gives Cantonese, Mandarin, and Vietnamese each a distinct voice and label', () => {
    const codes = Object.keys(OTHER_NAME_LANGUAGES)
    expect(codes).toEqual(['yue', 'cmn', 'vi'])
    const voices = codes.map(c => OTHER_NAME_LANGUAGES[c].voice)
    expect(new Set(voices).size).toBe(voices.length)
    expect(OTHER_NAME_LANGUAGES.vi.voice).toBe('vi-VN')
  })
})
