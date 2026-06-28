import { useMemo, useState } from 'react'
const NW=120,NH=50,HG=40,VG=80
export default function FamilyTree({people,relationships,selectedId,onSelect}){
  const [pan,setPan]=useState({x:0,y:0})
  const [drag,setDrag]=useState(null)
  const {nodes,edges}=useMemo(()=>buildLayout(people,relationships),[people,relationships])
  if(!people.length)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#9ca3af',fontSize:16}}>No family members yet. Click "+ Add Member" to start.</div>
  const onMD=e=>{if(e.target.closest('.tn'))return;setDrag({sx:e.clientX-pan.x,sy:e.clientY-pan.y})}
  const onMM=e=>{if(!drag)return;setPan({x:e.clientX-drag.sx,y:e.clientY-drag.sy})}
  const onMU=()=>setDrag(null)
  return(
    <svg width="100%" height="100%" onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} style={{cursor:drag?'grabbing':'grab',userSelect:'none'}}>
      <g transform={`translate(${pan.x+400},${pan.y+60})`}>
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
    const a=pm[r.person1_id],b=pm[r.person2_id];if(!a||!b)continue
    if(r.type==='parent')edges.push({x1:a.x,y1:a.y+NH/2,x2:b.x,y2:b.y-NH/2,type:'parent'})
    else edges.push({x1:a.x+NW/2,y1:a.y,x2:b.x-NW/2,y2:b.y,type:'spouse'})
  }
  return{nodes,edges}
}
