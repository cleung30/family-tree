// Small, honest facts about the tree to show on the landing page — derived
// from the actual data rather than anything hardcoded, so they stay correct
// as people are added.
export function earliestBirthYear(people) {
  const years = people.map(p => p.birth_year).filter(y => y != null)
  return years.length ? Math.min(...years) : null
}

export function survivingCount(people) {
  return people.filter(p => p.death_year == null).length
}
