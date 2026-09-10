import { useState, useEffect } from 'react'
import { DAYS, DEFAULT_CLASSES, PURPLE_DARK, PURPLE_MID, PURPLE_LIGHT } from './TimetableUtils'
import { supabase } from '../../lib/supabase'
import { classKey } from '../../lib/examConfig'

// ═══════════════════════════════════════════════════════════════
//  DRAFT TIMETABLE GRID
//  Days down the side, periods across the top. Breaks are their
//  own narrow column and are NOT counted in the period numbers.
//  No period times — just class · subject · teacher.
//
//  Subjects come from the `subjects` master list for the class;
//  picking one pre-fills the teacher from `teacher_subjects`.
//  DB structure is unchanged (slots still live in timetable_periods).
// ═══════════════════════════════════════════════════════════════

// "13:30" -> "1:30", "08:15" -> "8:15" (12-hour, no am/pm, no leading zero)
function fmt(t) {
  if (!t) return ''
  const [h, m] = String(t).split(':')
  const hh = ((parseInt(h, 10) + 11) % 12) + 1
  return `${hh}:${m}`
}

// The trailing "Dispersal" slot is a break with no time shown.
const isDispersal = s => s.is_break && /dispersal/i.test(s.break_label || '')

// Teaching periods get 1..N in order, skipping breaks.
function labelSlots(periods) {
  let n = 0
  return periods.map(p => ({ ...p, label: p.is_break ? (p.break_label || 'Break') : String(++n) }))
}

// ─── Class bar (top) ─────────────────────────────────────────
function ClassBar({ classes, selectedClass, onSelect, onDelete, newClassName, setNewClassName, onAdd, addingClass }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginRight: 4 }}>Classes</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {classes.length === 0 && <span style={{ fontSize: 12, color: '#9CA3AF' }}>No classes yet</span>}
          {classes.map(cls => {
            const on = selectedClass?.id === cls.id
            return (
              <button key={cls.id} onClick={() => onSelect(cls)}
                style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${on ? PURPLE_DARK : '#DDD6FE'}`, background: on ? PURPLE_DARK : '#fff', color: on ? '#fff' : '#4C1D95', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                {cls.name}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={newClassName} onChange={e => setNewClassName(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, background: '#FAFAFA', color: '#111827' }}>
            <option value="">+ Add class…</option>
            {DEFAULT_CLASSES.filter(c => !classes.find(cl => cl.name === c)).map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__custom">Custom...</option>
          </select>
          {newClassName === '__custom' && (
            <input placeholder="Class name" onChange={e => setNewClassName(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 12, width: 120 }} />
          )}
          <button onClick={onAdd} disabled={addingClass || !newClassName || newClassName === '__custom'}
            style={{ background: PURPLE_DARK, color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: !newClassName || newClassName === '__custom' ? .5 : 1 }}>
            {addingClass ? 'Adding…' : 'Add'}
          </button>
          {selectedClass && (
            <button onClick={() => onDelete(selectedClass)} title={`Delete ${selectedClass.name}`}
              style={{ background: '#fff', color: '#B91C1C', border: '1px solid #FECACA', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Cell edit modal ─────────────────────────────────────────
function CellModal({ editingCell, cellEntries, setCellEntries, conflictWarnings, setConflictWarnings, selectedClass,
  sortedTeachers, classSubjects, subjectTeachers, onClear, onCancel, onSave, onForceSave, savingCell }) {
  if (!editingCell) return null
  const lbl = { display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }
  const inp = { width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#fff', color: '#111827' }

  function setEntry(i, patch) {
    setCellEntries(prev => prev.map((en, idx) => idx === i ? { ...en, ...patch } : en))
    setConflictWarnings([])
  }
  function pickSubject(i, value) {
    if (value === '__custom') { setEntry(i, { subject: '', custom: true }); return }
    const teachers = subjectTeachers[value] || []
    // pre-fill the teacher if exactly one is assigned to this subject
    setEntry(i, { subject: value, custom: false, teacher_name: teachers.length === 1 ? teachers[0] : (cellEntries[i].teacher_name || '') })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 22, maxWidth: 460, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{editingCell.day} — Period {editingCell.label}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 16 }}>{fmt(editingCell.period.start_time)} – {fmt(editingCell.period.end_time)} &nbsp;·&nbsp; <span style={{ textTransform: 'uppercase' }}>{selectedClass?.name}</span></div>

        {conflictWarnings.length > 0 && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '10px 12px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>Schedule Conflict Detected</div>
            {conflictWarnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: '#92400E', marginBottom: 3 }}>{w}</div>)}
            <div style={{ fontSize: 11, color: '#78716C', marginTop: 8 }}>You can still save — this is a warning only.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => setConflictWarnings([])} style={{ flex: 1, background: '#F3F4F6', border: '1px solid #E5E7EB', padding: 7, borderRadius: 5, fontSize: 12, cursor: 'pointer', color: '#374151' }}>Go Back & Fix</button>
              <button onClick={onForceSave} style={{ flex: 1, background: '#92400E', border: 'none', padding: 7, borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Save Anyway</button>
            </div>
          </div>
        )}

        {conflictWarnings.length === 0 && (
          <>
            {cellEntries.map((entry, i) => {
              const inList = classSubjects.includes(entry.subject)
              const teachersFor = subjectTeachers[entry.subject] || []
              return (
                <div key={i} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 7, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE_MID, textTransform: 'uppercase', letterSpacing: .8 }}>
                      {cellEntries.length > 1 ? `Subject ${i + 1} (Split)` : 'Subject'}
                    </span>
                    {cellEntries.length > 1 && (
                      <button onClick={() => setCellEntries(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '2px 8px', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>Remove</button>
                    )}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={lbl}>Subject</label>
                    {entry.custom || (!inList && entry.subject) ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="text" value={entry.subject} placeholder="Type a subject name" autoFocus
                          onChange={e => setEntry(i, { subject: e.target.value })} style={{ ...inp, flex: 1 }} />
                        <button onClick={() => setEntry(i, { subject: '', custom: false })}
                          style={{ padding: '0 10px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>List</button>
                      </div>
                    ) : (
                      <select value={entry.subject} onChange={e => pickSubject(i, e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                        <option value="">— Select subject —</option>
                        {classSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="__custom">Other (type a name)…</option>
                      </select>
                    )}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={lbl}>Teacher</label>
                    <select value={entry.teacher_name} onChange={e => setEntry(i, { teacher_name: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                      <option value="">— No teacher yet —</option>
                      {teachersFor.length > 0 && (
                        <optgroup label="Assigned to this subject">
                          {teachersFor.map(t => <option key={'a' + t} value={t}>{t}</option>)}
                        </optgroup>
                      )}
                      <optgroup label={teachersFor.length ? 'All teachers' : 'Teachers (A–Z)'}>
                        {sortedTeachers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </optgroup>
                    </select>
                  </div>

                  <div>
                    <label style={lbl}>Role</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[[false, 'Subject Teacher'], [true, 'Class Teacher']].map(([val, label]) => (
                        <button key={String(val)} onClick={() => setEntry(i, { is_class_teacher: val })}
                          style={{ flex: 1, padding: 6, borderRadius: 5, border: `2px solid ${entry.is_class_teacher === val ? (val ? '#92400E' : '#1D4ED8') : '#E5E7EB'}`, background: entry.is_class_teacher === val ? (val ? '#FEF3C7' : '#EFF6FF') : '#F9FAFB', color: entry.is_class_teacher === val ? (val ? '#92400E' : '#1D4ED8') : '#6B7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            <button onClick={() => setCellEntries(prev => [...prev, { subject: '', teacher_name: '', is_class_teacher: false }])}
              style={{ width: '100%', background: PURPLE_LIGHT, color: PURPLE_MID, border: '1px dashed #A78BFA', padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
              + Add Another Subject (Split Period)
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClear} style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '9px 14px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
              <button onClick={onCancel} style={{ flex: 1, background: '#F3F4F6', border: '1px solid #E5E7EB', padding: 9, borderRadius: 5, fontSize: 13, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={onSave} disabled={savingCell}
                style={{ flex: 2, background: PURPLE_DARK, border: 'none', padding: 9, borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: savingCell ? 'not-allowed' : 'pointer', color: '#fff', opacity: savingCell ? .6 : 1 }}>
                {savingCell ? 'Saving...' : 'Save Period'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main grid ───────────────────────────────────────────────
export default function TimetableGrid({
  classes, selectedClass, setSelectedClass,
  classPeriods, timetableData, allTimetableData,
  currentSchoolYear, sortedTeachers,
  onSetTab, onRefresh,
  initializeClass,
  addClass, addingClass, newClassName, setNewClassName,
  deleteClass,
  timetableLoading,
}) {
  const [editingCell, setEditingCell]           = useState(null)
  const [cellEntries, setCellEntries]           = useState([])
  const [savingCell, setSavingCell]             = useState(false)
  const [conflictWarnings, setConflictWarnings] = useState([])
  const [classSubjects, setClassSubjects]       = useState([])   // names
  const [subjectTeachers, setSubjectTeachers]   = useState({})   // name -> [teacher]

  // Master subjects + assignments for the selected class
  useEffect(() => {
    if (!selectedClass) { setClassSubjects([]); setSubjectTeachers({}); return }
    let alive = true
    ;(async () => {
      const ck = classKey(selectedClass.name)
      const [{ data: subs }, { data: ts }] = await Promise.all([
        supabase.from('subjects').select('id, name').eq('school_year', currentSchoolYear).eq('class_name', ck).eq('active', true).order('name'),
        supabase.from('teacher_subjects').select('subject_id, teacher_name').eq('school_year', currentSchoolYear).eq('class_name', ck),
      ])
      if (!alive) return
      const byId = {}
      for (const s of (subs || [])) byId[s.id] = s.name
      const map = {}
      for (const a of (ts || [])) { const n = byId[a.subject_id]; if (n) (map[n] ||= []).push(a.teacher_name) }
      for (const k in map) map[k].sort()
      setClassSubjects((subs || []).map(s => s.name))
      setSubjectTeachers(map)
    })()
    return () => { alive = false }
  }, [selectedClass?.id, currentSchoolYear])

  // Slots for a day: the same period_numbers exist on every day, so take Monday's order as the column set
  const slotTemplate = labelSlots(classPeriods)
  const teachingCount = slotTemplate.filter(s => !s.is_break).length

  function checkConflicts(entries, day, periodNumber, currentPeriodId) {
    const warnings = []
    for (const entry of entries) {
      if (!entry.teacher_name || !entry.subject.trim()) continue
      const conflicts = allTimetableData.filter(e => {
        const p = e.timetable_periods
        if (!p || e.period_id === currentPeriodId) return false
        return e.teacher_name === entry.teacher_name && p.day === day && p.period_number === periodNumber
          && p.timetable_classes?.school_year === currentSchoolYear
      })
      if (conflicts.length > 0) {
        warnings.push(`${entry.teacher_name} is already in ${conflicts[0].timetable_periods?.timetable_classes?.name} on ${day}, this period`)
      }
    }
    return warnings
  }

  function openCell(day, slot) {
    const cell = timetableData[day]?.[slot.period_number]
    if (!cell) return
    setEditingCell({ period: cell.period, day, periodNumber: slot.period_number, label: slot.label })
    setCellEntries(cell.entries.length > 0
      ? cell.entries.map(e => ({ id: e.id, subject: e.subject, teacher_name: e.teacher_name, is_class_teacher: e.is_class_teacher || false }))
      : [{ subject: '', teacher_name: '', is_class_teacher: false }])
    setConflictWarnings([])
  }
  async function saveCell() {
    if (!editingCell) return
    const valid = cellEntries.filter(e => e.subject.trim())   // subject is enough; teacher can be added later
    const warnings = checkConflicts(valid, editingCell.day, editingCell.periodNumber, editingCell.period.id)
    if (warnings.length > 0) { setConflictWarnings(warnings); return }
    await doSaveCell()
  }
  async function doSaveCell() {
    setSavingCell(true)
    const periodId = editingCell.period.id
    await supabase.from('timetable_entries').delete().eq('period_id', periodId)
    const valid = cellEntries.filter(e => e.subject.trim())   // subject is enough; teacher can be added later
    if (valid.length > 0) {
      await supabase.from('timetable_entries').insert(valid.map(e => ({ period_id: periodId, subject: e.subject.trim(), teacher_name: e.teacher_name || '', is_class_teacher: e.is_class_teacher || false })))
    }
    setSavingCell(false); setEditingCell(null); setConflictWarnings([])
    await onRefresh(selectedClass.id)
  }
  async function clearCell() {
    if (!editingCell || !window.confirm('Clear this period?')) return
    await supabase.from('timetable_entries').delete().eq('period_id', editingCell.period.id)
    setEditingCell(null); setConflictWarnings([])
    await onRefresh(selectedClass.id)
  }

  return (
    <>
      <div>
        <ClassBar classes={classes} selectedClass={selectedClass} onSelect={setSelectedClass} onDelete={deleteClass}
          newClassName={newClassName} setNewClassName={setNewClassName} onAdd={addClass} addingClass={addingClass} />

        <div style={{ minWidth: 0 }}>
          {!selectedClass ? (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Select a class to build its timetable</div>
          ) : (
            <>
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', textTransform: 'uppercase' }}>{selectedClass.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{teachingCount} periods a day · click a cell to set subject and teacher</div>
                </div>
                <button onClick={() => onSetTab('periods_' + selectedClass.id)}
                  style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid #DDD6FE', background: '#F5F3FF', color: PURPLE_MID, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  Periods &amp; Breaks
                </button>
              </div>

              {timetableLoading ? (
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center' }}>
                  <div style={{ width: 26, height: 26, margin: '0 auto 12px', border: '3px solid #F3F4F6', borderTopColor: PURPLE_MID, borderRadius: '50%', animation: 'tt-spin .7s linear infinite' }} />
                  <div style={{ fontSize: 13, color: '#9CA3AF' }}>Loading timetable…</div>
                </div>
              ) : classPeriods.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 30, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>No periods set up for this class yet.</div>
                  <button onClick={() => initializeClass(selectedClass)}
                    style={{ background: PURPLE_DARK, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Initialize with Default Periods
                  </button>
                </div>
              ) : (
                <div className="tt-grid" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 120 + slotTemplate.length * 120 }}>
                      <thead>
                        <tr style={{ background: PURPLE_DARK }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#C4B5FD', letterSpacing: 1, textTransform: 'uppercase', width: 110, borderRight: '1px solid #4C1D95', position: 'sticky', left: 0, background: PURPLE_DARK, zIndex: 2 }}>Day</th>
                          {slotTemplate.map(s => (
                            <th key={s.period_number} style={{
                              padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderRight: '1px solid #4C1D95',
                              color: isDispersal(s) ? '#E5E7EB' : s.is_break ? '#6EE7B7' : '#C4B5FD', background: isDispersal(s) ? 'rgba(255,255,255,.08)' : s.is_break ? 'rgba(16,185,129,.18)' : 'transparent', width: s.is_break ? 78 : undefined, minWidth: s.is_break ? 78 : undefined,
                            }}>
                              {s.is_break ? (
                                <><span style={{ fontSize: 9.5, letterSpacing: .5 }}>{s.label}</span><div style={{ fontSize: 9, fontWeight: 500, color: isDispersal(s) ? '#D1D5DB' : '#A7F3D0', letterSpacing: 0, textTransform: 'none', marginTop: 2 }}>{isDispersal(s) ? fmt(s.start_time) : `${fmt(s.start_time)}–${fmt(s.end_time)}`}</div></>
                              ) : (
                                <>P<span style={{ fontSize: 14, color: '#fff' }}>{s.label}</span><div style={{ fontSize: 9, fontWeight: 500, color: '#A78BFA', letterSpacing: 0, textTransform: 'none', marginTop: 2 }}>{fmt(s.start_time)}–{fmt(s.end_time)}</div></>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map((day, di) => (
                          <tr key={day} style={{ borderBottom: '1px solid #F3F4F6', background: di % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <td style={{ padding: '12px 14px', borderRight: '1px solid #F3F4F6', verticalAlign: 'top', fontSize: 12, fontWeight: 700, color: PURPLE_MID, textTransform: 'uppercase', letterSpacing: .5, position: 'sticky', left: 0, background: di % 2 === 0 ? '#fff' : '#FAFAFA', zIndex: 1 }}>
                              {day}
                            </td>
                            {slotTemplate.map(slot => {
                              if (slot.is_break) return (
                                <td key={slot.period_number} style={{ borderRight: '1px solid #F3F4F6', background: isDispersal(slot) ? '#F9FAFB' : '#F0FDF4', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <span style={{ fontSize: 9, color: isDispersal(slot) ? '#9CA3AF' : '#059669', fontStyle: 'italic', display: 'block', padding: '6px 4px', lineHeight: 1.2, wordBreak: 'break-word' }}>{slot.label}</span>
                                </td>
                              )
                              const entries = timetableData[day]?.[slot.period_number]?.entries || []
                              return (
                                <td key={slot.period_number} className="tt-cell" onClick={() => openCell(day, slot)}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #F3F4F6', verticalAlign: 'top', minWidth: 120, cursor: 'pointer' }}>
                                  {entries.length === 0 ? <span style={{ fontSize: 11, color: '#D1D5DB' }}>+ Add</span> : entries.map((e, i) => (
                                    <div key={i} style={{ marginBottom: i < entries.length - 1 ? 6 : 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{e.subject}</div>
                                      <div style={{ fontSize: 11, color: e.teacher_name ? '#6B7280' : '#D1D5DB', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontStyle: e.teacher_name ? 'normal' : 'italic' }}>
                                        {e.teacher_name || 'no teacher yet'}
                                        {e.is_class_teacher && <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 4px', borderRadius: 2, fontWeight: 700 }}>CT</span>}
                                      </div>
                                      {i < entries.length - 1 && <div style={{ borderTop: '1px dashed #E5E7EB', marginTop: 5 }} />}
                                    </div>
                                  ))}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '8px 14px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>CT</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>= Class Teacher</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>dashed line = split period · breaks aren't counted as periods</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CellModal editingCell={editingCell} cellEntries={cellEntries} setCellEntries={setCellEntries}
        conflictWarnings={conflictWarnings} setConflictWarnings={setConflictWarnings} selectedClass={selectedClass}
        sortedTeachers={sortedTeachers} classSubjects={classSubjects} subjectTeachers={subjectTeachers}
        onClear={clearCell} onCancel={() => { setEditingCell(null); setConflictWarnings([]) }}
        onSave={saveCell} onForceSave={doSaveCell} savingCell={savingCell} />
    </>
  )
}