#!/usr/bin/env node
// Fetches the live people/relationships tables and reports data problems
// that the database itself can't catch (cycles, duplicate edges,
// contradictions, impossible birth/death years). Read-only — makes no writes.
//
// Usage: node --env-file=.env scripts/validate-relationships.js
import { createClient } from '@supabase/supabase-js'
import { findRelationshipIssues } from '../src/lib/validateRelationships.js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\nRun with: node --env-file=.env scripts/validate-relationships.js')
  process.exit(2)
}

const supabase = createClient(url, key)
const [{ data: people, error: pe }, { data: relationships, error: re }] = await Promise.all([
  supabase.from('people').select('*'),
  supabase.from('relationships').select('*'),
])
if (pe || re) {
  console.error('Failed to load data:', (pe || re).message)
  process.exit(2)
}

const issues = findRelationshipIssues(people, relationships)
if (!issues.length) {
  console.log(`✓ No issues found across ${people.length} people and ${relationships.length} relationships.`)
  process.exit(0)
}

console.log(`Found ${issues.length} issue(s):\n`)
for (const issue of issues) console.log(`- [${issue.type}] ${issue.message}`)
process.exit(1)
