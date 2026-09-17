import { useState, useEffect, useRef } from 'react'
const MAX_UPLOAD_BYTES=15*1024*1024
async function resizeImage(file,maxDim=800,quality=0.85){
  const bitmap=await createImageBitmap(file)
  const scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height))
  const w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale)
  const canvas=document.createElement('canvas')
  canvas.width=w;canvas.height=h
  canvas.getContext('2d').drawImage(bitmap,0,0,w,h)
  return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality))
}
export default function PersonModal({person,people,relationships,onSave,onClose,onUploadPhoto,onDeletePhoto,onRelationshipSave,onRelationshipDelete}){
  const [form,setForm]=useState({first_name:'',last_name:'',chinese_name:'',chinese_name_lang:'yue',birth_year:'',death_year:'',gender:'m',email:'',phone:'',address:'',notes:'',photo_url:''})
  const [relType,setRelType]=useState('parent')
  const [relTarget,setRelTarget]=useState('')
  const [saving,setSaving]=useState(false)
  const [uploading,setUploading]=useState(false)
  const [addingRel,setAddingRel]=useState(false)
  const [removingRelId,setRemovingRelId]=useState(null)
  const [formError,setFormError]=useState('')
  // Tracks a photo uploaded this session that hasn't been saved to a person
  // record yet, so it can be cleaned up if replaced again or the modal is
  // closed without saving. The photo on the record being edited (if any)
  // is left alone here — App only deletes that one once a save confirms
  // it's no longer referenced.
  const pendingPhotoUrlRef=useRef(null)
  useEffect(()=>{if(person)setForm({first_name:person.first_name||'',last_name:person.last_name||'',chinese_name:person.chinese_name||'',chinese_name_lang:person.chinese_name_lang||'yue',birth_year:person.birth_year||'',death_year:person.death_year||'',gender:person.gender||'m',email:person.email||'',phone:person.phone||'',address:person.address||'',notes:person.notes||'',photo_url:person.photo_url||''})},[person])
  const myRels=person?relationships.filter(r=>r.person1_id===person.id||r.person2_id===person.id):[]
  const others=people.filter(p=>p.id!==person?.id)
  const isDuplicate=!person&&form.first_name.trim()&&people.some(p=>
    p.first_name.trim().toLowerCase()===form.first_name.trim().toLowerCase()&&
    (p.last_name||'').trim().toLowerCase()===(form.last_name||'').trim().toLowerCase()
  )
  const handlePhoto=async e=>{
    const f=e.target.files[0];if(!f)return
    if(!f.type.startsWith('image/'))return setFormError('Please choose an image file')
    if(f.size>MAX_UPLOAD_BYTES)return setFormError('Image is too large (max 15MB)')
    setFormError('');setUploading(true)
    try{
      const blob=await resizeImage(f)
      const resized=new File([blob],f.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'})
      const url=await onUploadPhoto(resized,pendingPhotoUrlRef.current)
      pendingPhotoUrlRef.current=url
      setForm(f=>({...f,photo_url:url}))
    }catch(err){setFormError(err.message||'Failed to process image')}
    setUploading(false)
  }
  const removePhoto=()=>{
    if(pendingPhotoUrlRef.current){onDeletePhoto(pendingPhotoUrlRef.current);pendingPhotoUrlRef.current=null}
    setForm(f=>({...f,photo_url:''}))
  }
  const handleClose=()=>{
    if(pendingPhotoUrlRef.current){onDeletePhoto(pendingPhotoUrlRef.current);pendingPhotoUrlRef.current=null}
    onClose()
  }
  const handleSave=async()=>{
    if(!form.first_name.trim())return setFormError('First name is required')
    setFormError('');setSaving(true)
    await onSave({...form,birth_year:form.birth_year?Number(form.birth_year):null,death_year:form.death_year?Number(form.death_year):null})
    setSaving(false)
  }
  const addRel=async()=>{
    if(!relTarget)return setFormError('Select a person')
    if(!person)return setFormError('Save this person first')
    setFormError('');setAddingRel(true)
    await onRelationshipSave({person1_id:person.id,person2_id:Number(relTarget),type:relType})
    setAddingRel(false)
    setRelTarget('')
  }
  const removeRel=async(id)=>{
    setRemovingRelId(id)
    await onRelationshipDelete(id)
    setRemovingRelId(null)
  }
  const getLabel=r=>{
    const o=people.find(p=>p.id===(r.person1_id===person.id?r.person2_id:r.person1_id))
    if(!o)return'?'
    const n=`${o.first_name} ${o.last_name}`
    return r.type==='spouse'?`💑 Spouse: ${n}`:r.person1_id===person.id?`👶 Parent of: ${n}`:`👴 Child of: ${n}`
  }
  const inp={width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:6,fontSize:14}
  const lbl={display:'block',fontSize:12,fontWeight:600,color:'#6b7280',marginBottom:4}
  const bt={padding:'8px 14px',borderRadius:6,border:'none',background:'#4a0404',color:'#fff',fontWeight:600,fontSize:14,cursor:'pointer'}
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={e=>e.target===e.currentTarget&&handleClose()}>
      <div style={{background:'#fff',borderRadius:12,width:'min(520px, 92vw)',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h2 style={{fontSize:18,fontWeight:700}}>{person?'Edit Member':'Add Member'}</h2>
          <button onClick={handleClose} style={{background:'none',border:'none',fontSize:20,color:'#6b7280',cursor:'pointer'}}>✕</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {form.photo_url?<img src={form.photo_url} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover'}}/>:<div style={{width:64,height:64,borderRadius:'50%',background:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>👤</div>}
            <label style={{...bt,background:'#f3f4f6',color:'#374151',fontSize:13,opacity:uploading?.6:1,pointerEvents:uploading?'none':'auto'}}>
              {uploading?'Uploading…':form.photo_url?'Change Photo':'Upload Photo'}
              <input type="file" accept="image/*" style={{display:'none'}} onChange={handlePhoto} disabled={uploading}/>
            </label>
            {form.photo_url&&<button onClick={removePhoto} style={{...bt,background:'#fee2e2',color:'#dc2626',fontSize:13}}>Remove</button>}
          </div>
          {formError&&<div style={{color:'#dc2626',fontSize:13,background:'#fee2e2',padding:'8px 12px',borderRadius:6}}>{formError}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={lbl}>First Name *</label><input value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Last Name</label><input value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} style={inp}/></div>
          </div>
          {isDuplicate&&<div style={{color:'#92400e',fontSize:13,background:'#fef3c7',padding:'8px 12px',borderRadius:6}}>⚠ "{`${form.first_name} ${form.last_name}`.trim()}" might already be in the tree — check this isn't a duplicate.</div>}
          <div>
            <label style={lbl}>Chinese Name</label>
            <div style={{display:'flex',gap:8}}>
              <input value={form.chinese_name} onChange={e=>setForm(f=>({...f,chinese_name:e.target.value}))} style={{...inp,flex:1}}/>
              <select value={form.chinese_name_lang} onChange={e=>setForm(f=>({...f,chinese_name_lang:e.target.value}))} title="How this name should be pronounced" style={{...inp,width:150,flex:'0 0 auto'}}>
                <option value="yue">Cantonese</option>
                <option value="cmn">Mandarin</option>
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={lbl}>Birth Year</label><input type="number" value={form.birth_year} onChange={e=>setForm(f=>({...f,birth_year:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Death Year</label><input type="number" value={form.death_year} onChange={e=>setForm(f=>({...f,death_year:e.target.value}))} style={inp}/></div>
          </div>
          <div><label style={lbl}>Gender</label><select value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))} style={inp}><option value="m">Male</option><option value="f">Female</option><option value="o">Other</option></select></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={lbl}>Email</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={inp}/></div>
            <div><label style={lbl}>Phone</label><input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inp}/></div>
          </div>
          <div><label style={lbl}>Address</label><input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} style={inp}/></div>
          <div><label style={lbl}>Notes</label><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}}/></div>
          {person&&(
            <div style={{borderTop:'1px solid #e5e7eb',paddingTop:14}}>
              <h3 style={{fontSize:14,fontWeight:600,marginBottom:10,color:'#374151'}}>Relationships</h3>
              {myRels.map(r=>(
                <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'#f9fafb',borderRadius:6,marginBottom:6}}>
                  <span style={{fontSize:13}}>{getLabel(r)}</span>
                  <button onClick={()=>removeRel(r.id)} disabled={removingRelId===r.id} style={{background:'none',border:'none',color:'#dc2626',fontSize:12,cursor:'pointer',opacity:removingRelId===r.id?.6:1}}>{removingRelId===r.id?'Removing…':'Remove'}</button>
                </div>
              ))}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <select value={relType} onChange={e=>setRelType(e.target.value)} style={{...inp,width:140,flex:'0 0 auto'}}><option value="parent">Parent of</option><option value="spouse">Spouse of</option></select>
                <select value={relTarget} onChange={e=>setRelTarget(e.target.value)} style={{...inp,flex:1}}><option value="">Select person…</option>{others.map(p=><option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select>
                <button onClick={addRel} disabled={addingRel} style={{...bt,flexShrink:0,opacity:addingRel?.6:1}}>{addingRel?'Adding…':'Add'}</button>
              </div>
            </div>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',gap:8}}>
          <button onClick={handleClose} style={{...bt,background:'#f3f4f6',color:'#374151'}}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{...bt,opacity:saving?.6:1}}>{saving?'Saving…':'Save'}</button>
        </div>
      </div>
    </div>
  )
}
