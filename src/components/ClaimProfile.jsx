import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { buildClaimRelationship } from '../lib/claimProfile'

const inp = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }
const bt = { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#4a0404', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }

export default function ClaimProfile({ people, session, onClaimed, onSignOut }) {
  const [query, setQuery] = useState('')
  const [claimingId, setClaimingId] = useState(null)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', relType: 'child', relatedId: '' })
  const [saving, setSaving] = useState(false)

  const unclaimed = useMemo(() => people.filter(p => !p.claimed_by), [people])
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return unclaimed.filter(p => `${p.first_name} ${p.last_name || ''}`.toLowerCase().includes(q)).slice(0, 8)
  }, [unclaimed, query])
  const sortedPeople = useMemo(() => [...people].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)), [people])

  const claim = async (person) => {
    setClaimingId(person.id); setError('')
    const { error } = await supabase.from('people').update({ claimed_by: session.user.email }).eq('id', person.id)
    setClaimingId(null)
    if (error) return setError(error.message)
    onClaimed()
  }

  const createProfile = async () => {
    if (!form.first_name.trim()) return setError('Enter your first name')
    setError(''); setSaving(true)
    const { data, error: insertError } = await supabase.from('people')
      .insert([{ first_name: form.first_name.trim(), last_name: form.last_name.trim(), claimed_by: session.user.email }])
      .select().single()
    if (insertError) { setSaving(false); return setError(insertError.message) }
    if (form.relatedId) {
      const rel = buildClaimRelationship(data.id, form.relType, Number(form.relatedId))
      const { error: relError } = await supabase.from('relationships').insert([rel])
      if (relError) { setSaving(false); return setError(relError.message) }
    }
    setSaving(false)
    onClaimed()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', background: '#faf7f2' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', marginBottom: 6, textAlign: 'center' }}>Which one of these is you?</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, textAlign: 'center' }}>Signed in as {session.user.email}. Link your account to your profile on the tree.</p>

        {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        {!showCreate ? (
          <>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your name…" style={{ ...inp, marginBottom: 8 }} autoFocus />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, maxHeight: 240, overflowY: 'auto' }}>
              {results.map(p => (
                <button key={p.id} onClick={() => claim(p)} disabled={claimingId === p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', opacity: claimingId === p.id ? .6 : 1, textAlign: 'left' }}>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                    {(p.chinese_name || p.birth_year) && <div style={{ fontSize: 12, color: '#9ca3af' }}>{[p.chinese_name, p.birth_year ? `b.${p.birth_year}` : null].filter(Boolean).join(' · ')}</div>}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4a0404', flexShrink: 0 }}>{claimingId === p.id ? 'Linking…' : 'This is me →'}</span>
                </button>
              ))}
              {query.trim() && !results.length && <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>No matches.</p>}
            </div>
            <button onClick={() => setShowCreate(true)} style={{ background: 'none', border: 'none', color: '#4a0404', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'block', margin: '0 auto' }}>Don't see your name? Create your profile</button>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name *" style={inp} autoFocus />
              <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Last name" style={inp} />
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Your relation (optional)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <select value={form.relType} onChange={e => setForm(f => ({ ...f, relType: e.target.value }))} style={{ ...inp, flex: '0 0 auto', width: 130 }}>
                <option value="child">Child of</option>
                <option value="parent">Parent of</option>
                <option value="spouse">Spouse of</option>
              </select>
              <select value={form.relatedId} onChange={e => setForm(f => ({ ...f, relatedId: e.target.value }))} style={{ ...inp, flex: 1 }}>
                <option value="">Select a family member…</option>
                {sortedPeople.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button onClick={() => setShowCreate(false)} style={{ ...bt, background: '#f3f4f6', color: '#374151' }}>Back</button>
              <button onClick={createProfile} disabled={saving} style={{ ...bt, opacity: saving ? .6 : 1 }}>{saving ? 'Creating…' : 'Create my profile'}</button>
            </div>
          </>
        )}

        <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', display: 'block', margin: '20px auto 0' }}>Wrong email? Sign out</button>
      </div>
    </div>
  )
}
