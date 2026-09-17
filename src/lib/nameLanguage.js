// Vietnamese uses Latin script but with diacritics no English name has, so
// unlike Cantonese vs. Mandarin (same characters either way) it can be told
// apart from the text alone.
const VIETNAMESE_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

export function isVietnameseName(person) {
  return VIETNAMESE_DIACRITICS.test(`${person.first_name} ${person.last_name || ''}`)
}

// Languages a person's "other name" field (chinese_name/chinese_name_lang)
// can be recorded in — not everyone in the family has a Chinese name, some
// go by a Vietnamese name instead — each with its own speech-synthesis
// voice and pronounce-button label.
export const OTHER_NAME_LANGUAGES = {
  yue: { label: 'Cantonese', voice: 'zh-HK', speakLabel: '🔊 廣東話' },
  cmn: { label: 'Mandarin', voice: 'zh-CN', speakLabel: '🔊 普通話' },
  vi: { label: 'Vietnamese', voice: 'vi-VN', speakLabel: '🔊 Tiếng Việt' },
}
