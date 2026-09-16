import { earliestBirthYear, survivingCount } from '../lib/treeStats'

export default function LandingPage({ people, onEnter }) {
  const since = earliestBirthYear(people)
  const living = survivingCount(people)
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 20px',background:'#faf7f2',textAlign:'center'}}>
      <div style={{width:72,height:72,borderRadius:16,background:'#4a0404',color:'#faf7f2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,fontWeight:700,marginBottom:20}}>梁</div>
      <h1 style={{fontSize:'clamp(28px, 6vw, 40px)',fontWeight:700,color:'#1f2937',marginBottom:10}}>Leung Family Tree</h1>
      <p style={{fontSize:16,color:'#6b7280',maxWidth:440,lineHeight:1.6,marginBottom:24}}>
        A living record of our family — who we are, where we came from, and how we're all connected. Explore the tree, look up what to call a relative, and help keep it up to date.
      </p>
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
