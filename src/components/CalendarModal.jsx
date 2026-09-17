import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildMonthGrid, monthLabel, toIsoDate, formatEventTime, upcomingEvents } from '../lib/calendarGrid'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const emptyForm = { title: '', event_date: '', event_time: '', location: '', description: '' }

export default function CalendarModal({ session, isEditor, onSignIn, onClose }) {
  const today = useMemo(() => new Date(), [])
  const todayIso = toIsoDate(today)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('family_events').select('*').order('event_date').order('event_time', { nullsFirst: true })
    setLoading(false)
    if (error) return setError(error.message)
    setEvents(data || [])
  }
  useEffect(() => { load() }, [])

  const eventsByDate = useMemo(() => {
    const map = {}
    for (const e of events) (map[e.event_date] ||= []).push(e)
    return map
  }, [events])

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])
  const dayEvents = eventsByDate[selectedDate] || []
  const nextUp = useMemo(() => upcomingEvents(events, todayIso, 5), [events, todayIso])

  const changeMonth = delta => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  const goToToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(todayIso) }
  const jumpTo = iso => {
    const d = new Date(iso + 'T00:00:00')
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); setSelectedDate(iso)
  }
  const selectDay = cell => jumpTo(cell.iso)

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm, event_date: selectedDate }); setFormError(''); setFormOpen(true) }
  const openEdit = e => {
    setEditingId(e.id)
    setForm({ title: e.title, event_date: e.event_date, event_time: e.event_time || '', location: e.location || '', description: e.description || '' })
    setFormError(''); setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditingId(null) }

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
    }
    const { error } = editingId
      ? await supabase.from('family_events').update(payload).eq('id', editingId)
      : await supabase.from('family_events').insert([{ ...payload, created_by: session.user.email }])
    setSaving(false)
    if (error) return setFormError(error.message)
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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>📅 Family Calendar</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Birthdays, reunions, and other family events — shared with everyone who visits the tree.</p>

        {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fee2e2', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        {!loading && !!nextUp.length && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
            {nextUp.map(e => (
              <button key={e.id} onClick={() => jumpTo(e.event_date)} style={{ flexShrink: 0, textAlign: 'left', padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: e.event_date === selectedDate ? '#fdecec' : '#f9fafb', cursor: 'pointer' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#7a2e2e', textTransform: 'uppercase' }}>{new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap' }}>{e.title}</div>
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
                    {hasEvents && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : '#7a2e2e' }} />}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{selectedLabel}</h3>
            {session ? (
              !formOpen && <button onClick={openAdd} style={{ ...bt, flexShrink: 0 }}>+ Add Event</button>
            ) : (
              <button onClick={onSignIn} style={{ ...bt, background: '#f3f4f6', color: '#374151', flexShrink: 0 }}>Sign in to add</button>
            )}
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
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={closeForm} disabled={saving} style={{ ...bt, background: '#f3f4f6', color: '#374151' }}>Cancel</button>
                <button onClick={saveEvent} disabled={saving} style={{ ...bt, opacity: saving ? .6 : 1 }}>{saving ? 'Saving…' : editingId ? 'Save' : 'Add'}</button>
              </div>
            </div>
          )}

          {dayEvents.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dayEvents.map(e => (
                <div key={e.id} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{e.title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{[formatEventTime(e.event_time), e.location].filter(Boolean).join(' · ')}</div>
                      {e.description && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{e.description}</div>}
                    </div>
                    {canManage(e) && (
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
