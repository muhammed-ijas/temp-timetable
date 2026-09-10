import { useState, useMemo, useEffect } from 'react'
import { DAYS, ordinalPeriod, today, PURPLE_DARK, PURPLE_MID, PURPLE_LIGHT, PURPLE_BORDER } from './TimetableUtils'
import { supabase } from '../../lib/supabase'

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Substitute picker modal ───────────────────────────────────────────────────
function SubstitutePickerModal({ slot, freeTeachers, busyTeachers, onSelect, onCancel }) {
  const [search, setSearch] = useState('')
  const filteredFree = freeTeachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
  const filteredBusy = busyTeachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Choose Substitute Teacher</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            For: <strong>{slot.teacherName}</strong>'s {ordinalPeriod(slot.periodNumber)} ({slot.subject}, Class {slot.className})
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{slot.startTime} – {slot.endTime}</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teacher..."
            style={{ marginTop: 10, width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827', background: '#FAFAFA' }}
            autoFocus />
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: 1, background: '#F0FDF4', borderBottom: '1px solid #D1FAE5' }}>
            Free at this period ({filteredFree.length})
          </div>
          {filteredFree.length === 0 && <div style={{ padding: '10px 18px', fontSize: 12, color: '#9CA3AF' }}>No free teachers match.</div>}
          {filteredFree.map(t => (
            <div key={t.name} onClick={() => onSelect(t, false)}
              style={{ padding: '10px 18px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#059669', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>Free — {t._periodCount > 0
                    ? `${t._periodCount} period${t._periodCount !== 1 ? 's' : ''} today`
                    : 'no periods today'}</span>
                  {t._subCount > 0 && (
                    <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>
                      +{t._subCount} sub{t._subCount !== 1 ? 's' : ''} today
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Free</span>
            </div>
          ))}

          <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: 1, background: '#FFF5F5', borderBottom: '1px solid #FECACA', borderTop: '2px solid #F3F4F6' }}>
            Busy at this period ({filteredBusy.length}) — select with caution
          </div>
          {filteredBusy.length === 0 && <div style={{ padding: '10px 18px', fontSize: 12, color: '#9CA3AF' }}>No busy teachers match.</div>}
          {filteredBusy.map(t => (
            <div key={t.name} onClick={() => onSelect(t, true)}
              style={{ padding: '10px 18px', borderBottom: '1px solid #F9FAFB', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FFF5F5'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{t.name}</div>
                {(t._busyWith || []).map((b, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{b.subject} — Class {b.className}</div>
                ))}
              </div>
              <span style={{ fontSize: 11, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Busy</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid #E5E7EB', textAlign: 'right' }}>
          <button onClick={onCancel}
            style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', padding: '8px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── History tab ───────────────────────────────────────────────────────────────
function SubstitutionHistory({ currentSchoolYear }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchHistory() }, [])

  async function fetchHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('substitutions')
      .select('*')
      .eq('school_year', currentSchoolYear)
      .order('date', { ascending: false })
      .order('period_number', { ascending: true })
    setHistory(data || [])
    setLoading(false)
  }

  async function deleteRecord(id) {
    if (!window.confirm('Delete this substitution record?')) return
    setDeleting(id)
    await supabase.from('substitutions').delete().eq('id', id)
    setHistory(prev => prev.filter(r => r.id !== id))
    setDeleting(null)
  }

  const filtered = filterDate ? history.filter(r => r.date === filterDate) : history

  // Group by date
  const byDate = {}
  for (const r of filtered) {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Substitution History</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Filter by date</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 12, color: '#111827', background: '#FAFAFA' }} />
          {filterDate && (
            <button onClick={() => setFilterDate('')}
              style={{ fontSize: 11, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', padding: '6px 10px', borderRadius: 5, cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Loading history...</div>
      ) : sortedDates.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          No substitution records found{filterDate ? ' for this date' : ''}.
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: PURPLE_MID, marginBottom: 6, paddingLeft: 2 }}>
              {fmtDate(date)}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: '#9CA3AF' }}>
                {byDate[date].length} substitution{byDate[date].length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              {byDate[date].map((r, idx) => (
                <div key={r.id} style={{ padding: '10px 14px', borderBottom: idx < byDate[date].length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <div style={{ minWidth: 90 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE_MID }}>{ordinalPeriod(r.period_number)}</span>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{r.start_time}–{r.end_time}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{r.subject}</div>
                    <div style={{ fontSize: 11, color: '#047857' }}>Class {r.class_name}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Absent</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'line-through' }}>{r.absent_teacher}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Substitute</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{r.substitute_teacher}</div>
                    {r.is_busy_override && (
                      <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>⚠ Was Busy</span>
                    )}
                  </div>
                  <button onClick={() => deleteRecord(r.id)} disabled={deleting === r.id}
                    style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: deleting === r.id ? 0.5 : 1 }}>
                    {deleting === r.id ? '...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Main SubstitutionTab ──────────────────────────────────────────────────────
export default function SubstitutionTab({ allTimetableData, sortedTeachers, currentSchoolYear }) {
  const [subTab, setSubTab] = useState('assign') // 'assign' | 'history'
  const [selectedDate, setSelectedDate] = useState(today())
  const [absentTeacher, setAbsentTeacher] = useState('')
  const [substitutions, setSubstitutions] = useState([])  // session-local pending subs
  const [pickerSlot, setPickerSlot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  // Already-saved subs from DB for the selected date (to block duplicates)
  const [savedForDate, setSavedForDate] = useState([])

  // Fetch already-saved subs whenever date or teacher changes
  useEffect(() => {
    if (!selectedDate) return
    fetchSavedForDate(selectedDate)
  }, [selectedDate])

  async function fetchSavedForDate(date) {
    const { data } = await supabase
      .from('substitutions')
      .select('*')
      .eq('date', date)
      .eq('school_year', currentSchoolYear)
    setSavedForDate(data || [])
  }

  const dayName = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00').getDay()
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]
  }, [selectedDate])


  const isWeekend = dayName === 'Saturday' || dayName === 'Sunday'

  const absentSlots = useMemo(() => {
    if (!absentTeacher || !dayName || isWeekend) return []
    return allTimetableData
      .filter(e => {
        const p = e.timetable_periods
        return p && e.teacher_name === absentTeacher && p.day === dayName && p.timetable_classes?.school_year === currentSchoolYear
      })
      .map(e => ({
        periodId: e.period_id,
        entryId: e.id,
        periodNumber: e.timetable_periods.period_number,
        startTime: e.timetable_periods.start_time,
        endTime: e.timetable_periods.end_time,
        subject: e.subject,
        className: e.timetable_periods.timetable_classes?.name,
        teacherName: e.teacher_name,
        isClassTeacher: e.is_class_teacher,
      }))
      .sort((a, b) => a.periodNumber - b.periodNumber)
  }, [absentTeacher, dayName, allTimetableData, currentSchoolYear])

  // ── Check if a slot already has a saved sub in DB ──────────────────────────
  function alreadySavedInDB(slot) {
    return savedForDate.find(
      s => s.absent_teacher === absentTeacher &&
        s.period_number === slot.periodNumber &&
        s.class_name === slot.className
    ) || null
  }

  function getBusyMap(periodNumber) {
    return allTimetableData.filter(e => {
      const p = e.timetable_periods
      return p && p.day === dayName && p.period_number === periodNumber && p.timetable_classes?.school_year === currentSchoolYear
    })
  }

  // Replace the openPicker function:

  function openPicker(slot) {
    const busyEntries = getBusyMap(slot.periodNumber)
    const busyNames = new Set(busyEntries.map(e => e.teacher_name))

    // ── Also mark teachers who are already assigned as substitutes
    //    for this same period on this date (from savedForDate)
    const alreadySubNames = new Set([
      ...savedForDate.filter(s => s.period_number === slot.periodNumber).map(s => s.substitute_teacher),
      ...substitutions.filter(s => s.date === selectedDate && s.periodNumber === slot.periodNumber).map(s => s.substituteTeacher),
    ])

    // ── Every teacher already marked absent on this date (saved or pending)
    //    must never be offered as a substitute, whichever absent teacher is
    //    currently selected.
    const absentToday = new Set([
      absentTeacher,
      ...savedForDate.filter(s => s.date === selectedDate).map(s => s.absent_teacher),
      ...substitutions.filter(s => s.date === selectedDate).map(s => s.absentTeacher),
    ])

    // Substitutions each teacher already covers on this date (saved + pending)
    const subCountFor = (name) => {
      const saved = savedForDate.filter(s => s.date === selectedDate && s.substitute_teacher === name).length
      const pending = substitutions.filter(s => s.date === selectedDate && s.substituteTeacher === name).length
      return saved + pending
    }

        const free = sortedTeachers
      .filter(t => !absentToday.has(t.name) && !busyNames.has(t.name) && !alreadySubNames.has(t.name))
      .map(t => ({
        ...t,
        _periodCount: allTimetableData.filter(e => {
          const p = e.timetable_periods
          return p && !p.is_break && p.day === dayName && e.teacher_name === t.name
            && p.timetable_classes?.school_year === currentSchoolYear
        }).length,
        _subCount: subCountFor(t.name),
      }))

    const busy = sortedTeachers
      .filter(t => !absentToday.has(t.name) && (busyNames.has(t.name) || alreadySubNames.has(t.name)))
      .map(t => ({
        ...t,
        _busyWith: alreadySubNames.has(t.name) && !busyNames.has(t.name)
          ? [{ subject: 'Already assigned as substitute', className: '—' }]
          : busyEntries.filter(e => e.teacher_name === t.name).map(e => ({
            subject: e.subject,
            className: e.timetable_periods?.timetable_classes?.name,
          })),
      }))

    setPickerSlot({ ...slot, _free: free, _busy: busy })
  }

  function handleSelectSub(slot, teacher, isBusy) {
    setSubstitutions(prev => {
      const existing = prev.findIndex(s =>
        s.periodNumber === slot.periodNumber &&
        s.date === selectedDate &&
        s.absentTeacher === absentTeacher &&
        s.className === slot.className
      )
      const entry = {
        date: selectedDate, day: dayName, absentTeacher,
        periodNumber: slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject,
        className: slot.className,
        substituteTeacher: teacher.name,
        isBusyWarning: isBusy,
        entryId: slot.entryId,
        periodId: slot.periodId,
      }
      if (existing >= 0) { const u = [...prev]; u[existing] = entry; return u }
      return [...prev, entry]
    })
    setPickerSlot(null)
  }

  function removePendingSub(periodNumber, className) {
    setSubstitutions(prev => prev.filter(s =>
      !(s.periodNumber === periodNumber && s.date === selectedDate && s.absentTeacher === absentTeacher && s.className === className)
    ))
  }

  const currentSubstitutions = substitutions.filter(
    s => s.date === selectedDate && s.absentTeacher === absentTeacher
  )

  async function saveSubstitutions() {
    if (currentSubstitutions.length === 0) return
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')
    let savedCount = 0
    const errors = []

    for (const sub of currentSubstitutions) {
      // Delete EXACT match: date + absent_teacher + period_number + class_name
      // This is the correct key — prevents duplicates across multiple classes
      await supabase.from('substitutions')
        .delete()
        .eq('date', sub.date)
        .eq('absent_teacher', sub.absentTeacher)
        .eq('period_number', sub.periodNumber)
        .eq('class_name', sub.className)

      const { error } = await supabase.from('substitutions').insert({
        date: sub.date,
        day: sub.day,
        absent_teacher: sub.absentTeacher,
        substitute_teacher: sub.substituteTeacher,
        period_number: sub.periodNumber,
        start_time: sub.startTime,
        end_time: sub.endTime,
        subject: sub.subject,
        class_name: sub.className,
        school_year: currentSchoolYear,
        is_busy_override: sub.isBusyWarning,
      })
      if (error) errors.push(`${ordinalPeriod(sub.periodNumber)} Class ${sub.className}: ${error.message}`)
      else savedCount++
    }

    // Refresh saved-for-date so UI reflects the new state immediately
    await fetchSavedForDate(selectedDate)

    if (errors.length > 0) {
      setErrorMsg('Some records failed: ' + errors.join(' | '))
    } else {
      setSuccessMsg(`Saved ${savedCount} substitution${savedCount > 1 ? 's' : ''} successfully!`)
      setTimeout(() => setSuccessMsg(''), 6000)
    }
    setSubstitutions(prev => prev.filter(s => !(s.date === selectedDate && s.absentTeacher === absentTeacher)))
    setSaving(false)
  }

  async function deleteFromDB(record) {
    if (!window.confirm(`Remove substitution for ${ordinalPeriod(record.period_number)}, Class ${record.class_name}?`)) return
    await supabase.from('substitutions').delete().eq('id', record.id)
    await fetchSavedForDate(selectedDate)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid #E5E7EB' }}>
        {[['assign', 'Assign Substitution'], ['history', 'History']].map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            style={{
              padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: subTab === key ? 700 : 400,
              color: subTab === key ? PURPLE_MID : '#6B7280',
              borderBottom: `3px solid ${subTab === key ? PURPLE_MID : 'transparent'}`,
              marginBottom: -2,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── HISTORY sub-tab ── */}
      {subTab === 'history' && (
        <SubstitutionHistory currentSchoolYear={currentSchoolYear} />
      )}

      {/* ── ASSIGN sub-tab ── */}
      {subTab === 'assign' && (
        <>
          <div className="sidebar-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Substitution Setup</div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Date</label>
                <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSubstitutions([]) }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{fmtDate(selectedDate)}</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Absent Teacher</label>
                <select value={absentTeacher} onChange={e => { setAbsentTeacher(e.target.value); setSubstitutions([]) }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827', cursor: 'pointer' }}>
                  <option value="">— Select teacher —</option>
                  {sortedTeachers.map(t => {
                    const count = allTimetableData.filter(e => {
                      const p = e.timetable_periods
                      return p && e.teacher_name === t.name && p.day === dayName &&
                        p.timetable_classes?.school_year === currentSchoolYear
                    }).length
                    return (
                      <option key={t.name} value={t.name}>
                        {t.name}{!isWeekend && count > 0 ? ` (${count} period${count !== 1 ? 's' : ''})` : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              {absentTeacher && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#92400E', fontWeight: 500 }}>
                  {isWeekend
                    ? `${dayName} is not a school day.`
                    : absentSlots.length === 0
                      ? `${absentTeacher} has no periods on ${dayName}.`
                      : `${absentTeacher} has ${absentSlots.length} period${absentSlots.length > 1 ? 's' : ''} on ${dayName}.`
                  }
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                1. Pick the date a teacher is absent.<br />
                2. Select the absent teacher — their periods for that day appear.<br />
                3. Click <strong>Assign Sub</strong> on any period to pick a substitute.<br />
                4. Free teachers shown first (green). Busy teachers shown below with a warning.<br />
                5. Click <strong>Save Substitutions</strong> to record them.<br />
                6. Already-saved substitutions show in green — click <strong>Change</strong> or <strong>Delete</strong>.
              </div>
            </div>
          </div>

          {absentTeacher && !isWeekend && absentSlots.length > 0 && (
            <>
              {successMsg && (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 7, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#065F46', fontWeight: 500 }}>
                  ✓ {successMsg}
                </div>
              )}
              {errorMsg && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#991B1B', fontWeight: 500 }}>
                  ✗ {errorMsg}
                </div>
              )}

              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    {absentTeacher}'s Periods on {dayName}, {fmtDate(selectedDate)}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    {currentSubstitutions.length} pending · {savedForDate.filter(s => s.absent_teacher === absentTeacher).length} already saved
                  </div>
                </div>

                {absentSlots.map((slot, idx) => {
                  const pendingSub = currentSubstitutions.find(s => s.periodNumber === slot.periodNumber && s.className === slot.className)
                  const dbSub = alreadySavedInDB(slot)
                  const isAlreadySaved = !!dbSub && !pendingSub

                  return (
                    <div key={`${slot.periodNumber}-${slot.className}`}
                      style={{
                        padding: '12px 16px',
                        borderBottom: idx < absentSlots.length - 1 ? '1px solid #F3F4F6' : 'none',
                        background: isAlreadySaved ? '#F0FDF4' : pendingSub ? '#FFFBEB' : idx % 2 === 0 ? '#fff' : '#FAFAFA',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        borderLeft: isAlreadySaved ? '3px solid #059669' : pendingSub ? '3px solid #F59E0B' : 'none',
                      }}>

                      {/* Period info */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: PURPLE_MID }}>{ordinalPeriod(slot.periodNumber)}</span>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{slot.startTime}–{slot.endTime}</span>
                          {isAlreadySaved && (
                            <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>SAVED</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{slot.subject}</div>
                        <div style={{ fontSize: 11, color: '#047857', marginTop: 1 }}>Class {slot.className}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Original: {slot.teacherName}</div>
                      </div>

                      {/* Action area */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

                        {/* Already saved in DB */}
                        {isAlreadySaved && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46', marginBottom: 4 }}>
                              → {dbSub.substitute_teacher}
                            </div>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button onClick={() => openPicker(slot)}
                                style={{ fontSize: 11, background: PURPLE_LIGHT, color: PURPLE_MID, border: `1px solid ${PURPLE_BORDER}`, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                Change
                              </button>
                              <button onClick={() => deleteFromDB(dbSub)}
                                style={{ fontSize: 11, background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Pending (not yet saved) */}
                        {pendingSub && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              {pendingSub.isBusyWarning && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>⚠ Was Busy</span>}
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#B45309' }}>{pendingSub.substituteTeacher}</span>
                              <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>PENDING</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button onClick={() => openPicker(slot)}
                                style={{ fontSize: 11, background: PURPLE_LIGHT, color: PURPLE_MID, border: `1px solid ${PURPLE_BORDER}`, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                Change
                              </button>
                              <button onClick={() => removePendingSub(slot.periodNumber, slot.className)}
                                style={{ fontSize: 11, background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                                Remove
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Not yet assigned */}
                        {!isAlreadySaved && !pendingSub && (
                          <button onClick={() => openPicker(slot)}
                            style={{ background: PURPLE_DARK, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            Assign Sub
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {currentSubstitutions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={saveSubstitutions} disabled={saving}
                    style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Saving...' : `Save ${currentSubstitutions.length} Substitution${currentSubstitutions.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {pickerSlot && (
        <SubstitutePickerModal
          slot={pickerSlot}
          freeTeachers={pickerSlot._free}
          busyTeachers={pickerSlot._busy}
          onSelect={(teacher, isBusy) => handleSelectSub(pickerSlot, teacher, isBusy)}
          onCancel={() => setPickerSlot(null)}
        />
      )}
    </div>
  )
}