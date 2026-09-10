import { useState } from 'react'
import { DAYS, ordinalPeriod, PURPLE_DARK, PURPLE_MID, PURPLE_LIGHT, PURPLE_BORDER } from './TimetableUtils'
import { supabase } from '../../lib/supabase'

export default function PeriodManager({ selectedClass, classPeriods, timetableData, onBack, onRefresh }) {
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [showAddPeriod, setShowAddPeriod] = useState(false)
  const [newPeriod, setNewPeriod] = useState({ start_time: '', end_time: '', is_break: false, break_label: 'Break' })
  const [addingPeriod, setAddingPeriod] = useState(false)

  async function savePeriodTimes() {
    if (!editingPeriod || !selectedClass) return
    const { data: periodsToUpdate } = await supabase.from('timetable_periods')
      .select('id').eq('class_id', selectedClass.id).eq('period_number', editingPeriod.period_number)
    if (periodsToUpdate) {
      await supabase.from('timetable_periods').update({
        start_time: editingPeriod.start_time,
        end_time: editingPeriod.end_time,
        is_break: editingPeriod.is_break || false,
        break_label: editingPeriod.is_break ? (editingPeriod.break_label || 'Break') : null,
      }).in('id', periodsToUpdate.map(p => p.id))
    }
    setEditingPeriod(null)
    await onRefresh(selectedClass.id)
  }

  async function addPeriodToClass() {
    if (!selectedClass || !newPeriod.start_time || !newPeriod.end_time) { alert('Please enter start and end time.'); return }
    setAddingPeriod(true)
    const maxNum = classPeriods.length > 0 ? Math.max(...classPeriods.map(p => p.period_number)) : 0
    const nextNum = maxNum + 1
    const toInsert = DAYS.map(day => ({
      class_id: selectedClass.id, day, period_number: nextNum,
      start_time: newPeriod.start_time, end_time: newPeriod.end_time,
      is_break: newPeriod.is_break || false,
      break_label: newPeriod.is_break ? (newPeriod.break_label || 'Break') : null,
    }))
    await supabase.from('timetable_periods').insert(toInsert)
    setNewPeriod({ start_time: '', end_time: '', is_break: false, break_label: 'Break' })
    setShowAddPeriod(false)
    setAddingPeriod(false)
    await onRefresh(selectedClass.id)
  }

  async function deletePeriod(periodNumber) {
    if (!selectedClass) return
    if (!window.confirm(`Delete ${ordinalPeriod(periodNumber)} from Class ${selectedClass.name}?\nThis removes all subjects assigned to this period too.`)) return
    const { data: toDelete } = await supabase.from('timetable_periods')
      .select('id').eq('class_id', selectedClass.id).eq('period_number', periodNumber)
    if (toDelete && toDelete.length > 0) {
      await supabase.from('timetable_periods').delete().in('id', toDelete.map(p => p.id))
    }
    await onRefresh(selectedClass.id)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack}
            style={{ background: PURPLE_LIGHT, color: PURPLE_MID, border: `1px solid ${PURPLE_BORDER}`, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Back to Grid
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Manage Periods — Class {selectedClass.name}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Edit times, delete periods, or add new periods and breaks</div>
          </div>
        </div>
        <button onClick={() => setShowAddPeriod(p => !p)}
          style={{ background: showAddPeriod ? PURPLE_LIGHT : PURPLE_DARK, color: showAddPeriod ? PURPLE_MID : '#fff', border: `1px solid ${PURPLE_MID}`, padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {showAddPeriod ? 'Cancel' : '+ Add Period / Break'}
        </button>
      </div>

      {/* Add period form */}
      {showAddPeriod && (
        <div style={{ background: '#fff', border: `2px solid ${PURPLE_BORDER}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE_MID, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>New Period / Break</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Start Time</label>
              <input type="time" value={newPeriod.start_time} onChange={e => setNewPeriod(p => ({ ...p, start_time: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>End Time</label>
              <input type="time" value={newPeriod.end_time} onChange={e => setNewPeriod(p => ({ ...p, end_time: e.target.value }))}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827' }} />
            </div>
            <div>
              {newPeriod.is_break && (
                <>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Break Label</label>
                  <input type="text" value={newPeriod.break_label} onChange={e => setNewPeriod(p => ({ ...p, break_label: e.target.value }))}
                    placeholder="e.g. Lunch Break, Short Break"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827' }} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="is_break_chk" checked={newPeriod.is_break} onChange={e => setNewPeriod(p => ({ ...p, is_break: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="is_break_chk" style={{ fontSize: 12, color: '#374151', cursor: 'pointer', fontWeight: 500 }}>Mark as Break</label>
              </div>
              <button onClick={addPeriodToClass} disabled={addingPeriod || !newPeriod.start_time || !newPeriod.end_time}
                style={{ background: PURPLE_DARK, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newPeriod.start_time || !newPeriod.end_time ? 0.5 : 1 }}>
                {addingPeriod ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: PURPLE_MID, background: '#F5F3FF', borderRadius: 5, padding: '6px 10px' }}>
            This period will be added to all 5 days (Mon–Fri) for Class {selectedClass.name}.
          </div>
        </div>
      )}

      {classPeriods.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          No periods yet. Add one using the button above.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 80px 1fr 120px 100px', gap: 0, padding: '8px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Period', 'Start', 'End', 'Type', 'Used For', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {classPeriods.map((p, idx) => (
            <div key={p.period_number} style={{ borderBottom: idx < classPeriods.length - 1 ? '1px solid #F3F4F6' : 'none', background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
              {editingPeriod?.period_number === p.period_number ? (
                /* Inline edit row */
                <div style={{ padding: '12px 16px', background: '#F5F3FF', borderLeft: '3px solid #7C3AED' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Start Time</label>
                      <input type="time" value={editingPeriod.start_time}
                        onChange={e => setEditingPeriod(prev => ({ ...prev, start_time: e.target.value }))}
                        style={{ width: '100%', padding: '7px 9px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>End Time</label>
                      <input type="time" value={editingPeriod.end_time}
                        onChange={e => setEditingPeriod(prev => ({ ...prev, end_time: e.target.value }))}
                        style={{ width: '100%', padding: '7px 9px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Type</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[['period', 'Teaching Period'], ['break', 'Break']].map(([val, lbl]) => (
                          <button key={val} onClick={() => setEditingPeriod(prev => ({ ...prev, is_break: val === 'break' }))}
                            style={{ flex: 1, padding: '6px 4px', borderRadius: 5, border: `2px solid ${(val === 'break') === editingPeriod.is_break ? PURPLE_MID : '#E5E7EB'}`, background: (val === 'break') === editingPeriod.is_break ? PURPLE_LIGHT : '#F9FAFB', color: (val === 'break') === editingPeriod.is_break ? PURPLE_MID : '#6B7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    {editingPeriod.is_break && (
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Break Name</label>
                        <input type="text" value={editingPeriod.break_label || ''}
                          onChange={e => setEditingPeriod(prev => ({ ...prev, break_label: e.target.value }))}
                          placeholder="e.g. Lunch Break"
                          style={{ width: '100%', padding: '7px 9px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={savePeriodTimes}
                      style={{ background: PURPLE_DARK, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Save Changes
                    </button>
                    <button onClick={() => setEditingPeriod(null)}
                      style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', padding: '8px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal display row */
                <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 80px 1fr 120px 100px', gap: 0, padding: '11px 16px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.is_break ? '#059669' : PURPLE_MID }}>
                      {p.is_break ? (p.break_label || 'Break') : ordinalPeriod(p.period_number)}
                    </div>
                    {p.is_break && <div style={{ fontSize: 9, color: '#059669', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>Break</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{p.start_time}</div>
                  <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{p.end_time}</div>
                  <div>
                    {p.is_break
                      ? <span style={{ fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>Break / Recess</span>
                      : <span style={{ fontSize: 10, background: PURPLE_LIGHT, color: PURPLE_MID, padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>Teaching Period</span>
                    }
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {(() => {
                      const count = DAYS.reduce((n, day) => {
                        const cell = timetableData[day]?.[p.period_number]
                        return n + (cell?.entries?.length > 0 ? 1 : 0)
                      }, 0)
                      return count > 0 ? `${count}/5 days assigned` : 'No subjects yet'
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingPeriod({ ...p })}
                      style={{ background: PURPLE_LIGHT, color: PURPLE_MID, border: `1px solid ${PURPLE_BORDER}`, padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => deletePeriod(p.period_number)}
                      style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '5px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#374151' }}><strong>{classPeriods.filter(p => !p.is_break).length}</strong> teaching periods</span>
            <span style={{ fontSize: 12, color: '#374151' }}><strong>{classPeriods.filter(p => p.is_break).length}</strong> breaks</span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Delete removes the period from all 5 days and clears any assigned subjects.</span>
          </div>
        </div>
      )}
    </div>
  )
}