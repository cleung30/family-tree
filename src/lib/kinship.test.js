import { describe, it, expect } from 'vitest'
import { buildFamilyGraph, getRelationTerm, computeAllRelations } from './kinship'

// A small synthetic family, not the real data, covering the relation types
// that matter most: both sides of the family, birth-order splits, and
// paternal (堂) vs. extended (表) cousins.
const people = [
  { id: 1, first_name: 'GF', last_name: 'Paternal', gender: 'm', birth_year: 1950 },
  { id: 2, first_name: 'GM', last_name: 'Paternal', gender: 'f', birth_year: 1952 },
  { id: 3, first_name: 'Dad', last_name: 'X', gender: 'm', birth_year: 1975 },
  { id: 4, first_name: 'UncleOlder', last_name: 'X', gender: 'm', birth_year: 1972 },
  { id: 5, first_name: 'UncleOlderWife', last_name: 'X', gender: 'f', birth_year: 1973 },
  { id: 6, first_name: 'UncleYounger', last_name: 'X', gender: 'm', birth_year: 1980 },
  { id: 7, first_name: 'AuntPaternal', last_name: 'X', gender: 'f', birth_year: 1974 },
  { id: 10, first_name: 'MomGF', last_name: 'Maternal', gender: 'm', birth_year: 1945 },
  { id: 11, first_name: 'MomGM', last_name: 'Maternal', gender: 'f', birth_year: 1947 },
  { id: 12, first_name: 'Mom', last_name: 'Y', gender: 'f', birth_year: 1976 },
  { id: 13, first_name: 'MomBrother', last_name: 'Y', gender: 'm', birth_year: 1979 },
  { id: 20, first_name: 'Ego', last_name: 'X', gender: 'm', birth_year: 2000 },
  { id: 21, first_name: 'EgoSister', last_name: 'X', gender: 'f', birth_year: 2003 },
  { id: 22, first_name: 'EgoSpouse', last_name: 'Z', gender: 'f', birth_year: 2001 },
  { id: 30, first_name: 'PaternalCousin', last_name: 'X', gender: 'm', birth_year: 1998 },
  { id: 31, first_name: 'AuntsCousin', last_name: 'X', gender: 'f', birth_year: 1999 },
  { id: 32, first_name: 'MomsCousin', last_name: 'Y', gender: 'm', birth_year: 2002 },
  { id: 40, first_name: 'Niece', last_name: 'X', gender: 'f', birth_year: 2025 },
  { id: 50, first_name: 'Unrelated', last_name: 'Nobody', gender: 'm', birth_year: 1990 },
]
const relationships = [
  { person1_id: 1, person2_id: 2, type: 'spouse' },
  { person1_id: 1, person2_id: 3, type: 'parent' }, { person1_id: 2, person2_id: 3, type: 'parent' },
  { person1_id: 1, person2_id: 4, type: 'parent' }, { person1_id: 2, person2_id: 4, type: 'parent' },
  { person1_id: 1, person2_id: 6, type: 'parent' }, { person1_id: 2, person2_id: 6, type: 'parent' },
  { person1_id: 1, person2_id: 7, type: 'parent' }, { person1_id: 2, person2_id: 7, type: 'parent' },
  { person1_id: 4, person2_id: 5, type: 'spouse' },
  { person1_id: 10, person2_id: 11, type: 'spouse' },
  { person1_id: 10, person2_id: 12, type: 'parent' }, { person1_id: 11, person2_id: 12, type: 'parent' },
  { person1_id: 10, person2_id: 13, type: 'parent' }, { person1_id: 11, person2_id: 13, type: 'parent' },
  { person1_id: 3, person2_id: 12, type: 'spouse' },
  { person1_id: 3, person2_id: 20, type: 'parent' }, { person1_id: 12, person2_id: 20, type: 'parent' },
  { person1_id: 3, person2_id: 21, type: 'parent' }, { person1_id: 12, person2_id: 21, type: 'parent' },
  { person1_id: 20, person2_id: 22, type: 'spouse' },
  { person1_id: 4, person2_id: 30, type: 'parent' },
  { person1_id: 7, person2_id: 31, type: 'parent' },
  { person1_id: 13, person2_id: 32, type: 'parent' },
  { person1_id: 21, person2_id: 40, type: 'parent' },
]

const graph = buildFamilyGraph(people, relationships)
const rel = (egoId, targetId) => getRelationTerm(egoId, targetId, graph)

describe('kinship: ego = 20 (Ego)', () => {
  it('grandparents split by paternal/maternal side', () => {
    expect(rel(20, 1).han).toBe('阿爺')
    expect(rel(20, 2).han).toBe('阿嫲')
    expect(rel(20, 10).han).toBe('阿公')
    expect(rel(20, 11).han).toBe('阿婆')
  })

  it("father's brothers split by birth order, father's sister by birth order", () => {
    expect(rel(20, 4).han).toBe('伯父') // older than Dad
    expect(rel(20, 6).han).toBe('阿叔') // younger than Dad
    expect(rel(20, 7).han).toBe('姑媽') // older than Dad
  })

  it("mother's brother uses 舅父 regardless of age", () => {
    expect(rel(20, 13).han).toBe('舅父')
  })

  it('aunt/uncle by marriage', () => {
    expect(rel(20, 5).han).toBe('伯娘') // father's older brother's wife
  })

  it('paternal-line cousin is 堂, all other first cousins are 表', () => {
    expect(rel(20, 30).han).toBe('堂兄') // father's brother's son, older
    expect(rel(20, 31).han).toBe('表姐') // father's sister's daughter, older
    expect(rel(20, 32).han).toBe('表弟') // mother's brother's son, younger
  })

  it('siblings split by birth order', () => {
    expect(rel(20, 21).han).toBe('妹妹')
  })

  it("niece via sister uses 外甥 (vs. 姪 via brother)", () => {
    expect(rel(20, 40).han).toBe('外甥女')
  })

  it('spouse', () => {
    expect(rel(20, 22).han).toBe('老婆')
  })

  it('unrelated people resolve to no relation', () => {
    expect(rel(20, 50)).toBeNull()
  })

  it('computeAllRelations excludes ego and unrelated people, includes everyone else', () => {
    const all = computeAllRelations(20, people, relationships)
    const ids = all.map(r => r.person.id)
    expect(ids).not.toContain(20)
    expect(ids).not.toContain(50)
    expect(ids).toContain(1)
    expect(ids).toContain(40)
  })
})

describe('kinship: ego = 3 (Dad) — in-law terms', () => {
  it("sibling's wife depends on the sibling's birth order relative to ego", () => {
    expect(rel(3, 5).han).toBe('嫂嫂') // UncleOlder is older than Dad, so his wife is 嫂嫂
  })

  it("spouse's parent depends on ego's own gender", () => {
    expect(rel(3, 10).han).toBe('外父') // Dad is male, so wife's father is 外父
    expect(rel(3, 11).han).toBe('外母')
  })
})
