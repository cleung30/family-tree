import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import FamilyTree, { speak } from './components/FamilyTree'
import PersonModal from './components/PersonModal'

export default function App() {
  const [people, setPeople] = useState([])
  const [relationships, setRelationships] = useState([])
  const [selected, setSelected] = useState(null)
  const [modalMode, setModalMode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [session, setSession] = useState(null)
  const [isEditor, setIsEditor] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authSending, setAuthSending] = useState(false)
  const [authSent, setAuthSent] = useState(false)
  const [authError, setAuthError] = useState('')
  const [editorsOpen, setEditorsOpen] = useState(false)
  const [editorsList, setEditorsList] = useState([])
  const [editorsLoading, setEditorsLoading] = useState(false)
  const [editorsError, setEditorsError] = useState('')
  const [newEditorEmail, setNewEditorEmail] = useState('')
  const [newEditorRole, setNewEditorRole] = useState('editor')
  const [invitingEditor, setInvitingEditor] = useState(false)
  const [removingEditorEmail, setRemovingEditorEmail] = useState(null)
  const searchWrapRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setIsEditor(false); setIsAdmin(false); return }
    supabase.from('editors').select('role').eq('email', session.user.email).maybeSingle()
      .then(({ data }) => { setIsEditor(!!data); setIsAdmin(data?.role === 'admin') })
  }, [session])

  const openAuth = () => { setAuthOpen(true); setAuthSent(false); setAuthEmail(''); setAuthError('') }
  const sendMagicLink = async () => {
    if (!authEmail.trim()) return setAuthError('Enter your email')
    setAuthSending(true); setAuthError('')
    const { error } = await supabase.auth.signInWithOtp({ email: authEmail.trim(), options: { emailRedirectTo: window.location.origin } })
    setAuthSending(false)
    if (error) return setAuthError(error.message)
    setAuthSent(true)
  }
  const signOut = async () => { await supabase.auth.signOut(); setSelected(null); setModalMode(null) }

  const openEditors = async () => {
    setEditorsOpen(true); setEditorsError(''); setNewEditorEmail(''); setNewEditorRole('editor')
    setEditorsLoading(true)
    const { data, error } = await supabase.from('editors').select('email, role').order('email')
    setEditorsLoading(false)
    if (error) return setEditorsError(error.message)
    setEditorsList(data || [])
  }
  const inviteEditor = async () => {
    const email = newEditorEmail.trim().toLowerCase()
    if (!email) return setEditorsError('Enter an email address')
    if (editorsList.some(e => e.email === email)) return setEditorsError('That email is already on the list')
    setInvitingEditor(true); setEditorsError('')
    const { data, error } = await supabase.from('editors').insert([{ email, role: newEditorRole }]).select().single()
    setInvitingEditor(false)
    if (error) return setEditorsError(error.message)
    setEditorsList(list => [...list, data].sort((a, b) => a.email.localeCompare(b.email)))
    setNewEditorEmail('')
  }
  const removeEditor = async (email) => {
    if (email === session?.user.email) return setEditorsError("You can't remove yourself")
    setRemovingEditorEmail(email); setEditorsError('')
    const { error } = await supabase.from('editors').delete().eq('email', email)
    setRemovingEditorEmail(null)
    if (error) return setEditorsError(error.message)
    setEditorsList(list => list.filter(e => e.email !== email))
  }

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return people.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.chinese_name || '').includes(searchQuery.trim())
    ).slice(0, 8)
  }, [searchQuery, people])

  const selectResult = (p) => {
    setSelected(p)
    setFocusRequest({ id: p.id, ts: Date.now() })
    setSearchQuery('')
    setDropdownOpen(false)
  }

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p, error: pe }, { data: r, error: re }] = await Promise.all([
      supabase.from('people').select('*').order('id'),
      supabase.from('relationships').select('*'),
    ])
    if (pe || re) { setError((pe || re).message); setLoading(false); return }
    setPeople(p || [])
    setRelationships(r || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    if (modalMode === 'add') {
      const { error } = await supabase.from('people').insert([data])
      if (error) return setErrorMsg(error.message)
    } else {
      const { error } = await supabase.from('people').update(data).eq('id', selected.id)
      if (error) return setErrorMsg(error.message)
    }
    setModalMode(null); setSelected(null); load()
  }

  const uploadPhoto = async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file)
    if (error) throw error
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), people, relationships }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leung-family-tree-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const confirmDelete = async () => {
    const person = confirmTarget
    setDeleting(true)
    const { error: re } = await supabase.from('relationships').delete().or(`person1_id.eq.${person.id},person2_id.eq.${person.id}`)
    const { error: pe } = re ? {} : await supabase.from('people').delete().eq('id', person.id)
    setDeleting(false)
    setConfirmTarget(null)
    if (re || pe) return setErrorMsg((re || pe).message)
    setSelected(null); load()
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:18,color:'#888'}}>Loading family tree…</div>
  if (error) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}><div style={{color:'#c00'}}>{error}</div><button onClick={load} style={btn}>Retry</button></div>

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <header style={{background:'#6b3a1f',color:'#fff',padding:'12px 20px',display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:8,background:'#faf7f2',color:'#6b3a1f',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,flexShrink:0}}>梁</div>
          <div>
            <h1 style={{fontSize:20,fontWeight:700,whiteSpace:'nowrap'}}>Leung Family Tree</h1>
            <p style={{fontSize:12,opacity:0.7}}>{people.length} members</p>
          </div>
        </div>
        <div ref={searchWrapRef} style={{position:'relative',flex:'1 1 200px',minWidth:140}}>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true) }}
            onFocus={() => { if (searchQuery.trim()) setDropdownOpen(true) }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setSearchQuery(''); setDropdownOpen(false) }
              else if (e.key === 'Enter' && searchResults.length) selectResult(searchResults[0])
            }}
            placeholder="Search family members…"
            style={{width:'100%',padding:'8px 12px',borderRadius:6,border:'none',fontSize:14,color:'#1f2937'}}
          />
          {dropdownOpen && searchQuery.trim() && (
            <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',borderRadius:6,boxShadow:'0 4px 12px rgba(0,0,0,0.2)',overflow:'hidden',overflowY:'auto',maxHeight:280,zIndex:20}}>
              {searchResults.length ? searchResults.map(p => (
                <div key={p.id} onMouseDown={() => selectResult(p)} style={{padding:'8px 12px',cursor:'pointer',color:'#1f2937',fontSize:14,borderBottom:'1px solid #f3f4f6'}}>
                  <div style={{fontWeight:600}}>{p.first_name} {p.last_name}</div>
                  {(p.chinese_name || p.birth_year) && <div style={{fontSize:12,color:'#888'}}>{[p.chinese_name, p.birth_year ? `b.${p.birth_year}` : null].filter(Boolean).join(' · ')}</div>}
                </div>
              )) : <div style={{padding:'8px 12px',color:'#9ca3af',fontSize:14}}>No matches</div>}
            </div>
          )}
        </div>
        <button onClick={exportData} title="Download a backup of all family data as JSON" style={{...btn,background:'#8a5a3a',color:'#fff',flexShrink:0}}>⬇ Export</button>
        {isEditor && <button onClick={() => { setSelected(null); setModalMode('add') }} style={{...btn,background:'#fff',color:'#6b3a1f',flexShrink:0}}>+ Add Member</button>}
        {isAdmin && <button onClick={openEditors} style={{...btn,background:'#8a5a3a',color:'#fff',flexShrink:0}}>👥 Manage Editors</button>}
        {session ? (
          <button onClick={signOut} title={isEditor ? `Signed in as ${session.user.email}` : `Signed in as ${session.user.email} (view only)`} style={{...btn,background:'#8a5a3a',color:'#fff',flexShrink:0}}>{isEditor?'✓ ':''}{session.user.email} · Sign out</button>
        ) : (
          <button onClick={openAuth} style={{...btn,background:'#8a5a3a',color:'#fff',flexShrink:0}}>Sign in to edit</button>
        )}
      </header>
      {errorMsg && (
        <div style={{background:'#fee2e2',color:'#991b1b',padding:'10px 20px',fontSize:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexShrink:0}}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{background:'none',border:'none',color:'#991b1b',fontSize:16,cursor:'pointer',flexShrink:0}}>✕</button>
        </div>
      )}
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        <FamilyTree people={people} relationships={relationships} selectedId={selected?.id} onSelect={setSelected} focusRequest={focusRequest} />
        {selected && (
          <div style={{position:'absolute',top:0,right:0,width:'min(280px, 88vw)',height:'100%',background:'#fff',borderLeft:'1px solid #e5e7eb',padding:20,overflowY:'auto',boxShadow:'-4px 0 12px rgba(0,0,0,0.08)'}}>
            <button onClick={() => setSelected(null)} style={{position:'absolute',top:12,right:12,background:'none',border:'none',fontSize:18,color:'#888'}}>✕</button>
            {selected.photo_base64 && <img src={selected.photo_base64} alt="" style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',display:'block',margin:'0 auto 12px'}} />}
            <h2 style={{fontSize:18,fontWeight:700,textAlign:'center'}}>{selected.first_name} {selected.last_name}</h2>
            {selected.chinese_name && <p style={{textAlign:'center',color:'#888',fontSize:14}}>{selected.chinese_name}</p>}
            <div style={{textAlign:'center',marginTop:8,display:'flex',gap:8,justifyContent:'center'}}>
              <button onClick={() => speak(`${selected.first_name} ${selected.last_name}`,'en-US')} style={{...btn,background:'#6b7280',padding:'6px 14px',fontSize:13}}>🔊 English</button>
              {selected.chinese_name && <button onClick={() => speak(selected.chinese_name,'zh-CN')} style={{...btn,background:'#6b7280',padding:'6px 14px',fontSize:13}}>🔊 中文</button>}
            </div>
            <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
              {selected.birth_year && <Info label="Born" value={selected.birth_year} />}
              {selected.death_year && <Info label="Died" value={selected.death_year} />}
              {selected.gender && <Info label="Gender" value={{m:'Male',f:'Female',o:'Other'}[selected.gender]||selected.gender} />}
              {selected.notes && <Info label="Notes" value={selected.notes} />}
            </div>
            {isEditor && (
              <div style={{marginTop:20,display:'flex',gap:8}}>
                <button onClick={() => setModalMode('edit')} style={{...btn,flex:1}}>Edit</button>
                <button onClick={() => setConfirmTarget(selected)} style={{...btn,flex:1,background:'#dc2626'}}>Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
      {modalMode && (
        <PersonModal person={modalMode==='edit'?selected:null} people={people} relationships={relationships}
          onSave={handleSave} onClose={() => setModalMode(null)}
          onUploadPhoto={uploadPhoto}
          onRelationshipSave={async (rel) => { const {error}=await supabase.from('relationships').insert([rel]); if(error)setErrorMsg(error.message); else load() }}
          onRelationshipDelete={async (id) => { const {error}=await supabase.from('relationships').delete().eq('id',id); if(error)setErrorMsg(error.message); else load() }}
        />
      )}
      {confirmTarget && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e => e.target===e.currentTarget && !deleting && setConfirmTarget(null)}>
          <div style={{background:'#fff',borderRadius:12,width:'min(360px, 90vw)',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <h2 style={{fontSize:16,fontWeight:700,marginBottom:8}}>Delete {confirmTarget.first_name} {confirmTarget.last_name}?</h2>
            <p style={{fontSize:14,color:'#6b7280',marginBottom:20}}>This removes them and all their relationships from the tree. This cannot be undone.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={() => setConfirmTarget(null)} disabled={deleting} style={{...btn,background:'#f3f4f6',color:'#374151',opacity:deleting?.6:1}}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} style={{...btn,background:'#dc2626',opacity:deleting?.6:1}}>{deleting?'Deleting…':'Delete'}</button>
            </div>
          </div>
        </div>
      )}
      {authOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e => e.target===e.currentTarget && setAuthOpen(false)}>
          <div style={{background:'#fff',borderRadius:12,width:'min(360px, 90vw)',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <h2 style={{fontSize:16,fontWeight:700,marginBottom:8}}>Sign in to edit</h2>
            {authSent ? (
              <>
                <p style={{fontSize:14,color:'#6b7280',marginBottom:20}}>Check <strong>{authEmail}</strong> for a sign-in link.</p>
                <div style={{display:'flex',justifyContent:'flex-end'}}>
                  <button onClick={() => setAuthOpen(false)} style={{...btn,background:'#f3f4f6',color:'#374151'}}>Close</button>
                </div>
              </>
            ) : (
              <>
                <p style={{fontSize:14,color:'#6b7280',marginBottom:12}}>Only people on the family editor list can make changes. Everyone else can still browse the tree.</p>
                <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && sendMagicLink()} placeholder="you@example.com" style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14,marginBottom:8}} autoFocus />
                {authError && <div style={{color:'#dc2626',fontSize:13,background:'#fee2e2',padding:'8px 12px',borderRadius:6,marginBottom:8}}>{authError}</div>}
                <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                  <button onClick={() => setAuthOpen(false)} disabled={authSending} style={{...btn,background:'#f3f4f6',color:'#374151',opacity:authSending?.6:1}}>Cancel</button>
                  <button onClick={sendMagicLink} disabled={authSending} style={{...btn,opacity:authSending?.6:1}}>{authSending?'Sending…':'Send magic link'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {editorsOpen && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e => e.target===e.currentTarget && setEditorsOpen(false)}>
          <div style={{background:'#fff',borderRadius:12,width:'min(420px, 90vw)',maxHeight:'85vh',overflowY:'auto',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <h2 style={{fontSize:16,fontWeight:700}}>Manage Editors</h2>
              <button onClick={() => setEditorsOpen(false)} style={{background:'none',border:'none',fontSize:20,color:'#6b7280',cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:13,color:'#6b7280',marginBottom:12}}>Admins can add and remove people from the tree, plus invite or revoke other editors/admins. Editors can add and remove people but can't manage who else has access.</p>
            {editorsLoading ? (
              <p style={{fontSize:14,color:'#9ca3af'}}>Loading…</p>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                {editorsList.map(e => (
                  <div key={e.email} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'#f9fafb',borderRadius:6}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>{e.email}</div>
                      <div style={{fontSize:11,color:'#8a5a3a',textTransform:'uppercase',fontWeight:700}}>{e.role}</div>
                    </div>
                    <button onClick={() => removeEditor(e.email)} disabled={removingEditorEmail===e.email || e.email===session?.user.email} title={e.email===session?.user.email?"You can't remove yourself":'Revoke access'} style={{background:'none',border:'none',color:'#dc2626',fontSize:12,cursor:'pointer',opacity:(removingEditorEmail===e.email||e.email===session?.user.email)?.4:1}}>{removingEditorEmail===e.email?'Removing…':'Remove'}</button>
                  </div>
                ))}
              </div>
            )}
            {editorsError && <div style={{color:'#dc2626',fontSize:13,background:'#fee2e2',padding:'8px 12px',borderRadius:6,marginBottom:8}}>{editorsError}</div>}
            <div style={{display:'flex',gap:8,borderTop:'1px solid #e5e7eb',paddingTop:12}}>
              <input type="email" value={newEditorEmail} onChange={e => setNewEditorEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && inviteEditor()} placeholder="new-editor@example.com" style={{flex:1,padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}} />
              <select value={newEditorRole} onChange={e => setNewEditorRole(e.target.value)} style={{padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={inviteEditor} disabled={invitingEditor} style={{...btn,flexShrink:0,opacity:invitingEditor?.6:1}}>{invitingEditor?'Adding…':'Invite'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({label,value}) {
  return <div style={{display:'flex',gap:8}}><span style={{fontWeight:600,minWidth:60,color:'#6b7280',fontSize:13}}>{label}:</span><span style={{fontSize:13}}>{value}</span></div>
}
const btn = {padding:'8px 16px',borderRadius:6,border:'none',background:'#6b3a1f',color:'#fff',fontWeight:600,fontSize:14}
