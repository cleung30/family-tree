// Flags relationship-data problems that Postgres foreign keys and check
// constraints can't express: cycles, duplicate edges, contradictions between
// spouse/parent records, and biologically impossible birth/death years.
// Pure function over already-loaded rows so it can run both as a CLI check
// (scripts/validate-relationships.js) and in unit tests.
const name = p => `${p.first_name} ${p.last_name || ''}`.trim()
const pairKey = (a, b) => [a, b].sort((x, y) => x - y).join(',')

export function findRelationshipIssues(people, relationships) {
  const issues = []
  const byId = {}
  people.forEach(p => { byId[p.id] = p })
  const label = id => (byId[id] ? name(byId[id]) : `#${id} (missing)`)

  const parentOf = {} // parentOf[parentId] = [childId, ...]
  const childOf = {} // childOf[childId] = [parentId, ...]
  const spousePairs = new Set()
  const seenParentEdge = new Set()
  const seenSpousePair = new Set()

  for (const r of relationships) {
    if (!(r.person1_id in byId)) issues.push({ type: 'missing-person', message: `Relationship #${r.id ?? '?'} references person #${r.person1_id}, who doesn't exist`, personIds: [r.person1_id] })
    if (!(r.person2_id in byId)) issues.push({ type: 'missing-person', message: `Relationship #${r.id ?? '?'} references person #${r.person2_id}, who doesn't exist`, personIds: [r.person2_id] })
    if (r.person1_id === r.person2_id) {
      issues.push({ type: 'self-relationship', message: `${label(r.person1_id)} is listed as their own ${r.type}`, personIds: [r.person1_id] })
      continue
    }
    if (r.type === 'parent') {
      const key = `${r.person1_id}>${r.person2_id}`
      if (seenParentEdge.has(key)) issues.push({ type: 'duplicate-edge', message: `${label(r.person1_id)} is recorded as a parent of ${label(r.person2_id)} more than once`, personIds: [r.person1_id, r.person2_id] })
      seenParentEdge.add(key)
      ;(parentOf[r.person1_id] ??= []).push(r.person2_id)
      ;(childOf[r.person2_id] ??= []).push(r.person1_id)
    } else if (r.type === 'spouse') {
      const key = pairKey(r.person1_id, r.person2_id)
      if (seenSpousePair.has(key)) issues.push({ type: 'duplicate-edge', message: `${label(r.person1_id)} and ${label(r.person2_id)} are recorded as spouses more than once`, personIds: [r.person1_id, r.person2_id] })
      seenSpousePair.add(key)
      spousePairs.add(key)
    }
  }

  // Mutual parent edges (A parent of B AND B parent of A) are a 2-node cycle;
  // reported here with a clearer message than the general cycle check below.
  for (const key of seenParentEdge) {
    const [a, b] = key.split('>').map(Number)
    if (seenParentEdge.has(`${b}>${a}`) && a < b) {
      issues.push({ type: 'mutual-parents', message: `${label(a)} and ${label(b)} are each recorded as the other's parent`, personIds: [a, b] })
    }
  }

  // A biological child has at most two recorded parents.
  for (const [childId, parents] of Object.entries(childOf)) {
    const unique = [...new Set(parents)]
    if (unique.length > 2) {
      issues.push({ type: 'too-many-parents', message: `${label(Number(childId))} has ${unique.length} recorded parents (expected at most 2): ${unique.map(label).join(', ')}`, personIds: [Number(childId), ...unique] })
    }
  }

  // A person can't be their own ancestor.
  const state = {} // 0=unvisited,1=in-progress,2=done
  const findCycle = start => {
    const stack = [[start, [start]]]
    const visited = new Set()
    while (stack.length) {
      const [id, path] = stack.pop()
      for (const parentId of childOf[id] || []) {
        if (parentId === start) return [...path, parentId]
        if (visited.has(parentId)) continue
        visited.add(parentId)
        stack.push([parentId, [...path, parentId]])
      }
    }
    return null
  }
  const reportedCycle = new Set()
  for (const p of people) {
    if (state[p.id] === 2) continue
    const cycle = findCycle(p.id)
    if (cycle) {
      const key = pairKey(cycle[0], cycle[cycle.length - 1])
      if (!reportedCycle.has(key)) {
        reportedCycle.add(key)
        issues.push({ type: 'ancestor-cycle', message: `Ancestor cycle: ${cycle.map(label).join(' -> ')}`, personIds: [...new Set(cycle)] })
      }
    }
    state[p.id] = 2
  }

  // Spouse and parent/child are mutually exclusive between the same two people.
  for (const key of spousePairs) {
    const [a, b] = key.split(',').map(Number)
    if (seenParentEdge.has(`${a}>${b}`) || seenParentEdge.has(`${b}>${a}`)) {
      issues.push({ type: 'spouse-and-parent', message: `${label(a)} and ${label(b)} are recorded as both spouses and parent/child`, personIds: [a, b] })
    }
  }

  // A parent must be born before their child, and can't have died more than
  // roughly a year before the child was born.
  for (const [childId, parents] of Object.entries(childOf)) {
    const child = byId[Number(childId)]
    if (!child) continue
    for (const parentId of new Set(parents)) {
      const parent = byId[parentId]
      if (!parent) continue
      if (parent.birth_year != null && child.birth_year != null && parent.birth_year >= child.birth_year) {
        issues.push({ type: 'impossible-birth-order', message: `${label(parentId)} (b.${parent.birth_year}) can't be a parent of ${label(child.id)} (b.${child.birth_year}) — born the same year or after`, personIds: [parentId, child.id] })
      }
      if (parent.death_year != null && child.birth_year != null && parent.death_year < child.birth_year - 1) {
        issues.push({ type: 'impossible-birth-order', message: `${label(parentId)} (d.${parent.death_year}) can't be a parent of ${label(child.id)} (b.${child.birth_year}) — died before the child could have been born`, personIds: [parentId, child.id] })
      }
    }
  }

  return issues
}
