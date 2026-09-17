import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const bt = { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#4a0404', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }

export default function GroupsModal({ people, groups, groupMembers, session, isEditor, onChanged, onOpenGroupCalendar, onClose }) {
  const [newGroupName, setNewGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [addingId, setAddingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')

  const myPerson = useMemo(() => people.find(p => p.claimed_by === session.user.email), [people, session])
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups])
  const membersOf = groupId => groupMembers.filter(gm => gm.group_id === groupId).map(gm => people.find(p => p.id === gm.person_id)).filter(Boolean)
  const canManage = group => group.created_by === session.user.email || isEditor

  const createGroup = async () => {
    if (!newGroupName.trim()) return setError('Enter a group name')
    setError(''); setCreating(true)
    const { data, error } = await supabase.from('groups').insert([{ name: newGroupName.trim(), created_by: session.user.email }]).select().single()
    if (error) { setCreating(false); return setError(error.message) }
    if (myPerson) await supabase.from('group_members').insert([{ group_id: data.id, person_id: myPerson.id, added_by: session.user.email }])
    setCreating(false)
    setNewGroupName('')
    setExpandedId(data.id)
    onChanged()
  }

  const addMember = async (groupId, personId) => {
    setAddingId(personId); setError('')
    const { error } = await supabase.from('group_members').insert([{ group_id: groupId, person_id: personId, added_by: session.user.email }])
    setAddingId(null)
    if (error) return setError(error.message)
    setMemberQuery('')
    onChanged()
  }

  const removeMember = async (groupId, personId) => {
    setRemovingId(personId); setError('')
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('person_id', personId)
    setRemovingId(null)
    if (error) return setError(error.message)
    onChanged()
  }

  const deleteGroup = async (groupId) => {
    setDeletingId(groupId); setError('')
    const { error } = await supabase.from('groups').delete().eq('id', groupId)
    setDeletingId(null)
    if (error) return setError(error.message)
    if (expandedId === groupId) setExpandedId(null)
    onChanged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(480px, 92vw)', maxHeight: '85vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>👪 Family Groups</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Groups get their own filtered calendar, and events can be limited to just a group's members instead of the whole tree.</p>

        {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createGroup()} placeholder="New group name…" style={inp} />
          <button onClick={createGroup} disabled={creating} style={{ ...bt, flexShrink: 0, opacity: creating ? .6 : 1 }}>{creating ? 'Creating…' : '+ Create'}</button>
        </div>

        {!sortedGroups.length && <p style={{ fontSize: 13, color: '#9ca3af' }}>No groups yet.</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedGroups.map(group => {
            const members = membersOf(group.id)
            const expanded = expandedId === group.id
            const memberIds = new Set(members.map(m => m.id))
            const candidates = memberQuery.trim()
              ? people.filter(p => !memberIds.has(p.id) && `${p.first_name} ${p.last_name || ''}`.toLowerCase().includes(memberQuery.trim().toLowerCase())).slice(0, 6)
              : []
            return (
              <div key={group.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f9fafb' }}>
                  <button onClick={() => setExpandedId(expanded ? null : group.id)} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{group.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{members.length} member{members.length === 1 ? '' : 's'}</div>
                  </button>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onOpenGroupCalendar(group)} title="View this group's calendar" style={{ ...bt, background: '#7a2e2e', fontSize: 12, padding: '6px 10px' }}>📅</button>
                    {canManage(group) && <button onClick={() => deleteGroup(group.id)} disabled={deletingId === group.id} title="Delete group" style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', opacity: deletingId === group.id ? .6 : 1 }}>{deletingId === group.id ? 'Deleting…' : 'Delete'}</button>}
                  </div>
                </div>
                {expanded && (
                  <div style={{ padding: '10px 12px' }}>
                    {members.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span style={{ fontSize: 13 }}>{m.first_name} {m.last_name}</span>
                        <button onClick={() => removeMember(group.id, m.id)} disabled={removingId === m.id} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', opacity: removingId === m.id ? .6 : 1 }}>{removingId === m.id ? 'Removing…' : 'Remove'}</button>
                      </div>
                    ))}
                    <input value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Add a member…" style={{ ...inp, marginTop: 8, fontSize: 13 }} />
                    {candidates.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {candidates.map(p => (
                          <button key={p.id} onClick={() => addMember(group.id, p.id)} disabled={addingId === p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontSize: 13, textAlign: 'left', opacity: addingId === p.id ? .6 : 1 }}>
                            <span>{p.first_name} {p.last_name}</span>
                            <span style={{ color: '#4a0404', fontWeight: 600 }}>{addingId === p.id ? 'Adding…' : '+ Add'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
