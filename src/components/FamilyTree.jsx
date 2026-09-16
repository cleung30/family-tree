import { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react'
const NW=120,NH=50,HG=40,VG=80,SPG=20
const MIN_SCALE=0.3,MAX_SCALE=3
export default function FamilyTree({people,relationships,selectedId,onSelect,focusRequest}){
  const [pan,setPan]=useState({x:0,y:0})
  const [drag,setDrag]=useState(null)
  const [scale,setScale]=useState(1)
  const svgRef=useRef(null)
  const fittedRef=useRef(false)
  const interactedRef=useRef(false)
  const pinchRef=useRef(null)
  const {nodes,edges}=useMemo(()=>buildLayout(people,relationships),[people,relationships])
  const fitToView=()=>{
    const el=svgRef.current
    if(!el||!nodes.length)return
    const rect=el.getBoundingClientRect()
    if(!rect.width||!rect.height)return
    const minX=Math.min(...nodes.map(n=>n.x))-NW/2
    const maxX=Math.max(...nodes.map(n=>n.x))+NW/2
    const minY=Math.min(...nodes.map(n=>n.y))-NH/2
    const s=Math.min(1,Math.max(0.35,(rect.width*0.9)/(maxX-minX)))
    setScale(s)
    setPan({x:rect.width/2-((minX+maxX)/2)*s,y:36-minY*s})
  }
  useLayoutEffect(()=>{
    if(!fittedRef.current){fitToView();fittedRef.current=true}
  },[nodes])
  useEffect(()=>{
    const onResize=()=>{if(!interactedRef.current)fitToView()}
    window.addEventListener('resize',onResize)
    return ()=>window.removeEventListener('resize',onResize)
  },[nodes])
  useEffect(()=>{
    if(!focusRequest)return
    const n=nodes.find(n=>n.id===focusRequest.id)
    const el=svgRef.current
    if(!n||!el)return
    const rect=el.getBoundingClientRect()
    const sidebarW=Math.min(280,rect.width*0.88)
    interactedRef.current=true
    setScale(prev=>{
      const s=Math.max(prev,0.8)
      setPan({x:(rect.width-sidebarW)/2-n.x*s,y:rect.height/2-n.y*s})
      return s
    })
  },[focusRequest])
  useEffect(()=>{
    const el=svgRef.current
    if(!el)return
    const onWheel=e=>{
      e.preventDefault()
      interactedRef.current=true
      const rect=el.getBoundingClientRect()
      const cx=e.clientX-rect.left, cy=e.clientY-rect.top
      const raw=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*800:e.deltaY
      const dy=Math.max(-100,Math.min(100,raw))
      const factor=Math.exp(-dy*0.0015)
      setScale(prevScale=>{
        const newScale=Math.min(MAX_SCALE,Math.max(MIN_SCALE,prevScale*factor))
        const applied=newScale/prevScale
        if(applied!==1){
          setPan(prevPan=>({
            x:cx-(cx-prevPan.x)*applied,
            y:cy-(cy-prevPan.y)*applied,
          }))
        }
        return newScale
      })
    }
    el.addEventListener('wheel',onWheel,{passive:false})
    return ()=>el.removeEventListener('wheel',onWheel)
  },[])
  if(!people.length)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#9ca3af',fontSize:16}}>No family members yet. Click "+ Add Member" to start.</div>
  const onMD=e=>{if(e.target.closest('.tn'))return;interactedRef.current=true;setDrag({sx:e.clientX-pan.x,sy:e.clientY-pan.y})}
  const onMM=e=>{if(!drag)return;setPan({x:e.clientX-drag.sx,y:e.clientY-drag.sy})}
  const onMU=()=>setDrag(null)
  const onTS=e=>{
    if(e.target.closest('.tn'))return
    interactedRef.current=true
    if(e.touches.length===2){
      setDrag(null)
      const[a,b]=e.touches
      const rect=svgRef.current.getBoundingClientRect()
      pinchRef.current={
        dist:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),
        mid:{x:(a.clientX+b.clientX)/2-rect.left,y:(a.clientY+b.clientY)/2-rect.top},
        startScale:scale,startPan:pan,
      }
    }else if(e.touches.length===1){
      pinchRef.current=null
      const t=e.touches[0]
      setDrag({sx:t.clientX-pan.x,sy:t.clientY-pan.y})
    }
  }
  const onTM=e=>{
    if(e.touches.length===2&&pinchRef.current){
      const[a,b]=e.touches
      const{dist:startDist,mid,startScale,startPan}=pinchRef.current
      const dist=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)
      const newScale=Math.min(MAX_SCALE,Math.max(MIN_SCALE,startScale*(dist/startDist)))
      const applied=newScale/startScale
      setScale(newScale)
      setPan({x:mid.x-(mid.x-startPan.x)*applied,y:mid.y-(mid.y-startPan.y)*applied})
      return
    }
    if(!drag||e.touches.length!==1)return
    const t=e.touches[0]
    setPan({x:t.clientX-drag.sx,y:t.clientY-drag.sy})
  }
  const onTE=e=>{setDrag(null);if(e.touches.length<2)pinchRef.current=null}
  return(
    <>
    <svg ref={svgRef} width="100%" height="100%" onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onTouchCancel={onTE} style={{cursor:drag?'grabbing':'grab',userSelect:'none',touchAction:'none'}}>
      <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
        {edges.map((e,i)=><line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.type==='spouse'?'#f59e0b':'#6b7280'} strokeWidth={1.5} strokeDasharray={e.type==='spouse'?'5,4':undefined}/>)}
        {nodes.map(n=>{
          const p=people.find(p=>p.id===n.id);if(!p)return null
          const sel=p.id===selectedId
          return(
            <g key={n.id} className="tn" transform={`translate(${n.x},${n.y})`} onClick={()=>onSelect(p)} style={{cursor:'pointer'}}>
              <rect x={-NW/2} y={-NH/2} width={NW} height={NH} rx={8}
                fill={sel?'#6b3a1f':p.gender==='f'?'#fce7f3':p.gender==='m'?'#dbeafe':'#f3f4f6'}
                stroke={sel?'#6b3a1f':'#d1d5db'} strokeWidth={sel?2:1}/>
              <text x={0} y={-6} textAnchor="middle" fontSize={12} fontWeight={600} fill={sel?'#fff':'#1f2937'}>{p.first_name} {p.last_name}</text>
              <text x={0} y={10} textAnchor="middle" fontSize={11} fill={sel?'#ddd':'#6b7280'}>{p.chinese_name||(p.birth_year?`b.${p.birth_year}`:'')}</text>
            </g>
          )
        })}
      </g>
    </svg>
    <button onClick={()=>{interactedRef.current=false;fitToView()}} title="Reset view" style={{position:'absolute',bottom:16,right:16,width:40,height:40,borderRadius:'50%',border:'1px solid #d1d5db',background:'#fff',color:'#6b3a1f',fontSize:18,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>⤢</button>
    </>
  )
}
export function speak(text,lang){
  if(!('speechSynthesis' in window))return
  window.speechSynthesis.cancel()
  const u=new SpeechSynthesisUtterance(text)
  if(lang)u.lang=lang
  window.speechSynthesis.speak(u)
}
export function buildLayout(people,relationships){
  if(!people.length)return{nodes:[],edges:[]}
  const childOf={},spouseOf={},parentOf={}
  for(const r of relationships){
    if(r.type==='parent'){
      if(!parentOf[r.person1_id])parentOf[r.person1_id]=[];parentOf[r.person1_id].push(r.person2_id)
      if(!childOf[r.person2_id])childOf[r.person2_id]=[];childOf[r.person2_id].push(r.person1_id)
    }else{
      if(!spouseOf[r.person1_id])spouseOf[r.person1_id]=[];spouseOf[r.person1_id].push(r.person2_id)
      if(!spouseOf[r.person2_id])spouseOf[r.person2_id]=[];spouseOf[r.person2_id].push(r.person1_id)
    }
  }
  const byId={};people.forEach(p=>{byId[p.id]=p})
  const allIds=people.map(p=>p.id)
  const byBirth=(a,b)=>((byId[a]?.birth_year??9999)-(byId[b]?.birth_year??9999))||a-b
  // Blood line = the eldest parentless ancestor and their descendants; everyone else married in.
  const rootId=allIds.filter(id=>!childOf[id]?.length&&parentOf[id]?.length).sort(byBirth)[0]??allIds[0]
  const blood=new Set()
  for(const stack=[rootId];stack.length;){
    const id=stack.pop()
    if(blood.has(id))continue
    blood.add(id);(parentOf[id]||[]).forEach(c=>stack.push(c))
  }
  // Each child is laid out under exactly one parent so it is never placed twice.
  const kidsFor=id=>[...new Set(parentOf[id]||[])].filter(c=>{
    const bp=(childOf[c]||[]).filter(p=>blood.has(p)).sort((a,b)=>a-b)
    return blood.has(c)&&(bp.length?bp[0]:(childOf[c]||[]).slice().sort((a,b)=>a-b)[0])===id
  }).sort(byBirth)
  const spousesFor=id=>[...new Set(spouseOf[id]||[])].filter(s=>!blood.has(s)).sort(byBirth)
  const unitW=id=>{const n=spousesFor(id).length;return (n+1)*NW+n*SPG}
  const width={},seen=new Set()
  const measure=id=>{
    if(seen.has(id))return width[id]=unitW(id)
    seen.add(id)
    const kids=kidsFor(id)
    const kw=kids.length?kids.reduce((s,k)=>s+measure(k),0)+(kids.length-1)*HG:0
    return width[id]=Math.max(unitW(id),kw)
  }
  const nodes=[],done=new Set()
  const place=(id,left,depth)=>{
    if(done.has(id))return
    done.add(id)
    const sp=spousesFor(id),uw=unitW(id),kids=kidsFor(id)
    const kw=kids.length?kids.reduce((s,k)=>s+width[k],0)+(kids.length-1)*HG:0
    const y=depth*(NH+VG),uL=left+(width[id]-uw)/2
    nodes.push({id,x:uL+NW/2,y})
    sp.forEach((s,i)=>nodes.push({id:s,x:uL+(i+1)*(NW+SPG)+NW/2,y}))
    let cx=left+(width[id]-kw)/2
    kids.forEach(k=>{place(k,cx,depth+1);cx+=width[k]+HG})
  }
  measure(rootId)
  place(rootId,-width[rootId]/2,0)
  const stray=allIds.filter(id=>!nodes.some(n=>n.id===id))
  if(stray.length){
    const sy=Math.max(...nodes.map(n=>n.y))+NH+VG,sw=stray.length*NW+(stray.length-1)*HG
    stray.forEach((id,i)=>nodes.push({id,x:-sw/2+i*(NW+HG)+NW/2,y:sy}))
  }
  const pm={};nodes.forEach(n=>{pm[n.id]=n})
  const edges=[]
  for(const r of relationships){
    if(r.type==='parent')continue
    const a=pm[r.person1_id],b=pm[r.person2_id];if(!a||!b)continue
    const[l,rt]=a.x<=b.x?[a,b]:[b,a]
    edges.push({x1:l.x+NW/2,y1:l.y,x2:rt.x-NW/2,y2:rt.y,type:'spouse'})
  }
  const families={}
  Object.keys(childOf).forEach(childId=>{
    const key=childOf[childId].slice().sort().join(',')
    if(!families[key])families[key]={parentIds:childOf[childId],children:[]}
    families[key].children.push(childId)
  })
  Object.values(families).forEach(fam=>{
    const parents=fam.parentIds.map(id=>pm[id]).filter(Boolean)
    const children=fam.children.map(id=>pm[id]).filter(Boolean)
    if(!parents.length||!children.length)return
    const trunkX=parents.reduce((s,p)=>s+p.x,0)/parents.length
    const trunkY=Math.max(...parents.map(p=>p.y+NH/2))
    const childTopY=Math.min(...children.map(c=>c.y-NH/2))
    const busY=(trunkY+childTopY)/2
    const xs=[trunkX,...children.map(c=>c.x)]
    edges.push({x1:trunkX,y1:trunkY,x2:trunkX,y2:busY,type:'parent'})
    edges.push({x1:Math.min(...xs),y1:busY,x2:Math.max(...xs),y2:busY,type:'parent'})
    children.forEach(c=>edges.push({x1:c.x,y1:busY,x2:c.x,y2:childTopY,type:'parent'}))
  })
  return{nodes,edges}
}
