import { useMemo, useState } from 'react'
import { computeAllRelations } from '../lib/kinship'
import { speak } from './FamilyTree'

const GROUPS = [
  { key: 'up2', label: 'Grandparents & Great-Aunts/Uncles', test: d => d <= -2 },
  { key: 'up1', label: 'Parents, Aunts & Uncles', test: d => d === -1 },
  { key: 'same', label: 'Your Generation', test: d => d === 0 },
  { key: 'down1', label: 'Children, Nieces & Nephews', test: d => d === 1 },
  { key: 'down2', label: 'Grandchildren & Beyond', test: d => d >= 2 },
]
const birthKey = p => (p.birth_date ? p.birth_date : p.birth_year ? `${p.birth_year}-00-00` : '9999-99-99')
const sortLabel = p => `${p.first_name} ${p.last_name}`.toLowerCase()
const EGO_STORAGE_KEY = 'family-tree:terms-ego-id'

export default function FamilyTermsModal({ people, relationships, onClose }) {
  const [egoId, setEgoId] = useState(() => {
    try { return localStorage.getItem(EGO_STORAGE_KEY) || '' } catch { return '' }
  })
  const [query, setQuery] = useState('')
  const chooseEgo = id => {
    setEgoId(id)
    try { id ? localStorage.setItem(EGO_STORAGE_KEY, id) : localStorage.removeItem(EGO_STORAGE_KEY) } catch {}
  }
  const ego = people.find(p => p.id === Number(egoId))
  const sortedPeople = useMemo(() => [...people].sort((a, b) => sortLabel(a).localeCompare(sortLabel(b))), [people])
  const results = useMemo(() => {
    if (!ego) return []
    return computeAllRelations(ego.id, people, relationships)
  }, [ego, people, relationships])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return results
    return results.filter(({ person }) =>
      `${person.first_name} ${person.last_name}`.toLowerCase().includes(q) || (person.chinese_name || '').includes(query.trim())
    )
  }, [results, query])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(480px, 92vw)', maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Family Address Terms</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Cantonese terms (Jyutping pronunciation) for what to call each relative, based on your side of the family and birth order.</p>

        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Who are you?</label>
        <select value={egoId} onChange={e => chooseEgo(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginTop: 4, marginBottom: 12 }}>
          <option value="">Select yourself…</option>
          {sortedPeople.map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}{p.chinese_name ? ` (${p.chinese_name})` : ''}</option>
          ))}
        </select>

        {ego && (
          <>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter relatives…"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, marginBottom: 12 }}
            />
            {GROUPS.map(group => {
              const rows = filtered.filter(r => group.test(r.relation.generationDelta)).sort((a, b) => birthKey(a.person).localeCompare(birthKey(b.person)))
              if (!rows.length) return null
              return (
                <div key={group.key} style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#8a5a3a', marginBottom: 6 }}>{group.label}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {rows.map(({ person, relation }) => (
                      <div key={person.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: '#f9fafb', borderRadius: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{person.first_name} {person.last_name}</div>
                          {person.chinese_name && <div style={{ fontSize: 11, color: '#9ca3af' }}>{person.chinese_name}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {relation.han ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#6b3a1f' }}>{relation.han}</span>
                                <button onClick={() => speak(relation.han, 'zh-HK')} title="Pronounce" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>🔊</button>
                              </div>
                              <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>{relation.jyutping}</div>
                            </>
                          ) : null}
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{relation.english}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {!filtered.length && <p style={{ fontSize: 13, color: '#9ca3af' }}>No relatives found.</p>}
          </>
        )}
      </div>
    </div>
  )
}
