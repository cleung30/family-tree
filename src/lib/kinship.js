// Cantonese (Hong Kong / Guangdong) family address terms, computed relative to
// a chosen "ego" person. Jyutping is given for pronunciation.
//
// The core idea: walk from ego up through parents to every reachable
// ancestor (tagging each step 'father'/'mother' by that parent's gender),
// then walk down from that ancestor through children to the target
// (tagging each step 'son'/'daughter'). The (up, down) distance plus those
// two tag paths is enough to look up the correct term:
//   - paternal vs maternal side = the FIRST up-step (ego's own father/mother)
//   - "internal" (堂, same-surname patriline) vs "external" (表) cousins =
//     father-side AND the connecting relative is male (father's BROTHER's kids)
//   - older/younger address terms come from comparing birth dates
// Spouses of blood relatives, and blood relatives of ego's spouse, are
// resolved as a second pass on top of this (in-law terms).

const term = (han, jyutping, english, extra = {}) => ({ han, jyutping, english, ...extra })

function buildFamilyGraph(people, relationships) {
  const parentsOf = {}, childrenOf = {}, spousesOf = {}
  for (const r of relationships) {
    if (r.type === 'parent') {
      // person1_id is the parent, person2_id is their child.
      (childrenOf[r.person1_id] ??= []).push(r.person2_id)
      ;(parentsOf[r.person2_id] ??= []).push(r.person1_id)
    } else {
      (spousesOf[r.person1_id] ??= []).push(r.person2_id)
      ;(spousesOf[r.person2_id] ??= []).push(r.person1_id)
    }
  }
  const byId = {}
  people.forEach(p => { byId[p.id] = p })
  return { parentsOf, childrenOf, spousesOf, byId }
}

const genderOf = (id, byId) => (byId[id]?.gender === 'f' ? 'f' : byId[id]?.gender === 'm' ? 'm' : null)
const birthKey = p => (p?.birth_date ? p.birth_date : p?.birth_year ? `${p.birth_year}-00-00` : null)
// true = a older than b, false = a younger, null = unknown (missing birth info)
function isOlder(aId, bId, byId) {
  const ak = birthKey(byId[aId]), bk = birthKey(byId[bId])
  if (ak == null || bk == null || ak === bk) return null
  return ak < bk
}

function ancestorMap(startId, graph, maxUp = 6) {
  const result = new Map([[startId, { dist: 0, path: [], ids: [] }]])
  let frontier = [startId]
  for (let d = 0; d < maxUp && frontier.length; d++) {
    const next = []
    for (const id of frontier) {
      const cur = result.get(id)
      for (const pid of graph.parentsOf[id] || []) {
        if (result.has(pid)) continue
        const step = genderOf(pid, graph.byId) === 'f' ? 'mother' : 'father'
        result.set(pid, { dist: d + 1, path: [...cur.path, step], ids: [...cur.ids, pid] })
        next.push(pid)
      }
    }
    frontier = next
  }
  return result
}
function descendantMap(startId, graph, maxDown = 6) {
  const result = new Map([[startId, { dist: 0, path: [], ids: [] }]])
  let frontier = [startId]
  for (let d = 0; d < maxDown && frontier.length; d++) {
    const next = []
    for (const id of frontier) {
      const cur = result.get(id)
      for (const cid of graph.childrenOf[id] || []) {
        if (result.has(cid)) continue
        const step = genderOf(cid, graph.byId) === 'f' ? 'daughter' : 'son'
        result.set(cid, { dist: d + 1, path: [...cur.path, step], ids: [...cur.ids, cid] })
        next.push(cid)
      }
    }
    frontier = next
  }
  return result
}

// Grandparent-generation base term (no 阿 prefix), by side + gender.
const GRANDPARENT_BASE = {
  father: { m: term('爺', 'je4', 'Paternal Grandfather'), f: term('嫲', 'maa4-2', 'Paternal Grandmother') },
  mother: { m: term('公', 'gung1', 'Maternal Grandfather'), f: term('婆', 'po4', 'Maternal Grandmother') },
}

function directLineTerm(up, down, upPath, downPath, targetId, byId) {
  const g = genderOf(targetId, byId)
  if (up === 0) {
    if (down === 1) return g === 'f' ? term('女', 'neoi2', 'Daughter', { category: 'child', meta: { gender: 'f' } }) : term('仔', 'zai2', 'Son', { category: 'child', meta: { gender: 'm' } })
    if (down === 2) {
      const viaSon = downPath[0] === 'son'
      const base = viaSon ? { han: '孫', jyut: 'syun1', label: "via son" } : { han: '外孫', jyut: 'ngoi6 syun1', label: 'via daughter' }
      return term(base.han + (g === 'f' ? '女' : '仔'), base.jyut + (g === 'f' ? ' neoi2' : ' zai2'), `Grandchild (${base.label})`)
    }
    if (down === 3) return term('曾孫' + (g === 'f' ? '女' : '仔'), 'zang1 syun1' + (g === 'f' ? ' neoi2' : ' zai2'), 'Great-grandchild')
    return null
  }
  if (down === 0) {
    if (up === 1) return g === 'f' ? term('媽媽', 'maa4 maa1', 'Mother', { category: 'parent', meta: { gender: 'f' } }) : term('爸爸', 'baa4 baa1', 'Father', { category: 'parent', meta: { gender: 'm' } })
    if (up === 2) {
      const base = GRANDPARENT_BASE[upPath[0]][g === 'f' ? 'f' : 'm']
      return term('阿' + base.han, 'aa3 ' + base.jyutping, base.english, { category: 'grandparent', meta: { side: upPath[0], gender: g } })
    }
    if (up === 3) {
      const base = GRANDPARENT_BASE[upPath[1]][g === 'f' ? 'f' : 'm']
      const lineNote = upPath[0] === 'father' ? 'paternal line' : 'maternal line'
      return term('太' + base.han, 'taai3 ' + base.jyutping, `Great-${base.english.replace('Paternal ', '').replace('Maternal ', '')} (${lineNote})`)
    }
    return null
  }
  return null
}

function classifyBlood(egoId, targetId, graph) {
  if (egoId === targetId) return null
  const { byId } = graph
  const ancestors = ancestorMap(egoId, graph)
  let best = null
  for (const [ancId, a] of ancestors) {
    const descendants = descendantMap(ancId, graph)
    if (!descendants.has(targetId)) continue
    const d = descendants.get(targetId)
    if (a.dist === 0 && d.dist === 0) continue
    const total = a.dist + d.dist
    if (!best || total < best.total) best = { up: a.dist, down: d.dist, upPath: a.path, upIds: a.ids, downPath: d.path, downIds: d.ids, ancId, total }
  }
  if (!best) return null
  const { up, down, upPath, upIds, downPath } = best
  const generationDelta = down - up

  const direct = directLineTerm(up, down, upPath, downPath, targetId, byId)
  if (direct) return { ...direct, generationDelta }

  const g = genderOf(targetId, byId)

  if (up === 1 && down === 1) {
    const shared = new Set(graph.parentsOf[egoId] || []).size && (graph.parentsOf[targetId] || []).filter(p => (graph.parentsOf[egoId] || []).includes(p)).length
    const half = shared === 1 ? ' (half-sibling)' : ''
    const older = isOlder(targetId, egoId, byId)
    let t
    if (g === 'f') t = older === true ? term('家姐', 'gaa1 ze2', 'Older Sister') : older === false ? term('妹妹', 'mui4 mui2', 'Younger Sister') : term('姊妹', 'zi2 mui6', 'Sister (age unknown)')
    else t = older === true ? term('哥哥', 'go4 go1', 'Older Brother') : older === false ? term('細佬', 'sai3 lou2', 'Younger Brother') : term('兄弟', 'hing1 dai6', 'Brother (age unknown)')
    return { ...t, english: t.english + half, generationDelta, category: 'sibling', meta: { gender: g, age: older } }
  }
  if (up === 1 && down === 2) {
    const viaBrother = downPath[0] === 'son'
    return viaBrother
      ? term(g === 'f' ? '姪女' : '姪仔', g === 'f' ? 'zat6 neoi2' : 'zat6 zai2', g === 'f' ? "Niece (brother's daughter)" : "Nephew (brother's son)", { generationDelta })
      : term(g === 'f' ? '外甥女' : '外甥', g === 'f' ? 'ngoi6 sang1 neoi2' : 'ngoi6 sang1', g === 'f' ? "Niece (sister's daughter)" : "Nephew (sister's son)", { generationDelta })
  }
  if (up === 1 && down === 3) {
    const viaBrother = downPath[0] === 'son'
    const base = viaBrother ? { han: '姪孫', jyut: 'zat6 syun1' } : { han: '外甥孫', jyut: 'ngoi6 sang1 syun1' }
    return term(base.han + (g === 'f' ? '女' : ''), base.jyut + (g === 'f' ? ' neoi2' : ''), `Grand-niece/nephew, approximate (via ${viaBrother ? "brother's" : "sister's"} line)`, { generationDelta })
  }
  if (up === 2 && down === 1) {
    const side = upPath[0]
    const parentOnSide = upIds[0]
    const older = isOlder(targetId, parentOnSide, byId)
    let t
    if (side === 'father' && g === 'm') t = older === true ? term('伯父', 'baak3 fu6', "Uncle (father's older brother)") : older === false ? term('阿叔', 'aa3 suk1', "Uncle (father's younger brother)") : term('叔叔', 'suk1 suk1', "Uncle (father's brother, age unknown)")
    else if (side === 'father' && g === 'f') t = older === true ? term('姑媽', 'gu1 maa1', "Aunt (father's older sister)") : older === false ? term('姑姐', 'gu1 ze2', "Aunt (father's younger sister)") : term('姑姐', 'gu1 ze2', "Aunt (father's sister, age unknown)")
    else if (side === 'mother' && g === 'm') t = term('舅父', 'kau5 fu6', "Uncle (mother's brother)")
    else t = older === true ? term('姨媽', 'yi4 maa1', "Aunt (mother's older sister)") : older === false ? term('阿姨', 'aa3 yi4', "Aunt (mother's younger sister)") : term('阿姨', 'aa3 yi4', "Aunt (mother's sister, age unknown)")
    return { ...t, generationDelta, category: 'auntUncle', meta: { side, gender: g, age: older } }
  }
  if (up === 2 && down === 2) {
    const side = upPath[0]
    const connectorMale = downPath[0] === 'son'
    const tong = side === 'father' && connectorMale
    const older = isOlder(targetId, egoId, byId)
    const table = tong
      ? { mOlder: term('堂兄', 'tong4 hing1', 'Older Cousin (paternal, father\'s brother\'s line)'), mYounger: term('堂弟', 'tong4 dai6', "Younger Cousin (paternal, father's brother's line)"), fOlder: term('堂姊', 'tong4 zi2', "Older Cousin (paternal, father's brother's line)"), fYounger: term('堂妹', 'tong4 mui6-2', "Younger Cousin (paternal, father's brother's line)") }
      : { mOlder: term('表哥', 'biu2 go4', 'Older Cousin'), mYounger: term('表弟', 'biu2 dai6', 'Younger Cousin'), fOlder: term('表姐', 'biu2 ze2', 'Older Cousin'), fYounger: term('表妹', 'biu2 mui6-2', 'Younger Cousin') }
    let t
    if (g === 'f') t = older === true ? table.fOlder : older === false ? table.fYounger : { ...table.fYounger, english: table.fYounger.english.replace('Younger', 'Cousin (age unknown)') }
    else t = older === true ? table.mOlder : older === false ? table.mYounger : { ...table.mYounger, english: table.mYounger.english.replace('Younger', 'Cousin (age unknown)') }
    return { ...t, generationDelta, category: 'cousin', meta: { tong, gender: g, age: older } }
  }
  if (up === 2 && down === 3) {
    const side = upPath[0]
    const tong = side === 'father' && downPath[0] === 'son'
    const prefix = tong ? '堂' : '表'
    const viaCousinBrother = downPath[1] === 'son'
    const base = viaCousinBrother ? prefix + '姪' + (g === 'f' ? '女' : '仔') : prefix + '外甥' + (g === 'f' ? '女' : '')
    return term(base, `${tong ? 'tong4' : 'biu2'} ...`, `Cousin's child, approximate (${tong ? 'paternal' : 'extended'} line)`, { generationDelta })
  }
  if (up === 3 && down === 1) {
    const internal = upPath[0] === 'father' && upPath[1] === 'father'
    const grandparentOnPath = upIds[1]
    const older = isOlder(targetId, grandparentOnPath, byId)
    let t
    if (internal && g === 'm') t = older === true ? term('伯公', 'baak3 gung1', "Great-Uncle (grandfather's older brother)") : older === false ? term('叔公', 'suk1 gung1', "Great-Uncle (grandfather's younger brother)") : term('叔公', 'suk1 gung1', "Great-Uncle (grandfather's brother, age unknown)")
    else if (internal && g === 'f') t = term('姑婆', 'gu1 po4-2', "Great-Aunt (grandfather's sister)")
    else if (g === 'm') t = term('舅公', 'kau5 gung1', 'Great-Uncle (grandmother\'s side)')
    else t = term('姨婆', 'yi4 po4-2', "Great-Aunt (grandmother's side)")
    return { ...t, generationDelta }
  }
  return { han: null, jyutping: null, english: fallbackLabel(up, down), generationDelta }
}

function fallbackLabel(up, down) {
  if (up > 0 && down > 0) return `Extended relative (${up} generation${up > 1 ? 's' : ''} up, ${down} generation${down > 1 ? 's' : ''} down)`
  if (up > 0) return `Ancestor, ${up} generations up`
  if (down > 0) return `Descendant, ${down} generations down`
  return 'Relative'
}

function spousalTransform(rel, generationDelta) {
  if (rel.category === 'sibling') {
    const { gender, age } = rel.meta
    if (gender === 'm' && age === true) return term('嫂嫂', 'sou2 sou2', "Sister-in-law (older brother's wife)", { generationDelta })
    if (gender === 'm') return term('弟婦', 'dai6 fu5', "Sister-in-law (younger brother's wife)", { generationDelta })
    if (age === true) return term('姐夫', 'ze2 fu1', "Brother-in-law (older sister's husband)", { generationDelta })
    return term('妹夫', 'mui6 fu1', "Brother-in-law (younger sister's husband)", { generationDelta })
  }
  if (rel.category === 'auntUncle') {
    const { side, gender, age } = rel.meta
    if (side === 'father' && gender === 'm' && age === true) return term('伯娘', 'baak3 noeng4', "Aunt (father's older brother's wife)", { generationDelta })
    if (side === 'father' && gender === 'm') return term('阿婶', 'aa3 sam2', "Aunt (father's younger brother's wife)", { generationDelta })
    if (side === 'father') return term('姑丈', 'gu1 zoeng6', "Uncle (father's sister's husband)", { generationDelta })
    if (gender === 'm') return term('舅母', 'kau5 mou5', "Aunt (mother's brother's wife)", { generationDelta })
    return term('姨丈', 'yi4 zoeng6', "Uncle (mother's sister's husband)", { generationDelta })
  }
  if (rel.category === 'child') {
    return rel.meta.gender === 'm' ? term('新抱', 'san1 pou5', "Daughter-in-law (son's wife)", { generationDelta }) : term('女婿', 'neoi5 sai3', "Son-in-law (daughter's husband)", { generationDelta })
  }
  return null
}

function inLawTransform(rel, egoGender, generationDelta) {
  if (rel.category === 'parent' && egoGender) {
    const male = rel.meta.gender === 'm'
    if (egoGender === 'm') return male ? term('外父', 'ngoi6 fu2', "Father-in-law (wife's father)", { generationDelta }) : term('外母', 'ngoi6 mou5', "Mother-in-law (wife's mother)", { generationDelta })
    return male ? term('老爺', 'lou5 je4', "Father-in-law (husband's father)", { generationDelta }) : term('奶奶', 'naai5 naai2', "Mother-in-law (husband's mother)", { generationDelta })
  }
  if (rel.category === 'sibling' && egoGender) {
    const { gender, age } = rel.meta
    const male = gender === 'm'
    if (egoGender === 'm') {
      if (male && age === true) return term('大舅', 'daai6 kau5', "Brother-in-law (wife's older brother)", { generationDelta })
      if (male) return term('舅仔', 'kau5 zai2', "Brother-in-law (wife's younger brother)", { generationDelta })
      if (age === true) return term('大姨', 'daai6 yi4', "Sister-in-law (wife's older sister)", { generationDelta })
      return term('姨仔', 'yi4 zai2', "Sister-in-law (wife's younger sister)", { generationDelta })
    }
    if (male && age === true) return term('大伯', 'daai6 baak3', "Brother-in-law (husband's older brother)", { generationDelta })
    if (male) return term('叔仔', 'suk1 zai2', "Brother-in-law (husband's younger brother)", { generationDelta })
    if (age === true) return term('大姑', 'daai6 gu1', "Sister-in-law (husband's older sister)", { generationDelta })
    return term('姑仔', 'gu1 zai2', "Sister-in-law (husband's younger sister)", { generationDelta })
  }
  return null
}

export function getRelationTerm(egoId, targetId, graph) {
  if (egoId === targetId) return null
  const { byId } = graph
  const blood = classifyBlood(egoId, targetId, graph)
  if (blood) return blood

  for (const sId of graph.spousesOf[targetId] || []) {
    if (sId === egoId) {
      const male = genderOf(targetId, byId) === 'm'
      return male ? term('老公', 'lou5 gung1', 'Husband', { generationDelta: 0 }) : term('老婆', 'lou5 po4', 'Wife', { generationDelta: 0 })
    }
    const rel = classifyBlood(egoId, sId, graph)
    if (rel) {
      const spousal = rel.category ? spousalTransform(rel, rel.generationDelta) : null
      if (spousal) return spousal
      return { han: null, jyutping: null, english: `${rel.english}'s spouse`, generationDelta: rel.generationDelta }
    }
  }

  const egoGender = genderOf(egoId, byId)
  for (const sId of graph.spousesOf[egoId] || []) {
    const rel = classifyBlood(sId, targetId, graph)
    if (rel) {
      const inlaw = inLawTransform(rel, egoGender, rel.generationDelta)
      if (inlaw) return inlaw
      return { han: null, jyutping: null, english: `Spouse's ${rel.english.toLowerCase()}`, generationDelta: rel.generationDelta }
    }
  }
  return null
}

export function computeAllRelations(egoId, people, relationships) {
  const graph = buildFamilyGraph(people, relationships)
  return people
    .filter(p => p.id !== egoId)
    .map(p => ({ person: p, relation: getRelationTerm(egoId, p.id, graph) }))
    .filter(r => r.relation)
}

export { buildFamilyGraph }
