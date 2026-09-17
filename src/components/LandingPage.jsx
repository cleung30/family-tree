import { useState } from 'react'
import { earliestBirthYear, survivingCount } from '../lib/treeStats'
import { supabase } from '../lib/supabase'
import { normalizeEmail } from '../lib/accessRequest'

export default function LandingPage({ people, onEnter, session }) {
  const since = earliestBirthYear(people)
  const living = survivingCount(people)
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 20px',background:'#faf7f2',textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:16,background:'#4a0404',color:'#faf7f2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,fontWeight:700,marginBottom:20}}>梁</div>
      <h1 style={{fontSize:'clamp(28px, 6vw, 40px)',fontWeight:700,color:'#1f2937',marginBottom:10}}>Leung Family Tree</h1>
      <p style={{fontSize:16,color:'#6b7280',maxWidth:440,lineHeight:1.6,marginBottom:24}}>
        A living record of our family — who we are, where we came from, and how we're all connected. Explore the tree, look up what to call a relative, and help keep it up to date.
      </p>
      {session ? (
        <>
          {people.length > 0 && (
            <div style={{display:'flex',gap:24,marginBottom:32,flexWrap:'wrap',justifyContent:'center'}}>
              <Stat value={people.length} label="family members" />
              {living > 0 && <Stat value={living} label="with us today" />}
              {since != null && <Stat value={since} label="earliest record" />}
            </div>
          )}
          <button onClick={onEnter} style={{padding:'14px 32px',borderRadius:8,border:'none',background:'#4a0404',color:'#fff',fontWeight:700,fontSize:16,cursor:'pointer',boxShadow:'0 4px 12px rgba(74,4,4,0.25)'}}>
            View the Family Tree →
          </button>
        </>
      ) : (
        <SignIn />
      )}
    </div>
  )
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState('email') // email | checking | sent | pending | denied | request | requesting | requested
  const [error, setError] = useState('')

  const checkAndSend = async () => {
    if (!email.trim()) return setError('Enter your email')
    setError(''); setPhase('checking')
    const cleanEmail = normalizeEmail(email)
    const { data: status, error: statusError } = await supabase.rpc('check_access_status', { check_email: cleanEmail })
    if (statusError) { setPhase('email'); return setError(statusError.message) }
    if (status === 'allowed') {
      const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail, options: { emailRedirectTo: window.location.origin } })
      if (error) { setPhase('email'); return setError(error.message) }
      return setPhase('sent')
    }
    if (status === 'pending' || status === 'denied') return setPhase(status)
    setPhase('request')
  }

  const requestAccess = async () => {
    setError(''); setPhase('requesting')
    const { error } = await supabase.from('access_requests').insert([{ email: normalizeEmail(email), note: note.trim() || null }])
    if (error) { setPhase('request'); return setError(error.message) }
    setPhase('requested')
  }

  if (phase === 'sent') {
    return (
      <div style={{width:'100%',maxWidth:340}}>
        <p style={{fontSize:14,color:'#6b7280'}}>Check <strong>{normalizeEmail(email)}</strong> for a sign-in link.</p>
      </div>
    )
  }

  if (phase === 'pending') {
    return (
      <div style={{width:'100%',maxWidth:340}}>
        <p style={{fontSize:14,color:'#6b7280'}}>Your request to join is awaiting approval from an admin. Check back later, or ask a family member who's already signed in to invite you directly.</p>
      </div>
    )
  }

  if (phase === 'denied') {
    return (
      <div style={{width:'100%',maxWidth:340}}>
        <p style={{fontSize:14,color:'#6b7280'}}>That request to join wasn't approved. Ask a family member who's already signed in to invite you instead.</p>
      </div>
    )
  }

  if (phase === 'requested') {
    return (
      <div style={{width:'100%',maxWidth:340}}>
        <p style={{fontSize:14,color:'#6b7280'}}>Thanks — your request is in the queue for an admin to review. A family member who's already signed in can also invite you directly to skip the wait.</p>
      </div>
    )
  }

  if (phase === 'request') {
    return (
      <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:10}}>
        <p style={{fontSize:13,color:'#9ca3af',marginBottom:2}}>We don't recognize <strong>{normalizeEmail(email)}</strong> yet. Request access below, or ask a family member who's already signed in to invite you.</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="How are you related to the family? (optional)"
          rows={3}
          style={{padding:'12px 14px',border:'1px solid #d1d5db',borderRadius:8,fontSize:14,resize:'vertical'}}
        />
        {error && <div style={{color:'#dc2626',fontSize:13,background:'#fee2e2',padding:'8px 12px',borderRadius:6}}>{error}</div>}
        <button onClick={requestAccess} disabled={phase==='requesting'} style={{padding:'12px 24px',borderRadius:8,border:'none',background:'#4a0404',color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',opacity:phase==='requesting'?.6:1}}>
          {phase === 'requesting' ? 'Requesting…' : 'Request access'}
        </button>
        <button onClick={() => { setPhase('email'); setError('') }} style={{background:'none',border:'none',color:'#9ca3af',fontSize:12,cursor:'pointer'}}>Use a different email</button>
      </div>
    )
  }

  return (
    <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:10}}>
      <p style={{fontSize:13,color:'#9ca3af',marginBottom:2}}>This tree holds personal information about the family, so signing in is required to view it.</p>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && checkAndSend()}
        placeholder="you@example.com"
        style={{padding:'12px 14px',border:'1px solid #d1d5db',borderRadius:8,fontSize:15}}
        autoFocus
      />
      {error && <div style={{color:'#dc2626',fontSize:13,background:'#fee2e2',padding:'8px 12px',borderRadius:6}}>{error}</div>}
      <button onClick={checkAndSend} disabled={phase==='checking'} style={{padding:'12px 24px',borderRadius:8,border:'none',background:'#4a0404',color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',opacity:phase==='checking'?.6:1}}>
        {phase === 'checking' ? 'Checking…' : 'Continue'}
      </button>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div style={{fontSize:24,fontWeight:700,color:'#4a0404'}}>{value}</div>
      <div style={{fontSize:12,color:'#9ca3af',textTransform:'uppercase',letterSpacing:0.4}}>{label}</div>
    </div>
  )
}
