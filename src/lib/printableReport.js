function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildPrintableHtml(people, relationships) {
  const byId = {}
  people.forEach(p => { byId[p.id] = p })
  const nameOf = id => { const p = byId[id]; return p ? `${p.first_name} ${p.last_name || ''}`.trim() : 'Unknown' }
  const relsOf = {}
  for (const r of relationships) {
    if (r.type === 'parent') {
      (relsOf[r.person1_id] ??= []).push(`Parent of ${nameOf(r.person2_id)}`)
      ;(relsOf[r.person2_id] ??= []).push(`Child of ${nameOf(r.person1_id)}`)
    } else {
      (relsOf[r.person1_id] ??= []).push(`Spouse of ${nameOf(r.person2_id)}`)
      ;(relsOf[r.person2_id] ??= []).push(`Spouse of ${nameOf(r.person1_id)}`)
    }
  }
  const sorted = [...people].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
  const rows = sorted.map(p => `
    <tr>
      <td>${esc(p.first_name)} ${esc(p.last_name)}</td>
      <td>${esc(p.chinese_name)}</td>
      <td>${p.birth_year ?? ''}</td>
      <td>${p.death_year ?? ''}</td>
      <td>${(relsOf[p.id] || []).map(esc).join('<br>')}</td>
      <td>${esc(p.notes)}</td>
    </tr>`).join('')
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Family Tree — ${esc(new Date().toLocaleDateString())}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1f2937; padding: 24px; }
  h1 { color: #6b3a1f; margin-bottom: 4px; }
  p.meta { color: #6b7280; font-size: 13px; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 13px; vertical-align: top; }
  th { background: #f3f4f6; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>Leung Family Tree</h1>
  <p class="meta">${sorted.length} members · generated ${esc(new Date().toLocaleString())}</p>
  <table>
    <thead><tr><th>Name</th><th>Chinese Name</th><th>Born</th><th>Died</th><th>Relationships</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`
}
