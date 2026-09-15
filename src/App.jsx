import { useState, useEffect, useCallback } from 'react'
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
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase.from('people').update(data).eq('id', selected.id)
      if (error) return alert(error.message)
    }
    setModalMode(null); setSelected(null); load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this person and all their relationships?')) return
    await supabase.from('relationships').delete().or(`person1_id.eq.${id},person2_id.eq.${id}`)
    await supabase.from('people').delete().eq('id', id)
    setSelected(null); load()
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:18,color:'#888'}}>Loading family tree…</div>
  if (error) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:12}}><div style={{color:'#c00'}}>{error}</div><button onClick={load} style={btn}>Retry</button></div>

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <header style={{background:'#6b3a1f',color:'#fff',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700}}>Leung Family Tree</h1>
          <p style={{fontSize:12,opacity:0.7}}>{people.length} members</p>
        </div>
        <button onClick={() => { setSelected(null); setModalMode('add') }} style={{...btn,background:'#fff',color:'#6b3a1f'}}>+ Add Member</button>
      </header>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        <FamilyTree people={people} relationships={relationships} selectedId={selected?.id} onSelect={setSelected} />
        {selected && (
          <div style={{position:'absolute',top:0,right:0,width:280,height:'100%',background:'#fff',borderLeft:'1px solid #e5e7eb',padding:20,overflowY:'auto',boxShadow:'-4px 0 12px rgba(0,0,0,0.08)'}}>
            <button onClick={() => setSelected(null)} style={{position:'absolute',top:12,right:12,background:'none',border:'none',fontSize:18,color:'#888'}}>✕</button>
            {selected.photo_base64 && <img src={selected.photo_base64} alt="" style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',display:'block',margin:'0 auto 12px'}} />}
            <h2 style={{fontSize:18,fontWeight:700,textAlign:'center'}}>{selected.first_name} {selected.last_name}</h2>
            {selected.chinese_name && <p style={{textAlign:'center',color:'#888',fontSize:14}}>{selected.chinese_name}</p>}
            <div style={{textAlign:'center',marginTop:8}}>
              <button onClick={() => speak(selected)} style={{...btn,background:'#6b7280',padding:'6px 14px',fontSize:13}}>🔊 Speak Name</button>
            </div>
            <div style={{marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
              {selected.birth_year && <Info label="Born" value={selected.birth_year} />}
              {selected.death_year && <Info label="Died" value={selected.death_year} />}
              {selected.gender && <Info label="Gender" value={{m:'Male',f:'Female',o:'Other'}[selected.gender]||selected.gender} />}
              {selected.notes && <Info label="Notes" value={selected.notes} />}
            </div>
            <div style={{marginTop:20,display:'flex',gap:8}}>
              <button onClick={() => setModalMode('edit')} style={{...btn,flex:1}}>Edit</button>
              <button onClick={() => handleDelete(selected.id)} style={{...btn,flex:1,background:'#dc2626'}}>Delete</button>
            </div>
          </div>
        )}
      </div>
      {modalMode && (
        <PersonModal person={modalMode==='edit'?selected:null} people={people} relationships={relationships}
          onSave={handleSave} onClose={() => setModalMode(null)}
          onRelationshipSave={async (rel) => { const {error}=await supabase.from('relationships').insert([rel]); if(error)alert(error.message); else load() }}
          onRelationshipDelete={async (id) => { await supabase.from('relationships').delete().eq('id',id); load() }}
        />
      )}
    </div>
  )
}

function Info({label,value}) {
  return <div style={{display:'flex',gap:8}}><span style={{fontWeight:600,minWidth:60,color:'#6b7280',fontSize:13}}>{label}:</span><span style={{fontSize:13}}>{value}</span></div>
}
const btn = {padding:'8px 16px',borderRadius:6,border:'none',background:'#6b3a1f',color:'#fff',fontWeight:600,fontSize:14}
