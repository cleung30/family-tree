import { useMemo, useState, useRef, useEffect } from 'react'
const NW=120,NH=50,HG=40,VG=80
const MIN_SCALE=0.3,MAX_SCALE=3
export default function FamilyTree({people,relationships,selectedId,onSelect}){
  const [pan,setPan]=useState({x:0,y:0})
  const [drag,setDrag]=useState(null)
  const [scale,setScale]=useState(1)
  const svgRef=useRef(null)
  const {nodes,edges}=useMemo(()=>buildLayout(people,relationships),[people,relationships])
  useEffect(()=>{
    const el=svgRef.current
    if(!el)return
    const onWheel=e=>{
      e.preventDefault()
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
            x:cx-400-(cx-prevPan.x-400)*applied,
            y:cy-60-(cy-prevPan.y-60)*applied,
          }))
        }
        return newScale
      })
    }
    el.addEventListener('wheel',onWheel,{passive:false})
    return ()=>el.removeEventListener('wheel',onWheel)
  },[])
  if(!people.length)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#9ca3af',fontSize:16}}>No family members yet. Click "+ Add Member" to start.</div>
  const onMD=e=>{if(e.target.closest('.tn'))return;setDrag({sx:e.clientX-pan.x,sy:e.clientY-pan.y})}
  const onMM=e=>{if(!drag)return;setPan({x:e.clientX-drag.sx,y:e.clientY-drag.sy})}
  const onMU=()=>setDrag(null)
  const onTS=e=>{if(e.target.closest('.tn')||e.touches.length!==1)return;const t=e.touches[0];setDrag({sx:t.clientX-pan.x,sy:t.clientY-pan.y})}
  const onTM=e=>{if(!drag||e.touches.length!==1)return;const t=e.touches[0];setPan({x:t.clientX-drag.sx,y:t.clientY-drag.sy})}
  const onTE=()=>setDrag(null)
  return(
    <svg ref={svgRef} width="100%" height="100%" onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE} onTouchCancel={onTE} style={{cursor:drag?'grabbing':'grab',userSelect:'none',touchAction:'none'}}>
      <g transform={`translate(${pan.x+400},${pan.y+60}) scale(${scale})`}>
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
  )
}
export function speak(text,lang){
  if(!('speechSynthesis' in window))return
  window.speechSynthesis.cancel()
  const u=new SpeechSynthesisUtterance(text)
  if(lang)u.lang=lang
  window.speechSynthesis.speak(u)
}
function buildLayout(people,relationships){
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
  const gen={},visited=new Set()
  const ag=(id,g)=>{if(visited.has(id))return;visited.add(id);gen[id]=g;(parentOf[id]||[]).forEach(c=>ag(c,g+1));(spouseOf[id]||[]).forEach(s=>{if(!visited.has(s))ag(s,g)})}
  const allIds=people.map(p=>p.id)
  const roots=allIds.filter(id=>!childOf[id]||!childOf[id].length)
  ;(roots.length?roots:[allIds[0]]).forEach(r=>ag(r,0))
  allIds.forEach(id=>{if(gen[id]===undefined)gen[id]=0})
  const byGen={}
  allIds.forEach(id=>{const g=gen[id]??0;if(!byGen[g])byGen[g]=[];byGen[g].push(id)})
  const nodes=[]
  Object.keys(byGen).map(Number).sort((a,b)=>a-b).forEach((g,gi)=>{
    const ids=byGen[g],tw=ids.length*NW+(ids.length-1)*HG
    ids.forEach((id,i)=>nodes.push({id,x:-tw/2+i*(NW+HG)+NW/2,y:gi*(NH+VG)}))
  })
  const pm={};nodes.forEach(n=>{pm[n.id]=n})
  const edges=[]
  for(const r of relationships){
    if(r.type==='parent')continue
    const a=pm[r.person1_id],b=pm[r.person2_id];if(!a||!b)continue
    edges.push({x1:a.x+NW/2,y1:a.y,x2:b.x-NW/2,y2:b.y,type:'spouse'})
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
