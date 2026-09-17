import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/accessRequest'

const bt = { padding: '10px 20px', borderRadius: 8, border: 'none', background: '#4a0404', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
const inp = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15 }

export default function InviteModal({ session, onClose }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | invited | already
  const [error, setError] = useState('')

  const invite = async () => {
    if (!email.trim()) return setError('Enter an email address')
    setError(''); setStatus('sending')
    const cleanEmail = normalizeEmail(email)
    const { data: access, error: statusError } = await supabase.rpc('check_access_status', { check_email: cleanEmail })
    if (statusError) { setStatus('idle'); return setError(statusError.message) }
    if (access === 'allowed') return setStatus('already')
    const { error } = await supabase.from('access_requests').insert([{ email: cleanEmail, invited_by: session.user.email, status: 'approved' }])
    if (error) { setStatus('idle'); return setError(error.message) }
    setStatus('invited')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(400px, 92vw)', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>➕ Invite a Family Member</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Inviting someone lets them sign in right away — no admin approval needed.</p>

        {status === 'invited' && <p style={{ fontSize: 14, color: '#166534', background: '#f0fdf4', padding: '10px 12px', borderRadius: 8 }}>Invited! They can now sign in with that email.</p>}
        {status === 'already' && <p style={{ fontSize: 14, color: '#6b7280', background: '#f9fafb', padding: '10px 12px', borderRadius: 8 }}>That email already has access — no invite needed.</p>}

        {(status === 'idle' || status === 'sending') && (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && invite()}
              placeholder="them@example.com"
              style={{ ...inp, marginBottom: 8 }}
              autoFocus
            />
            {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6, marginBottom: 8 }}>{error}</div>}
            <button onClick={invite} disabled={status === 'sending'} style={{ ...bt, width: '100%', opacity: status === 'sending' ? .6 : 1 }}>
              {status === 'sending' ? 'Inviting…' : 'Send Invite'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
