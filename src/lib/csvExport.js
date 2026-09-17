import { OTHER_NAME_LANGUAGES } from './nameLanguage'

const GENDER_LABEL = { m: 'Male', f: 'Female', o: 'Other' }

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function formatSocials(socials) {
  if (!Array.isArray(socials) || !socials.length) return ''
  return socials.map(s => (s && typeof s === 'object' ? Object.values(s).filter(Boolean).join(': ') : String(s))).join('; ')
}

export function peopleToCsv(people, relationships) {
  const byId = {}
  people.forEach(p => { byId[p.id] = p })
  const nameOf = id => { const p = byId[id]; return p ? `${p.first_name} ${p.last_name || ''}`.trim() : '' }
  const parentsOf = {}, spousesOf = {}
  for (const r of relationships) {
    if (r.type === 'parent') {
      (parentsOf[r.person2_id] ??= []).push(r.person1_id)
    } else {
      (spousesOf[r.person1_id] ??= []).push(r.person2_id)
      ;(spousesOf[r.person2_id] ??= []).push(r.person1_id)
    }
  }
  const headers = ['ID', 'First Name', 'Last Name', 'Chinese/Vietnamese Name', 'Chinese/Vietnamese Name Reading', 'Gender', 'Birth Date', 'Birth Year', 'Birth City', 'Death Date', 'Death Year', 'Phone', 'Email', 'Address', 'Socials', 'Parents', 'Spouses', 'Notes']
  const rows = people.map(p => [
    p.id,
    p.first_name || '',
    p.last_name || '',
    p.chinese_name || '',
    OTHER_NAME_LANGUAGES[p.chinese_name_lang]?.label || '',
    GENDER_LABEL[p.gender] || '',
    p.birth_date || '',
    p.birth_year ?? '',
    p.birth_city || '',
    p.death_date || '',
    p.death_year ?? '',
    p.phone || '',
    p.email || '',
    p.address || '',
    formatSocials(p.socials),
    (parentsOf[p.id] || []).map(nameOf).join('; '),
    (spousesOf[p.id] || []).map(nameOf).join('; '),
    p.notes || '',
  ])
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n')
}
