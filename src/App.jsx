import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import FamilyTree, { speak, exportTreeAsPng, exportTreeAsDataUrl } from './components/FamilyTree'
import PersonModal from './components/PersonModal'
import FamilyTermsModal from './components/FamilyTermsModal'
import CalendarModal from './components/CalendarModal'
import GroupsModal from './components/GroupsModal'
import LandingPage from './components/LandingPage'
import ClaimProfile from './components/ClaimProfile'
import { isVietnameseName, OTHER_NAME_LANGUAGES } from './lib/nameLanguage'
import { peopleToCsv } from './lib/csvExport'
import { generateGedcom } from './lib/gedcom'
import { buildPrintableHtml } from './lib/printableReport'

function photoStoragePath(url) {
  const marker = '/photos/'
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length)
}

const dateStamp = () => new Date().toISOString().slice(0, 10)

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadText(content, filename, mime) {
  downloadBlob(new Blob([content], { type: mime }), filename)
}

export default function App() {
  const [people, setPeople] = useState([])
  const [relationships, setRelationships] = useState([])
  const [groups, setGroups] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
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
  const [authChecking, setAuthChecking] = useState(true)
  const [isEditor, setIsEditor] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editorsOpen, setEditorsOpen] = useState(false)
  const [editorsList, setEditorsList] = useState([])
  const [editorsLoading, setEditorsLoading] = useState(false)
  const [editorsError, setEditorsError] = useState('')
  const [newEditorEmail, setNewEditorEmail] = useState('')
  const [newEditorRole, setNewEditorRole] = useState('editor')
  const [invitingEditor, setInvitingEditor] = useState(false)
  const [removingEditorEmail, setRemovingEditorEmail] = useState(null)
  const [showLanding, setShowLanding] = useState(true)
  const [termsOpen, setTermsOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarGroup, setCalendarGroup] = useState(null)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia('(max-width: 640px)').matches)
  const searchWrapRef = useRef(null)
  const exportWrapRef = useRef(null)
  const moreWrapRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = () => setIsNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthChecking(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setIsEditor(false); setIsAdmin(false); return }
    supabase.from('editors').select('role').eq('email', session.user.email).maybeSingle()
      .then(({ data }) => { setIsEditor(!!data); setIsAdmin(data?.role === 'admin') })
  }, [session])

  const signOut = async () => {
    await supabase.auth.signOut()
    setSelected(null); setModalMode(null); setShowLanding(true)
    setPeople([]); setRelationships([])
  }

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

  const myProfile = useMemo(() => people.find(p => p.claimed_by === session?.user.email) || null, [people, session])

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
      if (exportWrapRef.current && !exportWrapRef.current.contains(e.target)) setExportOpen(false)
      if (moreWrapRef.current && !moreWrapRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p, error: pe }, { data: r, error: re }, { data: g, error: ge }, { data: gm, error: gme }] = await Promise.all([
      supabase.from('people').select('*').order('id'),
      supabase.from('relationships').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('group_members').select('*'),
    ])
    const err = pe || re || ge || gme
    if (err) { setError(err.message); setLoading(false); return }
    setPeople(p || [])
    setRelationships(r || [])
    setGroups(g || [])
    setGroupMembers(gm || [])
    setLoading(false)
  }, [])

  // A lighter refresh for group membership changes made from within the
  // already-open Groups modal — reusing the full load() above would flip
  // `loading` and unmount the whole app (Groups modal included) behind
  // the full-screen "Loading family tree…" interstitial for what should
  // be a quiet background update.
  const reloadGroups = useCallback(async () => {
    const [{ data: g, error: ge }, { data: gm, error: gme }] = await Promise.all([
      supabase.from('groups').select('*'),
      supabase.from('group_members').select('*'),
    ])
    const err = ge || gme
    if (err) return setErrorMsg(err.message)
    setGroups(g || [])
    setGroupMembers(gm || [])
  }, [])

  useEffect(() => { if (session) load() }, [session, load])

  const handleSave = async (data) => {
    const previousPhoto = modalMode === 'edit' ? selected?.photo_url : null
    if (modalMode === 'add') {
      const { error } = await supabase.from('people').insert([data])
      if (error) return setErrorMsg(error.message)
    } else {
      const { error } = await supabase.from('people').update(data).eq('id', selected.id)
      if (error) return setErrorMsg(error.message)
    }
    if (previousPhoto && previousPhoto !== data.photo_url) deletePhoto(previousPhoto)
    setModalMode(null); setSelected(null); load()
  }

  const uploadPhoto = async (file, previousUrl) => {
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, file)
    if (error) throw error
    if (previousUrl) deletePhoto(previousUrl)
    return supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
  }

  const deletePhoto = async (url) => {
    const path = photoStoragePath(url)
    if (path) await supabase.storage.from('photos').remove([path])
  }

  const exportJson = () => downloadText(
    JSON.stringify({ exportedAt: new Date().toISOString(), people, relationships }, null, 2),
    `leung-family-tree-${dateStamp()}.json`, 'application/json'
  )
  const exportCsv = () => downloadText(peopleToCsv(people, relationships), `leung-family-tree-${dateStamp()}.csv`, 'text/csv;charset=utf-8')
  const exportGedcom = () => downloadText(generateGedcom(people, relationships), `leung-family-tree-${dateStamp()}.ged`, 'text/plain;charset=utf-8')
  const exportPng = async () => {
    try {
      const blob = await exportTreeAsPng(people, relationships)
      downloadBlob(blob, `leung-family-tree-${dateStamp()}.png`)
    } catch (err) { setErrorMsg(err.message || 'Failed to export image') }
  }
  const exportPdf = async () => {
    let treeImage = null
    try { treeImage = await exportTreeAsDataUrl(people, relationships) } catch { /* no members yet; directory-only PDF still works */ }
    try {
      // Lazy-loaded: jsPDF pulls in html2canvas/dompurify, which would
      // otherwise bloat the initial bundle for everyone who never exports a PDF.
      const { buildFamilyTreePdf } = await import('./lib/pdfExport')
      const blob = buildFamilyTreePdf(people, relationships, treeImage)
      downloadBlob(blob, `leung-family-tree-${dateStamp()}.pdf`)
    } catch (err) { setErrorMsg(err.message || 'Failed to export PDF') }
  }
  const printReport = () => {
    const win = window.open('', '_blank')
    if (!win) return setErrorMsg('Please allow pop-ups to print the family tree')
    win.document.write(buildPrintableHtml(people, relationships))
    win.document.close()
    win.focus()
    win.print()
  }

  const confirmDelete = async () => {
    const person = confirmTarget
    setDeleting(true)
    const { error } = await supabase.from('people').delete().eq('id', person.id)
    setDeleting(false)
    setConfirmTarget(null)
    if (error) return setErrorMsg(error.message)
    if (person.photo_url) deletePhoto(person.photo_url)
    setSelected(null); load()
  }

  if (authChecking) return <div style={{minHeight:'100vh',background:'#faf7f2'}} />
  if (!session) return <LandingPage people={[]} session={null} />
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:18,color:'#888'}}>Loading family tree…</div>
  if (error) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}><div style={{color:'#c00'}}>{error}</div><button onClick={load} style={btn}>Retry</button></div>
  if (!myProfile) return <ClaimProfile people={people} session={session} onClaimed={load} onSignOut={signOut} />
  if (showLanding) return <LandingPage people={people} session={session} onEnter={() => setShowLanding(false)} />

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <header style={{background:'#4a0404',color:'#fff',padding:'12px 20px',display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:8,background:'#faf7f2',color:'#4a0404',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,flexShrink:0}}>梁</div>
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
        <div ref={exportWrapRef} style={{position:'relative',flexShrink:0}}>
          <button onClick={() => setExportOpen(o => !o)} title="Export the family tree" style={{...btn,background:'#7a2e2e',color:'#fff'}}>⬇ Export</button>
          {exportOpen && (
            <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:'#fff',borderRadius:6,boxShadow:'0 4px 12px rgba(0,0,0,0.2)',overflow:'hidden',zIndex:20,minWidth:220}}>
              <ExportMenuItem label="JSON Backup" hint="Full data, for backup/restore" onClick={() => { exportJson(); setExportOpen(false) }} />
              <ExportMenuItem label="CSV Spreadsheet" hint="Opens in Excel/Sheets" onClick={() => { exportCsv(); setExportOpen(false) }} />
              <ExportMenuItem label="GEDCOM" hint="For genealogy software" onClick={() => { exportGedcom(); setExportOpen(false) }} />
              <ExportMenuItem label="Tree Image (PNG)" hint="Snapshot of the whole tree" onClick={() => { setExportOpen(false); exportPng() }} />
              <ExportMenuItem label="PDF Document" hint="Tree diagram + family directory" onClick={() => { setExportOpen(false); exportPdf() }} />
              <ExportMenuItem label="Printable Page" hint="Opens a print-ready page" last onClick={() => { setExportOpen(false); printReport() }} />
            </div>
          )}
        </div>
        {isNarrow ? (
          <div ref={moreWrapRef} style={{position:'relative',flexShrink:0}}>
            <button onClick={() => setMoreOpen(o => !o)} title="More actions" style={{...btn,background:'#7a2e2e',color:'#fff'}}>⋯</button>
            {moreOpen && (
              <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:'#fff',borderRadius:6,boxShadow:'0 4px 12px rgba(0,0,0,0.2)',overflow:'hidden',zIndex:20,minWidth:220,maxWidth:'calc(100vw - 32px)'}}>
                <ExportMenuItem label="称谓 Family Terms" onClick={() => { setTermsOpen(true); setMoreOpen(false) }} />
                <ExportMenuItem label="📅 Family Calendar" onClick={() => { setCalendarGroup(null); setCalendarOpen(true); setMoreOpen(false) }} />
                <ExportMenuItem label="👪 Family Groups" onClick={() => { setGroupsOpen(true); setMoreOpen(false) }} />
                {isEditor && <ExportMenuItem label="+ Add Member" onClick={() => { setSelected(null); setModalMode('add'); setMoreOpen(false) }} />}
                {isAdmin && <ExportMenuItem label="👥 Manage Editors" onClick={() => { openEditors(); setMoreOpen(false) }} />}
                <ExportMenuItem label={`${isEditor?'✓ ':''}${session.user.email}`} hint="Signed in · tap to sign out" last onClick={() => { signOut(); setMoreOpen(false) }} />
              </div>
            )}
          </div>
        ) : (
          <>
            <button onClick={() => setTermsOpen(true)} title="Look up what to call each relative" style={{...btn,background:'#7a2e2e',color:'#fff',flexShrink:0}}>称谓 Family Terms</button>
            <button onClick={() => { setCalendarGroup(null); setCalendarOpen(true) }} title="View and add family events" style={{...btn,background:'#7a2e2e',color:'#fff',flexShrink:0}}>📅 Calendar</button>
            <button onClick={() => setGroupsOpen(true)} title="Manage private family groups" style={{...btn,background:'#7a2e2e',color:'#fff',flexShrink:0}}>👪 Groups</button>
            {isEditor && <button onClick={() => { setSelected(null); setModalMode('add') }} style={{...btn,background:'#fff',color:'#4a0404',flexShrink:0}}>+ Add Member</button>}
            {isAdmin && <button onClick={openEditors} style={{...btn,background:'#7a2e2e',color:'#fff',flexShrink:0}}>👥 Manage Editors</button>}
            <button onClick={signOut} title={isEditor ? `Signed in as ${session.user.email}` : `Signed in as ${session.user.email} (view only)`} style={{...btn,background:'#7a2e2e',color:'#fff',flexShrink:0}}>{isEditor?'✓ ':''}{session.user.email} · Sign out</button>
          </>
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
            {selected.photo_url && <img src={selected.photo_url} alt="" style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',display:'block',margin:'0 auto 12px'}} />}
            <h2 style={{fontSize:18,fontWeight:700,textAlign:'center'}}>{selected.first_name} {selected.last_name}</h2>
            {selected.chinese_name && <p style={{textAlign:'center',color:'#888',fontSize:14}}>{selected.chinese_name}</p>}
            <div style={{textAlign:'center',marginTop:8,display:'flex',gap:8,justifyContent:'center'}}>
              <button onClick={() => speak(`${selected.first_name} ${selected.last_name}`, isVietnameseName(selected)?'vi-VN':'en-US')} style={{...btn,background:'#6b7280',padding:'6px 14px',fontSize:13}}>{isVietnameseName(selected)?'🔊 Tiếng Việt':'🔊 English'}</button>
              {selected.chinese_name && <button onClick={() => speak(selected.chinese_name, (OTHER_NAME_LANGUAGES[selected.chinese_name_lang]||OTHER_NAME_LANGUAGES.yue).voice)} style={{...btn,background:'#6b7280',padding:'6px 14px',fontSize:13}}>{(OTHER_NAME_LANGUAGES[selected.chinese_name_lang]||OTHER_NAME_LANGUAGES.yue).speakLabel}</button>}
            </div>
            <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
              {selected.birth_year && <Info label="Born" value={selected.birth_year} />}
              {selected.death_year && <Info label="Died" value={selected.death_year} />}
              {selected.gender && <Info label="Gender" value={{m:'Male',f:'Female',o:'Other'}[selected.gender]||selected.gender} />}
              {selected.email && <Info label="Email" value={selected.email} />}
              {selected.phone && <Info label="Phone" value={selected.phone} />}
              {selected.address && <Info label="Address" value={selected.address} />}
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
          onDeletePhoto={deletePhoto}
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
      {termsOpen && <FamilyTermsModal people={people} relationships={relationships} onClose={() => setTermsOpen(false)} />}
      {calendarOpen && (
        <CalendarModal
          session={session}
          isEditor={isEditor}
          people={people}
          groups={groups}
          groupMembers={groupMembers}
          groupFilter={calendarGroup}
          onClose={() => { setCalendarOpen(false); setCalendarGroup(null) }}
        />
      )}
      {groupsOpen && (
        <GroupsModal
          people={people}
          groups={groups}
          groupMembers={groupMembers}
          session={session}
          isEditor={isEditor}
          onChanged={reloadGroups}
          onOpenGroupCalendar={group => { setCalendarGroup(group); setGroupsOpen(false); setCalendarOpen(true) }}
          onClose={() => setGroupsOpen(false)}
        />
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
                      <div style={{fontSize:11,color:'#7a2e2e',textTransform:'uppercase',fontWeight:700}}>{e.role}</div>
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
function ExportMenuItem({label,hint,onClick,last}) {
  return (
    <button onClick={onClick} style={{display:'block',width:'100%',textAlign:'left',padding:'10px 14px',background:'none',border:'none',borderBottom:last?'none':'1px solid #f3f4f6',cursor:'pointer'}}>
      <div style={{fontSize:13,fontWeight:600,color:'#1f2937'}}>{label}</div>
      <div style={{fontSize:11,color:'#9ca3af'}}>{hint}</div>
    </button>
  )
}
const btn = {padding:'8px 16px',borderRadius:6,border:'none',background:'#4a0404',color:'#fff',fontWeight:600,fontSize:14}
