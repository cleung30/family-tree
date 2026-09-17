import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildMonthGrid, monthLabel, toIsoDate, formatEventTime, birthdaysByMonthDay, birthdayTitle } from '../lib/calendarGrid'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const emptyForm = { title: '', event_date: '', event_time: '', location: '', description: '', visibility: 'everyone', invitedPeopleIds: [], invitedGroupIds: [] }

export default function CalendarModal({ session, isEditor, people, groups, groupMembers, groupFilter, onClose }) {
  const today = useMemo(() => new Date(), [])
  const todayIso = toIsoDate(today)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [events, setEvents] = useState([])
  const [invitedPeople, setInvitedPeople] = useState([])
  const [invitedGroups, setInvitedGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [inviteQuery, setInviteQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: ev, error: evErr }, { data: eip, error: eipErr }, { data: eig, error: eigErr }] = await Promise.all([
      supabase.from('family_events').select('*').order('event_date').order('event_time', { nullsFirst: true }),
      supabase.from('event_invited_people').select('*'),
      supabase.from('event_invited_groups').select('*'),
    ])
    setLoading(false)
    const err = evErr || eipErr || eigErr
    if (err) return setError(err.message)
    setEvents(ev || [])
    setInvitedPeople(eip || [])
    setInvitedGroups(eig || [])
  }
  useEffect(() => { load() }, [])

  const groupEventIds = useMemo(() => groupFilter ? new Set(invitedGroups.filter(ig => ig.group_id === groupFilter.id).map(ig => ig.event_id)) : null, [invitedGroups, groupFilter])
  const scopedEvents = useMemo(() => groupFilter ? events.filter(e => groupEventIds.has(e.id)) : events, [events, groupFilter, groupEventIds])

  const eventsByDate = useMemo(() => {
    const map = {}
    for (const e of scopedEvents) (map[e.event_date] ||= []).push(e)
    return map
  }, [scopedEvents])

  const birthdayMap = useMemo(() => groupFilter ? {} : birthdaysByMonthDay(people || []), [people, groupFilter])
  const birthdaysOn = iso => (birthdayMap[iso.slice(5)] || []).map(p => ({
    id: `birthday-${p.id}`, isBirthday: true, event_date: iso, event_time: null,
    title: birthdayTitle(p), location: null, description: null,
  }))

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const dayEvents = [...(eventsByDate[selectedDate] || []), ...birthdaysOn(selectedDate)]
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthHighlights = useMemo(() => {
    const monthBirthdays = grid.filter(c => c.inMonth).flatMap(c => birthdaysOn(c.iso))
    return [...scopedEvents.filter(e => e.event_date.startsWith(monthPrefix)), ...monthBirthdays]
      .sort((a, b) => a.event_date === b.event_date ? (a.event_time || '').localeCompare(b.event_time || '') : a.event_date.localeCompare(b.event_date))
  }, [scopedEvents, grid, monthPrefix])

  const changeMonth = delta => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setSelectedDate(toIsoDate(d))
  }
  const goToToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(todayIso) }
  const jumpTo = iso => {
    const d = new Date(iso + 'T00:00:00')
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDate(iso)
  }
  const selectDay = cell => jumpTo(cell.iso)

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...emptyForm, event_date: selectedDate, visibility: groupFilter ? 'invited' : 'everyone', invitedGroupIds: groupFilter ? [groupFilter.id] : [] })
    setInviteQuery(''); setFormError(''); setFormOpen(true)
  }
  const openEdit = e => {
    setEditingId(e.id)
    setForm({
      title: e.title, event_date: e.event_date, event_time: e.event_time || '', location: e.location || '', description: e.description || '',
      visibility: e.visibility || 'everyone',
      invitedPeopleIds: invitedPeople.filter(ip => ip.event_id === e.id).map(ip => ip.person_id),
      invitedGroupIds: invitedGroups.filter(ig => ig.event_id === e.id).map(ig => ig.group_id),
    })
    setInviteQuery(''); setFormError(''); setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditingId(null) }

  const togglePersonInvite = id => setForm(f => ({ ...f, invitedPeopleIds: f.invitedPeopleIds.includes(id) ? f.invitedPeopleIds.filter(x => x !== id) : [...f.invitedPeopleIds, id] }))
  const toggleGroupInvite = id => setForm(f => ({ ...f, invitedGroupIds: f.invitedGroupIds.includes(id) ? f.invitedGroupIds.filter(x => x !== id) : [...f.invitedGroupIds, id] }))

  const invitablePeople = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase()
    const base = people || []
    return (q ? base.filter(p => `${p.first_name} ${p.last_name || ''}`.toLowerCase().includes(q)) : base).slice(0, 30)
  }, [people, inviteQuery])

  const saveEvent = async () => {
    if (!form.title.trim()) return setFormError('Title is required')
    if (!form.event_date) return setFormError('Date is required')
    setFormError(''); setSaving(true)
    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      visibility: form.visibility,
    }
    let eventId = editingId
    if (editingId) {
      const { error } = await supabase.from('family_events').update(payload).eq('id', editingId)
      if (error) { setSaving(false); return setFormError(error.message) }
    } else {
      const { data, error } = await supabase.from('family_events').insert([{ ...payload, created_by: session.user.email }]).select().single()
      if (error) { setSaving(false); return setFormError(error.message) }
      eventId = data.id
    }

    await supabase.from('event_invited_people').delete().eq('event_id', eventId)
    await supabase.from('event_invited_groups').delete().eq('event_id', eventId)
    if (form.visibility === 'invited') {
      if (form.invitedPeopleIds.length) {
        const { error } = await supabase.from('event_invited_people').insert(form.invitedPeopleIds.map(person_id => ({ event_id: eventId, person_id })))
        if (error) { setSaving(false); return setFormError(error.message) }
      }
      if (form.invitedGroupIds.length) {
        const { error } = await supabase.from('event_invited_groups').insert(form.invitedGroupIds.map(group_id => ({ event_id: eventId, group_id })))
        if (error) { setSaving(false); return setFormError(error.message) }
      }
    }
    setSaving(false)
    setSelectedDate(payload.event_date)
    closeForm()
    load()
  }

  const deleteEvent = async id => {
    setDeletingId(id)
    const { error } = await supabase.from('family_events').delete().eq('id', id)
    setDeletingId(null)
    if (error) return setError(error.message)
    load()
  }

  const canManage = e => session && (session.user.email === e.created_by || isEditor)
  const selectedLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const bt = { padding: '6px 12px', borderRadius: 6, border: 'none', background: '#4a0404', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }
  const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(520px, 92vw)', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>📅 {groupFilter ? `${groupFilter.name}` : 'Family Calendar'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
          {groupFilter
            ? `Events shared with ${groupFilter.name} only.`
            : "Reunions and other family events, plus birthdays added automatically from everyone's profile — shared with everyone who visits the tree."}
        </p>

        {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        {!loading && !!monthHighlights.length && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
            {monthHighlights.map(e => (
              <button key={e.id} onClick={() => jumpTo(e.event_date)} style={{ flexShrink: 0, textAlign: 'left', padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: e.event_date === selectedDate ? '#fdecec' : '#f9fafb', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7a2e2e', textTransform: 'uppercase' }}>{new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap' }}>{e.isBirthday ? '🎂 ' : ''}{e.title}</div>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={() => changeMonth(-1)} style={{ ...bt, background: '#f3f4f6', color: '#374151' }}>‹</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{monthLabel(viewYear, viewMonth)}</span>
            <button onClick={goToToday} style={{ ...bt, background: '#f3f4f6', color: '#374151', fontSize: 11, padding: '4px 8px' }}>Today</button>
          </div>
          <button onClick={() => changeMonth(1)} style={{ ...bt, background: '#f3f4f6', color: '#374151' }}>›</button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
              {WEEKDAYS.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
              {grid.map(cell => {
                const hasEvents = (eventsByDate[cell.iso] || []).length > 0
                const hasBirthday = !!birthdayMap[cell.iso.slice(5)]
                const isSelected = cell.iso === selectedDate
                const isToday = cell.iso === todayIso
                return (
                  <button key={cell.iso} onClick={() => selectDay(cell)} style={{
                    aspectRatio: '1', border: isToday ? '1px solid #7a2e2e' : '1px solid transparent',
                    borderRadius: 6, background: isSelected ? '#4a0404' : 'transparent',
                    color: isSelected ? '#fff' : cell.inMonth ? '#1f2937' : '#d1d5db',
                    fontSize: 13, fontWeight: isToday ? 700 : 400, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0,
                  }}>
                    <span>{cell.date.getDate()}</span>
                    {(hasEvents || hasBirthday) && (
                      <span style={{ display: 'flex', gap: 3 }}>
                        {hasEvents && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : '#7a2e2e' }} />}
                        {hasBirthday && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : '#d97706' }} />}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{selectedLabel}</h3>
            {!formOpen && <button onClick={openAdd} style={{ ...bt, flexShrink: 0 }}>+ Add Event</button>}
          </div>

          {formOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb', borderRadius: 8, padding: 14, marginBottom: 12 }}>
              {formError && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6 }}>{formError}</div>}
              <div><label style={lbl}>Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Date *</label><input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={inp} /></div>
                <div><label style={lbl}>Time</label><input type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} style={inp} /></div>
              </div>
              <div><label style={lbl}>Location</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>

              <div>
                <label style={lbl}>Who can see this</label>
                <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} style={inp}>
                  <option value="everyone">Everyone on the tree</option>
                  <option value="invited">Only people/groups I invite</option>
                </select>
              </div>

              {form.visibility === 'invited' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                  <div>
                    <label style={lbl}>Invite groups</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 100, overflowY: 'auto' }}>
                      {(groups || []).length ? groups.map(g => (
                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input type="checkbox" checked={form.invitedGroupIds.includes(g.id)} onChange={() => toggleGroupInvite(g.id)} />
                          {g.name} <span style={{ color: '#9ca3af' }}>({(groupMembers || []).filter(gm => gm.group_id === g.id).length})</span>
                        </label>
                      )) : <p style={{ fontSize: 12, color: '#9ca3af' }}>No groups yet.</p>}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Invite people</label>
                    <input value={inviteQuery} onChange={e => setInviteQuery(e.target.value)} placeholder="Search people…" style={{ ...inp, fontSize: 13, marginBottom: 6 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                      {invitablePeople.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input type="checkbox" checked={form.invitedPeopleIds.includes(p.id)} onChange={() => togglePersonInvite(p.id)} />
                          {p.first_name} {p.last_name}
                        </label>
                      ))}
                    </div>
                    {!!form.invitedPeopleIds.length && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{form.invitedPeopleIds.length} selected</p>}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={closeForm} disabled={saving} style={{ ...bt, background: '#f3f4f6', color: '#374151' }}>Cancel</button>
                <button onClick={saveEvent} disabled={saving} style={{ ...bt, opacity: saving ? .6 : 1 }}>{saving ? 'Saving…' : editingId ? 'Save' : 'Add'}</button>
              </div>
            </div>
          )}

          {dayEvents.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayEvents.map(e => (
                <div key={e.id} style={{ padding: '10px 12px', background: e.isBirthday ? '#fffbeb' : '#f9fafb', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{e.isBirthday ? '🎂 ' : ''}{e.title}{e.visibility === 'invited' && <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginLeft: 6 }}>🔒 Invited only</span>}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{[formatEventTime(e.event_time), e.location].filter(Boolean).join(' · ')}</div>
                      {e.description && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{e.description}</div>}
                    </div>
                    {!e.isBirthday && canManage(e) && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => openEdit(e)} style={{ background: 'none', border: 'none', color: '#4a0404', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteEvent(e.id)} disabled={deletingId === e.id} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer', opacity: deletingId === e.id ? .6 : 1 }}>{deletingId === e.id ? 'Removing…' : 'Delete'}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !formOpen && <p style={{ fontSize: 13, color: '#9ca3af' }}>No events on this day.</p>}
        </div>
      </div>
    </div>
  )
}
