const SEX_TAG = { m: 'M', f: 'F', o: 'U' }

function gedcomText(s) {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim()
}

// Groups children by the sorted set of their recorded parents, same as the
// tree layout's family grouping, so a child with two recorded parents gets
// exactly one FAM record instead of one per parent.
function buildFamilies(people, relationships) {
  const parentsOf = {}
  for (const r of relationships) {
    if (r.type === 'parent') (parentsOf[r.person2_id] ??= []).push(r.person1_id)
  }
  const byParentKey = new Map()
  Object.keys(parentsOf).forEach(childId => {
    const parents = parentsOf[childId].slice().sort((a, b) => a - b)
    const key = parents.join(',')
    if (!byParentKey.has(key)) byParentKey.set(key, { parents, children: [] })
    byParentKey.get(key).children.push(Number(childId))
  })
  // A married couple with no recorded children together still gets a family.
  for (const r of relationships) {
    if (r.type !== 'spouse') continue
    const key = [r.person1_id, r.person2_id].sort((a, b) => a - b).join(',')
    if (!byParentKey.has(key)) byParentKey.set(key, { parents: key.split(',').map(Number), children: [] })
  }
  return [...byParentKey.values()].map((f, i) => ({ ...f, gedId: `F${i + 1}` }))
}

export function generateGedcom(people, relationships) {
  const byId = {}
  people.forEach(p => { byId[p.id] = p })
  const families = buildFamilies(people, relationships)
  const famsOf = {}, famcOf = {}
  families.forEach(f => {
    f.parents.forEach(pid => (famsOf[pid] ??= []).push(f.gedId))
    f.children.forEach(cid => { famcOf[cid] = f.gedId })
  })

  const lines = ['0 HEAD', '1 SOUR FamilyTreeApp', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8']

  people.forEach(p => {
    lines.push(`0 @I${p.id}@ INDI`)
    lines.push(`1 NAME ${gedcomText(p.first_name)} /${gedcomText(p.last_name)}/`)
    if (p.chinese_name) {
      lines.push(`1 NAME ${gedcomText(p.chinese_name)}`)
      lines.push('2 TYPE aka')
    }
    lines.push(`1 SEX ${SEX_TAG[p.gender] || 'U'}`)
    if (p.birth_date || p.birth_year || p.birth_city) {
      lines.push('1 BIRT')
      if (p.birth_date || p.birth_year) lines.push(`2 DATE ${p.birth_date || p.birth_year}`)
      if (p.birth_city) lines.push(`2 PLAC ${gedcomText(p.birth_city)}`)
    }
    if (p.death_date || p.death_year) {
      lines.push('1 DEAT')
      lines.push(`2 DATE ${p.death_date || p.death_year}`)
    }
    if (p.notes) lines.push(`1 NOTE ${gedcomText(p.notes)}`)
    if (famcOf[p.id]) lines.push(`1 FAMC @${famcOf[p.id]}@`)
    ;(famsOf[p.id] || []).forEach(famId => lines.push(`1 FAMS @${famId}@`))
  })

  families.forEach(f => {
    lines.push(`0 @${f.gedId}@ FAM`)
    // GEDCOM 5.5.1 only has HUSB/WIFE roles, which doesn't fit every family
    // shape (same-sex or unknown-gender couples); when genders don't clearly
    // sort into one of each, parents still get one HUSB and one WIFE line
    // (in their original order) so the file stays valid for other software.
    const parents = f.parents.length === 2
      ? [...f.parents].sort((a, b) => (byId[a]?.gender === 'f' ? 1 : 0) - (byId[b]?.gender === 'f' ? 1 : 0))
      : f.parents
    parents.forEach((pid, i) => {
      const tag = f.parents.length === 2 ? (i === 0 ? 'HUSB' : 'WIFE') : (byId[pid]?.gender === 'f' ? 'WIFE' : 'HUSB')
      lines.push(`1 ${tag} @I${pid}@`)
    })
    f.children.forEach(cid => lines.push(`1 CHIL @I${cid}@`))
  })

  lines.push('0 TRLR')
  return lines.join('\n')
}
