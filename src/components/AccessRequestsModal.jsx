import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const bt = { padding: '6px 12px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer' }

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

  const decide = async (id, status) => {
    setDecidingId(id); setError('')
    const { error } = await supabase.from('access_requests').update({ status, decided_by: session.user.email, decided_at: new Date().toISOString() }).eq('id', id)
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
                <div key={r.id} style={{ padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{r.email}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(r.requested_at).toLocaleDateString()}</div>
                      {r.note && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{r.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => decide(r.id, 'approved')} disabled={decidingId === r.id} style={{ ...bt, background: '#4a0404', color: '#fff', opacity: decidingId === r.id ? .6 : 1 }}>Approve</button>
                      <button onClick={() => decide(r.id, 'denied')} disabled={decidingId === r.id} style={{ ...bt, background: '#f3f4f6', color: '#dc2626', opacity: decidingId === r.id ? .6 : 1 }}>Deny</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {!!decided.length && (
              <>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Recently decided</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {decided.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', fontSize: 12, color: '#6b7280' }}>
                      <span>{r.email}</span>
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
