import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/accessRequest'

const bt = { padding: '6px 12px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }
const inp = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, width: '100%' }

export default function AccessRequestsModal({ session, onClose }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [decidingId, setDecidingId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('access_requests').select('*').order('requested_at', { ascending: false })
    setLoading(false)
    if (error) return setError(error.message)
    setRequests(data || [])
  }
  useEffect(() => { load() }, [])

  const pending = useMemo(() => requests.filter(r => r.status === 'pending'), [requests])
  const decided = useMemo(() => requests.filter(r => r.status !== 'pending').slice(0, 15), [requests])

  const decide = async (id, status, emailOverride) => {
    setDecidingId(id); setError('')
    const payload = { status, decided_by: session.user.email, decided_at: new Date().toISOString() }
    if (emailOverride !== undefined) payload.email = emailOverride ? normalizeEmail(emailOverride) : null
    const { error } = await supabase.from('access_requests').update(payload).eq('id', id)
    setDecidingId(null)
    if (error) return setError(error.message)
    load()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(480px, 92vw)', maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>🔑 Access Requests</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>People who asked to join without being invited by a family member. Approving lets them sign in; denying doesn't.</p>

        {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        {loading ? (
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Loading…</p>
        ) : (
          <>
            {!pending.length && <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 12 }}>No pending requests.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {pending.map(r => (
                <PendingRequestRow key={r.id} request={r} deciding={decidingId === r.id} onDecide={decide} />
              ))}
            </div>

            {!!decided.length && (
              <>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Recently decided</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {decided.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', fontSize: 12, color: '#6b7280' }}>
                      <span>{[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Unknown'}</span>
                      <span style={{ fontWeight: 600, color: r.status === 'approved' ? '#166534' : '#9ca3af', textTransform: 'capitalize' }}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PendingRequestRow({ request: r, deciding, onDecide }) {
  const [email, setEmail] = useState(r.email || '')

  return (
    <div style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(r.requested_at).toLocaleDateString()}</div>
          {r.relation && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{r.relation}</div>}
          {r.phone && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📞 {r.phone}</div>}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email (needed before they can sign in)"
            style={{ ...inp, marginTop: 6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onDecide(r.id, 'approved', email)} disabled={deciding} style={{ ...bt, background: '#4a0404', color: '#fff', opacity: deciding ? .6 : 1 }}>Approve</button>
          <button onClick={() => onDecide(r.id, 'denied')} disabled={deciding} style={{ ...bt, background: '#f3f4f6', color: '#dc2626', opacity: deciding ? .6 : 1 }}>Deny</button>
        </div>
      </div>
    </div>
  )
}
