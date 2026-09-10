import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, getSchoolYear, getSchoolYearLabel } from '../lib/supabase'
import { getClassOfTeacher } from '../lib/classTeachers'
import { classKey } from '../lib/examConfig'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function todayDayName() {
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const ArrowLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)
const PrintIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
)

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #111;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hdr { display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2.5px solid #1C1C1E; }
  .title { font-size: 20px; font-weight: 800; color: #111; }
  .sub { font-size: 10px; color: #6B7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #1C1C1E !important; color: #fff !important; padding: 8px 6px;
    font-size: 9px; font-weight: 700; border: 1px solid #333; text-align: left; }
  td { border: 1px solid #C4C4C4; padding: 7px 6px; font-size: 9px; vertical-align: top; }
  .pcell { background: #F5F3FF !important; text-align: center; font-weight: 800;
    vertical-align: middle; }
  .brk td { background: #F0FDF4 !important; color: #059669; text-align: center;
    font-style: italic; font-weight: 700; }
 .sig { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; }
  .sig-in { text-align: center; width: 170px; }
  .sig-line { border-top: 1.5px solid #374151; padding-top: 5px; font-size: 9px;
    font-weight: 700; text-transform: uppercase; color: #374151; }
  .sig-in img { width: 90px; height: auto; object-fit: contain; display: block;
    margin: 0 auto 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 55%; aspect-ratio: 1;
    background-image: url('/logowithtext.png');
    background-repeat: no-repeat; background-position: center; background-size: contain;
    opacity: 0.06; z-index: 0; pointer-events: none;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  tr { page-break-inside: avoid; }
`

export default function MyClassTimetable() {
  const navigate = useNavigate()
  const location = useLocation()
  const teacher = location.state?.teacher

  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const myClassKey = teacher ? getClassOfTeacher(teacher.name) : null

  const [className, setClassName] = useState('')
  const [periods, setPeriods] = useState([])
  const [gridData, setGridData] = useState({})
  const [todaySubs, setTodaySubs] = useState([])
  const [loading, setLoading] = useState(true)

  const TODAY_DAY = todayDayName()

  // A substitution covering this class + period today
  function subFor(periodNumber, teacherName) {
    return todaySubs.find(s =>
      s.period_number === periodNumber && s.absent_teacher === teacherName
    ) || null
  }

  useEffect(() => {
    if (!teacher) { navigate('/login', { replace: true }); return }
    if (myClassKey) load()
    else setLoading(false)
  }, [])

  async function load() {
    setLoading(true)

    // classTeachers stores "2" / "Nursery"; the timetable stores "2 A" / "Nursery A".
    // Match on the normalised key so either naming works.
    const { data: classes } = await supabase
      .from('timetable_classes')
      .select('*')
      .eq('school_year', currentSchoolYear)

    const cls = (classes || []).find(c => classKey(c.name) === myClassKey)
    if (!cls) { setLoading(false); return }
    setClassName(cls.name)

    const { data: pers } = await supabase
      .from('timetable_periods')
      .select('*')
      .eq('class_id', cls.id)
      .order('period_number')

    if (!pers || pers.length === 0) { setLoading(false); return }

    const { data: entries } = await supabase
      .from('timetable_entries')
      .select('*')
      .in('period_id', pers.map(p => p.id))

    // unique slots, in order
    const slots = []
    const seen = new Set()
    for (const p of pers) {
      if (seen.has(p.period_number)) continue
      seen.add(p.period_number)
      slots.push({
        period_number: p.period_number,
        start_time: p.start_time,
        end_time: p.end_time,
        is_break: p.is_break,
        break_label: p.break_label,
      })
    }
    slots.sort((a, b) => a.period_number - b.period_number)
    setPeriods(slots)

    const grid = {}
    for (const p of pers) {
      if (!grid[p.day]) grid[p.day] = {}
      grid[p.day][p.period_number] = (entries || []).filter(e => e.period_id === p.id)
    }
    setGridData(grid)

    // Today's substitutions for this class
    const { data: subs } = await supabase
      .from('substitutions')
      .select('*')
      .eq('date', todayStr())
      .eq('class_name', cls.name)
      .eq('school_year', currentSchoolYear)
    setTodaySubs(subs || [])

    setLoading(false)
  }

  function handlePrint() {
    const rowsHTML = periods.map(p => {
      if (p.is_break) {
        return `<tr class="brk"><td colspan="6">${p.break_label || 'Break'} · ${p.start_time}–${p.end_time}</td></tr>`
      }
      const cells = DAYS.map(day => {
        const list = gridData[day]?.[p.period_number] || []
        if (list.length === 0) return `<td style="color:#D1D5DB;font-style:italic">—</td>`
        return `<td>${list.map((e, i) => `
          <div style="${i < list.length - 1 ? 'margin-bottom:5px;padding-bottom:5px;border-bottom:1px dashed #E5E7EB' : ''}">
            <div style="font-weight:700">${e.subject || ''}</div>
            <div style="font-size:8px;color:#555;margin-top:1px">${e.teacher_name || ''}</div>
          </div>`).join('')}</td>`
      }).join('')
      return `<tr>
        <td class="pcell">
          <div style="font-size:10px">${ordinal(p.period_number)}</div>
          <div style="font-size:8px;color:#555;margin-top:2px">${p.start_time}–${p.end_time}</div>
        </td>${cells}</tr>`
    }).join('')

    const html = `
      <div class="hdr">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo.png" style="height:34px;object-fit:contain" onerror="this.style.display='none'" />
          <div>
            <div style="font-size:9px;font-weight:700;color:#7C3AED;letter-spacing:1px;text-transform:uppercase">Premier Global School</div>
            <div class="title">Class ${className}</div>
            <div class="sub">Weekly Class Timetable</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#6B7280">
          <div style="font-weight:600;color:#374151">Academic Year ${schoolYearLabel}</div>
          <div style="margin-top:2px">Class Teacher: ${teacher.name?.trim()}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:80px;text-align:center">Period</th>
          ${DAYS.map(d => `<th>${d}</th>`).join('')}
        </tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
     <div class="sig">
        <div class="sig-in">
          <div style="height:34px"></div>
          <div class="sig-line">Class Teacher</div>
          <div style="font-size:8px;color:#6B7280;margin-top:3px">${teacher.name?.trim()}</div>
        </div>
        <div style="font-size:8px;color:#ccc;text-align:center;align-self:flex-end;padding-bottom:4px">
          Premier Global School · AY ${schoolYearLabel}
        </div>
        <div class="sig-in">
          <img src="/sign.png" alt="Signature" onerror="this.style.display='none'" />
          <div class="sig-line">Vice Principal</div>
          <div style="font-size:8px;color:#6B7280;margin-top:3px">Premier Global School</div>
        </div>
      </div>
    `
    const win = window.open('', '_blank', 'width=1200,height=850')
win.document.write(`<!DOCTYPE html><html><head><title>Class ${className} Timetable</title><style>${PRINT_CSS}</style></head><body><div class="print-watermark"></div>${html}</body></html>`)    
win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  if (!teacher) return null

  const TH = {
    background: '#1C1C1E', color: '#F2F2F7', padding: '11px 12px', fontSize: 11,
    fontWeight: 700, textAlign: 'left', letterSpacing: 0.8, textTransform: 'uppercase',
    borderRight: '1px solid #2C2C2E', whiteSpace: 'nowrap',
  }
  const TD = {
    borderBottom: '1px solid #E5E5EA', borderRight: '1px solid #E5E5EA',
    padding: '10px 12px', verticalAlign: 'top',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; cursor: pointer; }
        @keyframes ct-spin { to { transform: rotate(360deg) } }
      `}</style>

      <header style={{ background: '#1C1C1E', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 14px', height: 54, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button onClick={() => navigate('/dashboard', { state: { teacher } })}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
              <ArrowLeft /> Dashboard
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 700 }}>My Class Timetable</div>
              <div style={{ color: '#636366', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>
                {className ? `Class ${className}` : teacher.name?.trim()}
              </div>
            </div>
          </div>
          {className && (
            <button onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F2F7', border: 'none', color: '#1C1C1E', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              <PrintIcon /> Print
            </button>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 14px 40px' }}>

        {!myClassKey ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Only class teachers can view this</div>
            <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
              You're not set as a class teacher, so there's no class timetable to show here.
            </div>
          </div>
        ) : loading ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 48, textAlign: 'center' }}>
            <div style={{ width: 28, height: 28, margin: '0 auto 12px', border: '3px solid #F2F2F7', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'ct-spin 0.7s linear infinite' }} />
            <div style={{ fontSize: 13, color: '#8E8E93' }}>Loading class timetable…</div>
          </div>
        ) : periods.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>No timetable set up yet</div>
            <div style={{ fontSize: 13, color: '#8E8E93' }}>Please check with the VP.</div>
          </div>
        ) : (
          <>
            <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '16px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>Your Class</div>
                <div style={{ color: '#F2F2F7', fontSize: 20, fontWeight: 700 }}>Class {className}</div>
              </div>
              <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'right' }}>
                Full weekly schedule<br/>
                <span style={{ color: '#636366', fontSize: 11 }}>AY {schoolYearLabel}</span>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, width: 110, textAlign: 'center' }}>Period</th>
                      {DAYS.map(d => <th key={d} style={TH}>{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, idx) => p.is_break ? (
                      <tr key={p.period_number}>
                        <td colSpan={6} style={{
                          borderBottom: '1px solid #E5E5EA', background: '#F0FDF4',
                          textAlign: 'center', padding: '10px', color: '#059669',
                          fontSize: 13, fontWeight: 700, fontStyle: 'italic',
                        }}>
                          {p.break_label || 'Break'} · {p.start_time}–{p.end_time}
                        </td>
                      </tr>
                    ) : (
                      <tr key={p.period_number} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ ...TD, background: '#F5F3FF', textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid #E5E5EA', width: 110 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1C1C1E' }}>{ordinal(p.period_number)}</div>
                          <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 3, fontFamily: "'DM Mono', monospace" }}>{p.start_time}–{p.end_time}</div>
                        </td>
                        {DAYS.map(day => {
                          const list = gridData[day]?.[p.period_number] || []
                          return (
                            <td key={day} style={TD}>
                              {list.length === 0 ? (
                                <span style={{ fontSize: 12, color: '#D1D1D6', fontStyle: 'italic' }}>—</span>
                             ) : list.map((e, i) => {
                                const sub = day === TODAY_DAY ? subFor(p.period_number, e.teacher_name) : null
                                return (
                                <div key={i} style={{
                                  marginBottom: i < list.length - 1 ? 7 : 0,
                                  paddingBottom: i < list.length - 1 ? 7 : 0,
                                  borderBottom: i < list.length - 1 ? '1px dashed #E5E5EA' : 'none',
                                }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{e.subject}</div>
                                  <div style={{
                                    fontSize: 11, marginTop: 2,
                                    color: sub ? '#9CA3AF' : '#636366',
                                    textDecoration: sub ? 'line-through' : 'none',
                                  }}>{e.teacher_name}</div>
                                  {sub && (
                                    <div style={{ marginTop: 3 }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46' }}>→ {sub.substitute_teacher}</div>
                                      <span style={{ fontSize: 9, background: '#D1FAE5', color: '#065F46', padding: '1px 5px', borderRadius: 3, fontWeight: 800, display: 'inline-block', marginTop: 2 }}>SUB TODAY</span>
                                    </div>
                                  )}
                                  {e.is_class_teacher && !sub && (
                                    <span style={{ fontSize: 9, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, fontWeight: 700, display: 'inline-block', marginTop: 3 }}>CLASS TCH</span>
                                  )}
                                </div>
                              )})}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid #F2F2F7', background: '#FAFAFA', fontSize: 11, color: '#8E8E93' }}>
                Read-only · dashed line = split period · use Print for a copy to put up in class
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}