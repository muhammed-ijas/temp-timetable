import { useState } from 'react'
import { DAYS, ordinalPeriod, PURPLE_DARK, PURPLE_MID, PURPLE_LIGHT, PURPLE_BORDER } from './TimetableUtils'

export default function TeacherLoad({ sortedTeachers, teacherLoad }) {
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [teacherSortOrder, setTeacherSortOrder] = useState('alpha')

  // ── Teacher selector ────────────────────────────────────────────────────────
  if (!selectedTeacher) {
    const withCounts = sortedTeachers.map(teacher => {
      const load = teacherLoad[teacher.name]
      const totalPeriods = load ? Object.values(load).flat().length : 0
      return { teacher, totalPeriods, hasLoad: totalPeriods > 0 }
    })

    if (teacherSortOrder === 'periods') {
      withCounts.sort((a, b) => b.totalPeriods - a.totalPeriods || a.teacher.name.localeCompare(b.teacher.name))
    }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#6B7280' }}>Select a teacher to view their weekly schedule.</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: 0.5, textTransform: 'uppercase' }}>Sort:</span>
            {[['alpha', 'A – Z'], ['periods', 'Most Periods']].map(([key, label]) => (
              <button key={key} onClick={() => setTeacherSortOrder(key)}
                style={{ padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${teacherSortOrder === key ? PURPLE_MID : '#E5E7EB'}`, background: teacherSortOrder === key ? PURPLE_DARK : '#fff', color: teacherSortOrder === key ? '#F9FAFB' : '#6B7280' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {withCounts.map(({ teacher, totalPeriods, hasLoad }) => (
            <div key={teacher.name} className="teacher-card"
              onClick={() => setSelectedTeacher(teacher.name)}
              style={{ background: '#fff', border: `1px solid ${hasLoad ? '#E5E7EB' : '#F3F4F6'}`, borderRadius: 8, padding: '14px 12px', cursor: 'pointer', opacity: hasLoad ? 1 : 0.5 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: hasLoad ? PURPLE_DARK : '#E5E7EB', color: hasLoad ? '#DDD6FE' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>
                {teacher.name.trim().split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <div className="tc-name" style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3, marginBottom: 6 }}>{teacher.name}</div>
              <div className="tc-count" style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, background: hasLoad ? PURPLE_LIGHT : '#F3F4F6', color: hasLoad ? PURPLE_MID : '#9CA3AF', padding: '2px 7px', borderRadius: 10 }}>
                {totalPeriods} {totalPeriods === 1 ? 'period' : 'periods'}/wk
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Selected teacher schedule ───────────────────────────────────────────────
  const schedule = teacherLoad[selectedTeacher]
  const totalPeriods = schedule ? Object.values(schedule).flat().length : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => setSelectedTeacher(null)}
          style={{ background: PURPLE_LIGHT, color: PURPLE_MID, border: `1px solid ${PURPLE_BORDER}`, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ← All Teachers
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{selectedTeacher}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
            {schedule ? `${totalPeriods} periods/week` : 'No periods assigned yet'}
          </div>
        </div>
      </div>

      {!schedule ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          No timetable entries found for this teacher.
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', minWidth: 560 }}>
            {DAYS.map(day => {
              const slots = schedule[day] || []
              return (
                <div key={day} style={{ borderRight: day !== 'Friday' ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ padding: '9px 12px', borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' }}>{day}</div>
                    <div style={{ fontSize: 11, color: slots.length > 0 ? PURPLE_MID : '#D1D5DB', fontWeight: 600, marginTop: 2 }}>
                      {slots.length > 0 ? `${slots.length} period${slots.length > 1 ? 's' : ''}` : 'Free day'}
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    {slots.length === 0 ? (
                      <div style={{ fontSize: 11, color: '#D1D5DB', textAlign: 'center', padding: '12px 0' }}>—</div>
                    ) : slots.map((slot, i) => (
                      <div key={i} style={{ marginBottom: i < slots.length - 1 ? 8 : 0, paddingBottom: i < slots.length - 1 ? 8 : 0, borderBottom: i < slots.length - 1 ? '1px dashed #F3F4F6' : 'none' }}>
                        <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, marginBottom: 2 }}>{ordinalPeriod(slot.periodNumber)}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{slot.subject}</div>
                        <div style={{ fontSize: 10, color: '#047857', fontWeight: 600, marginTop: 1 }}>Class {slot.className}</div>
                        <div style={{ marginTop: 3 }}>
                          {slot.isClassTeacher
                            ? <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 2, fontWeight: 700 }}>CLASS TCH</span>
                            : <span style={{ fontSize: 9, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: 2, fontWeight: 700 }}>SUBJ TCH</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
           </div>
          <div style={{ padding: '8px 14px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {DAYS.map(day => {
              const n = (schedule[day] || []).length
              return (
                <span key={day} style={{ fontSize: 11, color: '#6B7280' }}>
                  <strong style={{ color: '#374151' }}>{day.slice(0,3)}:</strong> {n} period{n !== 1 ? 's' : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}