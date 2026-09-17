import { useState } from 'react'
import { earliestBirthYear, survivingCount } from '../lib/treeStats'
import { supabase } from '../lib/supabase'

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
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    if (!email.trim()) return setError('Enter your email')
    setSending(true); setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
    setSending(false)
    if (error) return setError(error.message)
    setSent(true)
  }

  if (sent) {
    return (
      <div style={{width:'100%',maxWidth:340}}>
        <p style={{fontSize:14,color:'#6b7280'}}>Check <strong>{email}</strong> for a sign-in link.</p>
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
        onKeyDown={e => e.key === 'Enter' && send()}
        placeholder="you@example.com"
        style={{padding:'12px 14px',border:'1px solid #d1d5db',borderRadius:8,fontSize:15}}
        autoFocus
      />
      {error && <div style={{color:'#dc2626',fontSize:13,background:'#fee2e2',padding:'8px 12px',borderRadius:6}}>{error}</div>}
      <button onClick={send} disabled={sending} style={{padding:'12px 24px',borderRadius:8,border:'none',background:'#4a0404',color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer',opacity:sending?.6:1}}>
        {sending ? 'Sending…' : 'Send sign-in link'}
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
