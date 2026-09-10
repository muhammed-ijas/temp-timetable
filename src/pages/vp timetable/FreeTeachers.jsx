import { useState, useMemo } from 'react'
import { DAYS, PURPLE_MID, PURPLE_LIGHT, PURPLE_BORDER } from './TimetableUtils'

// ═══════════════════════════════════════════════════════════════
//  Free Teachers — by TIME, not slot number.
//  Balvatika and classes 1–8 have different period layouts, so
//  "slot 2" is 8:15 in one and 8:50 in the other. We list the real
//  time ranges and mark a teacher busy if any class of theirs
//  overlaps the chosen range.
// ═══════════════════════════════════════════════════════════════

const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m }
const fmt = t => { const [h, m] = String(t).split(':'); return `${((parseInt(h, 10) + 11) % 12) + 1}:${m}` }
const isPre = name => /^(balvatika|nursery|lkg|ukg)/i.test(String(name || ''))

export default function FreeTeachers({ sortedTeachers, allTimetableData, currentSchoolYear }) {
  const [day, setDay]     = useState('Monday')
  const [slotKey, setSlot] = useState('')

  // Distinct teaching time ranges for the chosen day, with P-labels per layout
  const slots = useMemo(() => {
    const seen = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.day !== day || p.is_break || p.timetable_classes?.school_year !== currentSchoolYear) continue
      const key = `${p.start_time}-${p.end_time}`
      seen[key] ||= { key, start: p.start_time, end: p.end_time, pre: false, pri: false }
      if (isPre(p.timetable_classes?.name)) seen[key].pre = true; else seen[key].pri = true
    }
    const list = Object.values(seen).sort((a, b) => toMin(a.start) - toMin(b.start))
    // number periods within each layout
    let nPre = 0, nPri = 0
    for (const s of list) {
      s.label = []
      if (s.pri) s.label.push(`P${++nPri}`)
      if (s.pre) s.label.push(`Balvatika P${++nPre}`)
      s.label = s.label.join(' · ')
    }
    return list
  }, [allTimetableData, day, currentSchoolYear])

  const slot = slots.find(s => s.key === slotKey) || null

  function overlaps(p) {
    return toMin(p.start_time) < toMin(slot.end) && toMin(p.end_time) > toMin(slot.start)
  }
  const busyMap = useMemo(() => {
    const m = {}
    if (!slot) return m
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.day !== day || p.timetable_classes?.school_year !== currentSchoolYear || !e.teacher_name) continue
      if (overlaps(p)) (m[e.teacher_name] ||= []).push(e)
    }
    return m
  }, [allTimetableData, day, slot, currentSchoolYear])

  const freeTeachers = slot ? sortedTeachers.filter(t => !busyMap[t.name]) : []
  const busyTeachers = slot ? sortedTeachers.filter(t => busyMap[t.name]) : []
  const sel = { width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827', cursor: 'pointer' }
  const lbl = { display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }

  return (
    <div className="sidebar-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Select Day & Time</div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Day</label>
          <select value={day} onChange={e => { setDay(e.target.value); setSlot('') }} style={sel}>
            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Period</label>
          <select value={slotKey} onChange={e => setSlot(e.target.value)} style={sel}>
            <option value="">— Select period —</option>
            {slots.map(s => <option key={s.key} value={s.key}>{fmt(s.start)} – {fmt(s.end)}  ({s.label})</option>)}
          </select>
        </div>
        {slot && (
          <div style={{ background: PURPLE_LIGHT, border: `1px solid ${PURPLE_BORDER}`, borderRadius: 6, padding: '8px 10px', fontSize: 12, color: PURPLE_MID, fontWeight: 500, lineHeight: 1.5 }}>
            {fmt(slot.start)} – {fmt(slot.end)} on {day}<br />
            <span style={{ fontWeight: 400, color: '#6B7280' }}>{slot.label}. Teachers with a class overlapping this time are busy.</span>
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        {!slot ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Select a day and period to see free teachers</div>
        ) : (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{day} · {fmt(slot.start)} – {fmt(slot.end)} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>({slot.label})</span></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, background: '#ECFDF5', color: '#065F46', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>{freeTeachers.length} Free</span>
                <span style={{ fontSize: 12, background: '#FEF2F2', color: '#991B1B', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>{busyTeachers.length} Busy</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', maxHeight: 500, overflowY: 'auto', minWidth: 0 }}>
              <div style={{ borderRight: '1px solid #F3F4F6' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #F3F4F6', fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: 1, background: '#F0FDF4' }}>Free Teachers ({freeTeachers.length})</div>
                {freeTeachers.length === 0
                  ? <div style={{ padding: 16, color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>All teachers are busy</div>
                  : freeTeachers.map(t => <div key={t.name} style={{ padding: '8px 14px', borderBottom: '1px solid #F9FAFB', fontSize: 13, color: '#111827', fontWeight: 500 }}>{t.name}</div>)}
              </div>
              <div>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #F3F4F6', fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: 1, background: '#FFF5F5' }}>Busy Teachers ({busyTeachers.length})</div>
                {busyTeachers.length === 0
                  ? <div style={{ padding: 16, color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>All teachers are free</div>
                  : busyTeachers.map(t => (
                    <div key={t.name} style={{ padding: '8px 14px', borderBottom: '1px solid #F9FAFB' }}>
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{t.name}</div>
                      {busyMap[t.name].map((e, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1, textTransform: 'uppercase' }}>
                          {e.subject} · {e.timetable_periods?.timetable_classes?.name} · {fmt(e.timetable_periods.start_time)}–{fmt(e.timetable_periods.end_time)}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}