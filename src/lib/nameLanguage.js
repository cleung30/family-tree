// Vietnamese uses Latin script but with diacritics no English name has, so
// unlike Cantonese vs. Mandarin (same characters either way) it can be told
// apart from the text alone.
const VIETNAMESE_DIACRITICS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

export function isVietnameseName(person) {
  return VIETNAMESE_DIACRITICS.test(`${person.first_name} ${person.last_name || ''}`)
}
