import { useState, useRef, useEffect } from 'react'
import { DAYS, ordinalPeriod, PURPLE_DARK, PURPLE_MID, PURPLE_LIGHT, PURPLE_BORDER } from './TimetableUtils'
import { supabase } from '../../lib/supabase'

// ─── Print CSS ──────────────────────────────────
const PRINT_STYLES = `
  @page { 
    size: A4 portrait; 
    margin: 10mm; 
  }

  * { 
    box-sizing: border-box; 
    margin: 0; 
    padding: 0; 
  }
  
  body { 
    font-family: 'Segoe UI', Arial, sans-serif; 
    font-size: 7px; 
    color: #111; 
    line-height: 1.1;
    -webkit-print-color-adjust: exact; 
    print-color-adjust: exact;
    position: relative;
    width: 100%;          
    max-width: 100%;       
  }

  /* ← REMOVED body::before watermark block entirely */
  
  table { 
    width: 100%; 
    border-collapse: collapse; 
    table-layout: fixed; 
    margin-bottom: 6px;
    max-width: 100%;       
  }
  
  th { 
    background: #3B0764 !important; 
    color: #fff !important; 
    padding: 3px 3px !important; 
    text-align: center; 
    font-size: 7px; 
    font-weight: 700; 
    letter-spacing: 0.2px; 
    border: 1px solid #2C1A5E !important;
    line-height: 1.1;
  }
  
  td { 
    border: 1px solid #C4C4C4 !important;
    padding: 2.5px 3px !important; 
    vertical-align: top; 
    font-size: 7px; 
    line-height: 1.14;
  }

  tr {
    border-bottom: 1px solid #A8A8A8 !important;
  }

  .period-cell { 
    background: #F5F3FF !important; 
    text-align: center; 
    font-weight: 700; 
    color: #3B0764; 
    font-size: 8.5px;
    padding: 3.5px 3px !important;
    border: 1px solid #C4C4C4 !important;
  }

  .break-row td { 
    background: #F0FDF4 !important; 
    color: #059669; 
    text-align: center; 
    font-style: italic; 
    font-size: 7.6px; 
    padding: 3.5px !important;
    border: 1px solid #A8A8A8 !important;
  }

  .doc-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 7px; 
    padding-bottom: 6px; 
    border-bottom: 2px solid #3B0764; 
  }

  .footer { 
    margin-top: 6px; 
    font-size: 6.8px; 
    color: #aaa; 
    text-align: right; 
  }

  td > div {
    margin-bottom: 2px !important;
    padding-bottom: 2px !important;
  }

  .sub-badge, .absent-badge { 
    font-size: 6.2px; 
    padding: 1px 3px; 
  }

  /* ─── Watermark div (replaces body::before) ─── */
  .print-watermark {
    position: fixed;           /* fixed still works as a div on most engines */
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    aspect-ratio: 1;
    background-image: url('/logowithtext.png');
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    opacity: 0.06;
    z-index: 0;
    pointer-events: none;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .signature-block {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
    width: 100%;
  }

  .signature-inner {
    text-align: center;
    width: 110px;
  }

  .signature-block img {
    width: 90px;
    height: auto;
    object-fit: contain;
    display: block;
    margin: 0 auto 4px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .signature-line {
    border-top: 1px solid #374151;
    padding-top: 4px;
    font-size: 7.5px;
    font-weight: 700;
    color: #374151;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .signature-sub {
    font-size: 6.5px;
    color: #6B7280;
    margin-top: 2px;
  }

  @media print { 
    body { margin: 0; } 
    .master-day { 
      page-break-inside: avoid !important; 
      margin-bottom: 8px; 
    }
    tr { page-break-inside: avoid; }
  }
`

const SIGNATURE_HTML = `
  <div class="signature-block">
    <div class="signature-inner">
      <img src="/sign.png" alt="Signature" onerror="this.style.display='none'" />
      <div class="signature-line">Vice Principal</div>
      <div class="signature-sub">Premier Global School</div>
    </div>
  </div>
`

const SIGNATURE_JSX = (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
    <div style={{ textAlign: 'center', width: 110 }}>
      <img src="/sign.png" alt="Signature"
        style={{ width: 90, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 4px' }}
        onError={e => e.target.style.display = 'none'} />
      <div style={{ borderTop: '1px solid #374151', paddingTop: 4, fontSize: 9, fontWeight: 700, color: '#374151', letterSpacing: 0.5, textTransform: 'uppercase' }}>Vice Principal</div>
      <div style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>Premier Global School</div>
    </div>
  </div>
)

// Watermark injected once into the body
const WATERMARK_HTML = `<div class="print-watermark"></div>`

function openPrint(html, title) {
  const win = window.open('', '_blank', 'width=1100,height=750')
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_STYLES}</style></head><body>${WATERMARK_HTML}${html}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 400)
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function PrintLogo({ size = 24 }) {
  return (
    <img src="/logo.png" alt="PGS"
      style={{ height: size, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
      onError={e => e.target.style.display = 'none'} />
  )
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function todayStr() { return new Date().toISOString().split('T')[0] }
function getDayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00').getDay()
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]
}

// ─── UI primitives ────────────────────────────────────────────────────────────
function DocHeader({ title, subtitle, meta, schoolYearLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '2.5px solid #3B0764' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <PrintLogo />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', letterSpacing: 1, textTransform: 'uppercase' }}>Premier Global School</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginTop: 2, letterSpacing: -0.3 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: 10, color: '#6B7280', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, color: '#374151' }}>Academic Year {schoolYearLabel}</div>
        {meta && <div style={{ marginTop: 2 }}>{meta}</div>}
      </div>
    </div>
  )
}

function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid #E5E7EB' }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          style={{
            padding: '8px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: active === key ? 700 : 400,
            color: active === key ? PURPLE_MID : '#6B7280',
            borderBottom: `3px solid ${active === key ? PURPLE_MID : 'transparent'}`,
            marginBottom: -2, transition: 'all 0.15s',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function PrintToolbar({ onPrint, disabled, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {children}
      <button onClick={onPrint} disabled={disabled}
        style={{
          marginLeft: 'auto', background: disabled ? '#F3F4F6' : 'linear-gradient(135deg,#5B21B6,#3B0764)',
          color: disabled ? '#9CA3AF' : '#fff', border: 'none', padding: '10px 24px',
          borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(91,33,182,0.35)',
          display: 'flex', alignItems: 'center', gap: 7, letterSpacing: 0.2,
        }}>
        🖨 Print / Download
      </button>
    </div>
  )
}

function EmptyPreview({ text }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 56, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
      <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>{text}</div>
    </div>
  )
}

function PreviewCard({ children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 24, overflowX: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginBottom: 12, textAlign: 'right', letterSpacing: 1, textTransform: 'uppercase' }}>Preview</div>
      {children}
    </div>
  )
}

// ─── Shared table styles ──────────────────────────────────────────────────────
const TH = {
  background: PURPLE_DARK, color: '#E9D5FF', padding: '7px 8px',
  textAlign: 'left', fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', borderRight: '1px solid #4C1D95', whiteSpace: 'nowrap',
}
const TH_CENTER = { ...TH, textAlign: 'center' }
const TD = {
  border: 'none', borderBottom: '1px solid #F3F4F6', borderRight: '1px solid #F3F4F6',
  padding: '9px 11px', verticalAlign: 'top', fontSize: 12,
}
const TD_PERIOD = {
  ...TD,
  background: '#F5F3FF', textAlign: 'center', verticalAlign: 'middle',
  borderRight: '1px solid #DDD6FE', minWidth: 90,
}

function PeriodCell({ p }) {
  if (p.is_break) return (
    <td style={{ ...TD_PERIOD, background: '#F0FDF4' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', fontStyle: 'italic' }}>{p.break_label || 'Break'}</div>
    </td>
  )
  return (
    <td style={TD_PERIOD}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#3B0764' }}>{ordinalPeriod(p.period_number)}</div>
      <div style={{ fontSize: 9, color: '#374151', marginTop: 3, fontFamily: 'monospace', fontWeight: 600 }}>{p.start_time}–{p.end_time}</div>
    </td>
  )
}

function BreakRow({ p, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ ...TD, background: '#F0FDF4', textAlign: 'center', color: '#059669', fontStyle: 'italic', fontSize: 11, padding: '6px', fontWeight: 600 }}>
        {p.break_label || 'Break'} &nbsp;·&nbsp; {p.start_time}–{p.end_time}
      </td>
    </tr>
  )
}

function Badge({ bg, color, children, style = {} }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: bg, color, letterSpacing: 0.3, ...style }}>
      {children}
    </span>
  )
}

function EmptyCell() {
  return <td style={{ ...TD, color: '#D1D5DB', fontSize: 11, fontStyle: 'italic' }}>—</td>
}

function RowBg(idx) {
  return idx % 2 === 0 ? '#fff' : '#FAFAFA'
}

function ToolLabel({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const SELECT_STYLE = {
  padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB',
  fontSize: 13, color: '#111827', background: '#FAFAFA', cursor: 'pointer', minWidth: 200,
}
const DATE_STYLE = {
  padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB',
  fontSize: 13, color: '#111827', background: '#FAFAFA',
}

// ─────────────────────────────────────────────────────────────────────────────
// BY TEACHER
// ─────────────────────────────────────────────────────────────────────────────
function PrintTeacher({ sortedTeachers, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [selected, setSelected] = useState('')
  const printRef = useRef()

  function getPeriods() {
    const map = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear) continue
      if (!map[p.period_number]) map[p.period_number] = { period_number: p.period_number, start_time: p.start_time, end_time: p.end_time, is_break: p.is_break, break_label: p.break_label }
    }
    return Object.values(map).sort((a, b) => a.period_number - b.period_number)
  }

  function getSchedule(name) {
    const s = {}
    for (const day of DAYS) s[day] = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || e.teacher_name !== name) continue
      s[p.day][p.period_number] = { subject: e.subject, className: p.timetable_classes?.name }
    }
    return s
  }

  const periods  = getPeriods()
  const schedule = selected ? getSchedule(selected) : null
  const total    = schedule ? DAYS.reduce((n, d) => n + Object.keys(schedule[d]).length, 0) : 0

  return (
    <div>
      <PrintToolbar onPrint={() => openPrint(printRef.current.innerHTML, `Timetable — ${selected}`)} disabled={!selected}>
        <ToolLabel label="Teacher">
          <select value={selected} onChange={e => setSelected(e.target.value)} style={SELECT_STYLE}>
            <option value="">— Select a teacher —</option>
            {sortedTeachers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </ToolLabel>
        {selected && (
          <Badge bg={PURPLE_LIGHT} color={PURPLE_MID} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
            {total} periods/week
          </Badge>
        )}
      </PrintToolbar>

      {!selected ? <EmptyPreview text="Select a teacher to preview their timetable" /> : (
        <PreviewCard>
          <div ref={printRef}>
            <DocHeader title={selected} subtitle="Weekly Teaching Timetable" meta={`${total} periods/week`} schoolYearLabel={schoolYearLabel} />
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: PURPLE_DARK }}>
                  <th style={{ ...TH_CENTER, width: 100 }}>Period</th>
                  {DAYS.map(d => <th key={d} style={TH}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, idx) => {
                  if (p.is_break) return <BreakRow key={p.period_number} p={p} colSpan={6} />
                  return (
                    <tr key={p.period_number} style={{ background: RowBg(idx) }}>
                      <PeriodCell p={p} />
                      {DAYS.map(day => {
                        const slot = schedule[day]?.[p.period_number]
                        return slot ? (
                          <td key={day} style={TD}>
                            <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', marginBottom: 3 }}>{slot.subject}</div>
                            <div style={{ fontSize: 10, color: '#047857', fontWeight: 600 }}>Class {slot.className}</div>
                          </td>
                        ) : <EmptyCell key={day} />
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {SIGNATURE_JSX}
            <div style={{ marginTop: 8, fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>Printed from VP Timetable Manager · Premier Global School · AY {schoolYearLabel}</div>
          </div>
        </PreviewCard>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BY CLASS
// ─────────────────────────────────────────────────────────────────────────────
function PrintClass({ classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [selected, setSelected] = useState('')
  const printRef = useRef()

  function getPeriods() {
    const map = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || p.timetable_classes?.name !== selected) continue
      if (!map[p.period_number]) map[p.period_number] = { period_number: p.period_number, start_time: p.start_time, end_time: p.end_time, is_break: p.is_break, break_label: p.break_label }
    }
    return Object.values(map).sort((a, b) => a.period_number - b.period_number)
  }

  function getSchedule() {
    const s = {}
    for (const day of DAYS) s[day] = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || p.timetable_classes?.name !== selected) continue
      if (!s[p.day][p.period_number]) s[p.day][p.period_number] = []
      s[p.day][p.period_number].push({ subject: e.subject, teacher: e.teacher_name })
    }
    return s
  }

  const periods  = selected ? getPeriods() : []
  const schedule = selected ? getSchedule() : {}

  return (
    <div>
      <PrintToolbar onPrint={() => openPrint(printRef.current.innerHTML, `Timetable — Class ${selected}`)} disabled={!selected}>
        <ToolLabel label="Class">
          <select value={selected} onChange={e => setSelected(e.target.value)} style={SELECT_STYLE}>
            <option value="">— Select a class —</option>
            {classes.map(c => <option key={c.id} value={c.name}>Class {c.name}</option>)}
          </select>
        </ToolLabel>
      </PrintToolbar>

      {!selected ? <EmptyPreview text="Select a class to preview its timetable" /> : (
        <PreviewCard>
          <div ref={printRef}>
            <DocHeader title={`Class ${selected}`} subtitle="Weekly Class Timetable" schoolYearLabel={schoolYearLabel} />
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: PURPLE_DARK }}>
                  <th style={{ ...TH_CENTER, width: 100 }}>Period</th>
                  {DAYS.map(d => <th key={d} style={TH}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {periods.map((p, idx) => {
                  if (p.is_break) return <BreakRow key={p.period_number} p={p} colSpan={6} />
                  return (
                    <tr key={p.period_number} style={{ background: RowBg(idx) }}>
                      <PeriodCell p={p} />
                      {DAYS.map(day => {
                        const entries = schedule[day]?.[p.period_number] || []
                        return entries.length === 0 ? <EmptyCell key={day} /> : (
                          <td key={day} style={TD}>
                            {entries.map((e, i) => (
                              <div key={i} style={{ marginBottom: i < entries.length - 1 ? 8 : 0, paddingBottom: i < entries.length - 1 ? 8 : 0, borderBottom: i < entries.length - 1 ? '1px dashed #E5E7EB' : 'none' }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', marginBottom: 2 }}>{e.subject}</div>
                                <div style={{ fontSize: 10.5, color: '#555' }}>{e.teacher}</div>
                              </div>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {SIGNATURE_JSX}
            <div style={{ marginTop: 8, fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>Printed from VP Timetable Manager · Premier Global School · AY {schoolYearLabel}</div>
          </div>
        </PreviewCard>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER
// ─────────────────────────────────────────────────────────────────────────────
function PrintMaster({ classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const printRef = useRef()

  function getClassPeriods(name) {
    const map = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || p.timetable_classes?.name !== name) continue
      if (!map[p.period_number]) map[p.period_number] = { period_number: p.period_number, start_time: p.start_time, end_time: p.end_time, is_break: p.is_break, break_label: p.break_label }
    }
    return Object.values(map).sort((a, b) => a.period_number - b.period_number)
  }

  function getClassSchedule(name) {
    const s = {}
    for (const day of DAYS) s[day] = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || p.timetable_classes?.name !== name) continue
      if (!s[p.day][p.period_number]) s[p.day][p.period_number] = []
      s[p.day][p.period_number].push({ subject: e.subject, teacher: e.teacher_name })
    }
    return s
  }

  function getAllPeriodMeta() {
    const map = {}
    for (const cls of classes) {
      for (const p of getClassPeriods(cls.name)) {
        if (!map[p.period_number]) map[p.period_number] = p
      }
    }
    return Object.values(map).sort((a, b) => a.period_number - b.period_number)
  }

  const allPeriods  = getAllPeriodMeta()
  const scheduleMap = Object.fromEntries(classes.map(cls => [cls.name, getClassSchedule(cls.name)]))

  function buildMasterPrintHTML() {
    const dayBlocks = DAYS.map(day => {
      const headerCols = `
        <tr style="background:#3B0764">
          <th style="width:75px;color:#E9D5FF;padding:7px 6px;font-size:9px;font-weight:700;border:1px solid #4C1D95;text-align:center">Period</th>
          ${classes.map(cls => `
            <th style="width:${100 / classes.length}%;color:#E9D5FF;padding:7px 6px;font-size:9px;font-weight:700;border:1px solid #4C1D95;text-align:left">
              Cls ${cls.name}
            </th>
          `).join('')}
        </tr>`

      const bodyRows = allPeriods.map((p, idx) => {
        if (p.is_break) return `<tr><td colspan="${classes.length + 1}" style="background:#F0FDF4;text-align:center;color:#059669;font-style:italic;font-size:9px;padding:5px 6px;font-weight:600;border:1px solid #E5E7EB">${p.break_label || 'Break'} · ${p.start_time}–${p.end_time}</td></tr>`
        const bg = idx % 2 === 0 ? '#fff' : '#FAFAFA'
        const periodTd = `<td style="background:#F5F3FF;text-align:center;vertical-align:middle;border:1px solid #DDD6FE;padding:7px 8px"><div style="font-size:10px;font-weight:800;color:#3B0764">${ordinalPeriod(p.period_number)}</div><div style="font-size:8px;color:#374151;font-weight:600;margin-top:2px;font-family:monospace">${p.start_time}–${p.end_time}</div></td>`
        const classCols = classes.map(cls => {
          const entries = scheduleMap[cls.name]?.[day]?.[p.period_number] || []
          if (entries.length === 0) return `<td style="border:1px solid #F3F4F6;padding:7px 8px;color:#D1D5DB;font-style:italic;font-size:9px">—</td>`
          const inner = entries.map((e, i) => `
            <div style="margin-bottom:${i < entries.length - 1 ? '5px' : '0'};padding-bottom:${i < entries.length - 1 ? '5px' : '0'};border-bottom:${i < entries.length - 1 ? '1px dashed #E5E7EB' : 'none'}">
              <div style="font-weight:700;font-size:9.5px;color:#111827">${e.subject}</div>
              <div style="font-size:8px;color:#555;margin-top:1px">${e.teacher}</div>
            </div>`).join('')
          return `<td style="background:${bg};border:1px solid #F3F4F6;padding:7px 8px;vertical-align:top">${inner}</td>`
        }).join('')
        return `<tr style="background:${bg}">${periodTd}${classCols}</tr>`
      }).join('')

      return `
        <div style="margin-bottom:24px;page-break-inside:avoid;break-inside:avoid">
          <div style="font-weight:800;font-size:13px;color:#3B0764;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #4C1D95;letter-spacing:0.3px">${day}</div>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed">
            <thead>${headerCols}</thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>`
    }).join('')

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:2.5px solid #3B0764">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo.png" alt="PGS" style="height:34px;object-fit:contain" onerror="this.style.display='none'" />
          <div>
            <div style="font-size:10px;font-weight:700;color:#7C3AED;letter-spacing:1px;text-transform:uppercase">Premier Global School</div>
            <div style="font-size:18px;font-weight:800;color:#111;margin-top:2px">Master Timetable</div>
            <div style="font-size:10px;color:#6B7280;margin-top:2px">All Classes — Weekly Overview</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#6B7280">
          <div style="font-weight:600;color:#374151">Academic Year ${schoolYearLabel}</div>
          <div style="margin-top:2px">${classes.length} classes</div>
        </div>
      </div>
      ${dayBlocks}
      ${SIGNATURE_HTML}
      <div style="margin-top:8px;font-size:9px;color:#9CA3AF;text-align:right">Master Timetable · Premier Global School · AY ${schoolYearLabel}</div>
    `
  }

  return (
    <div>
      <PrintToolbar onPrint={() => openPrint(buildMasterPrintHTML(), `Master Timetable — AY ${schoolYearLabel}`)} disabled={false}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          All <strong style={{ color: '#111' }}>{classes.length} classes</strong> · one table per day, classes as columns
        </div>
      </PrintToolbar>

      <PreviewCard>
        <div ref={printRef}>
          <DocHeader title="Master Timetable" subtitle="All Classes — Weekly Overview" meta={`${classes.length} classes`} schoolYearLabel={schoolYearLabel} />
          {DAYS.map(day => (
            <div key={day} className="master-day" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: PURPLE_DARK, marginBottom: 8, paddingBottom: 4, borderBottom: `2px solid ${PURPLE_BORDER}` }}>{day}</div>
              <table className="master-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: PURPLE_DARK }}>
                    <th style={{ ...TH_CENTER, width: 90 }}>Period</th>
                    {classes.map(cls => <th key={cls.id} style={TH}>Cls {cls.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {allPeriods.map((p, idx) => {
                    if (p.is_break) return <BreakRow key={p.period_number} p={p} colSpan={classes.length + 1} />
                    return (
                      <tr key={p.period_number} style={{ background: RowBg(idx) }}>
                        <PeriodCell p={p} />
                        {classes.map(cls => {
                          const entries = scheduleMap[cls.name]?.[day]?.[p.period_number] || []
                          return entries.length === 0 ? <EmptyCell key={cls.id} /> : (
                            <td key={cls.id} style={TD}>
                              {entries.map((e, i) => (
                                <div key={i} style={{ marginBottom: i < entries.length - 1 ? 6 : 0, paddingBottom: i < entries.length - 1 ? 6 : 0, borderBottom: i < entries.length - 1 ? '1px dashed #E5E7EB' : 'none' }}>
                                  <div style={{ fontWeight: 700, fontSize: 11, color: '#111827', marginBottom: 1 }}>{e.subject}</div>
                                  <div style={{ fontSize: 9.5, color: '#555' }}>{e.teacher}</div>
                                </div>
                              ))}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {SIGNATURE_JSX}
          <div style={{ marginTop: 10, fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>Master Timetable · Premier Global School · AY {schoolYearLabel}</div>
        </div>
      </PreviewCard>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BY DAY → BY CLASS
// ─────────────────────────────────────────────────────────────────────────────
function DayByClass({ classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [date, setDate]               = useState(todayStr())
  const [selectedClass, setSelectedClass] = useState('')
  const [substitutions, setSubstitutions] = useState([])
  const printRef = useRef()

  const dayName   = getDayName(date)
  const isWeekend = dayName === 'Saturday' || dayName === 'Sunday'

  useEffect(() => { fetchSubs(date) }, [date])
  async function fetchSubs(d) {
    const { data } = await supabase.from('substitutions').select('*').eq('date', d).eq('school_year', currentSchoolYear)
    setSubstitutions(data || [])
  }

  function getClassPeriods() {
    const map = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || p.timetable_classes?.name !== selectedClass) continue
      if (!map[p.period_number]) map[p.period_number] = { period_number: p.period_number, start_time: p.start_time, end_time: p.end_time, is_break: p.is_break, break_label: p.break_label }
    }
    return Object.values(map).sort((a, b) => a.period_number - b.period_number)
  }

  function getDayEntries() {
    const map = {}
    for (const e of allTimetableData) {
      const p = e.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear || p.timetable_classes?.name !== selectedClass || p.day !== dayName) continue
      if (!map[p.period_number]) map[p.period_number] = []
      map[p.period_number].push({ subject: e.subject, teacher: e.teacher_name })
    }
    return map
  }

  const ready   = selectedClass && !isWeekend
  const periods = ready ? getClassPeriods() : []
  const entries = ready ? getDayEntries() : {}

  function getSubForPeriod(periodNumber, teacherName) {
    return substitutions.find(s => s.period_number === periodNumber && s.class_name === selectedClass && s.absent_teacher === teacherName) || null
  }

  const classSubs = substitutions.filter(s => s.class_name === selectedClass)

  function buildPrintTable() {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:2.5px solid #3B0764">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo.png" alt="PGS" style="height:34px;object-fit:contain" onerror="this.style.display='none'" />
          <div>
            <div style="font-size:10px;font-weight:700;color:#7C3AED;letter-spacing:1px;text-transform:uppercase">Premier Global School</div>
            <div style="font-size:18px;font-weight:800;color:#111;margin-top:2px">Class ${selectedClass} — ${dayName}</div>
            <div style="font-size:10px;color:#6B7280;margin-top:2px">Day Timetable · ${fmtDate(date)}</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#6B7280"><div style="font-weight:600;color:#374151">Academic Year ${schoolYearLabel}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <thead><tr style="background:#3B0764">
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid #4C1D95;width:100px;text-align:center">Period</th>
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid #4C1D95;text-align:left">Subject</th>
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid #4C1D95;text-align:left">Teacher</th>
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;text-align:left;width:160px">Status</th>
        </tr></thead>
        <tbody>
          ${periods.map((p, idx) => {
            if (p.is_break) return `<tr><td colspan="4" style="background:#F0FDF4;text-align:center;color:#059669;font-style:italic;font-size:11px;border-bottom:1px solid #F3F4F6;padding:7px 6px;font-weight:600">${p.break_label || 'Break'} · ${p.start_time}–${p.end_time}</td></tr>`
            const ents = entries[p.period_number] || []
            if (ents.length === 0) return `<tr style="background:${idx%2===0?'#fff':'#FAFAFA'}"><td style="background:#F5F3FF;text-align:center;font-weight:700;color:#3B0764;border-bottom:1px solid #F3F4F6;border-right:1px solid #DDD6FE;padding:9px 11px;vertical-align:middle"><div style="font-size:11px;font-weight:800">${ordinalPeriod(p.period_number)}</div><div style="font-size:9px;color:#374151;font-weight:600;margin-top:3px;font-family:monospace">${p.start_time}–${p.end_time}</div></td><td colspan="3" style="border-bottom:1px solid #F3F4F6;padding:9px 11px;color:#D1D5DB;font-style:italic;font-size:11px">—</td></tr>`
            const subjectCol = ents.map((e, i) => `<div style="margin-bottom:${i < ents.length-1?'8px':'0'};padding-bottom:${i < ents.length-1?'8px':'0'};border-bottom:${i < ents.length-1?'1px dashed #E5E7EB':'none'};font-weight:700;font-size:12px">${e.subject}</div>`).join('')
            const teacherCol = ents.map((e, i) => {
              const sub = getSubForPeriod(p.period_number, e.teacher)
              return `<div style="margin-bottom:${i < ents.length-1?'8px':'0'};padding-bottom:${i < ents.length-1?'8px':'0'};border-bottom:${i < ents.length-1?'1px dashed #E5E7EB':'none'}">
                ${sub
                  ? `<div style="text-decoration:line-through;color:#9CA3AF;font-size:11px">${e.teacher}</div><div style="color:#065F46;font-weight:700;font-size:12px;margin-top:3px">${sub.substitute_teacher}</div>`
                  : `<span style="font-size:11px">${e.teacher}</span>`
                }
              </div>`
            }).join('')
            const statusCol = ents.map((e, i) => {
              const sub = getSubForPeriod(p.period_number, e.teacher)
              return `<div style="margin-bottom:${i < ents.length-1?'8px':'0'};padding-bottom:${i < ents.length-1?'8px':'0'};border-bottom:${i < ents.length-1?'1px dashed #E5E7EB':'none'}">
                ${sub
                  ? `<span style="background:#FEE2E2;color:#991B1B;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;display:inline-block;margin-bottom:3px">ABSENT: ${e.teacher}</span><br/><span style="background:#D1FAE5;color:#065F46;padding:2px 6px;border-radius:4px;font-weight:700;font-size:9px;display:inline-block">SUB: ${sub.substitute_teacher}</span>`
                  : `<span style="font-size:9px;color:#6B7280">—</span>`
                }
              </div>`
            }).join('')
            const bg = idx%2===0 ? '#fff' : '#FAFAFA'
            return `<tr style="background:${bg}">
              <td style="background:#F5F3FF;text-align:center;font-weight:700;color:#3B0764;border-bottom:1px solid #F3F4F6;border-right:1px solid #DDD6FE;padding:9px 11px;vertical-align:middle">
                <div style="font-size:11px;font-weight:800">${ordinalPeriod(p.period_number)}</div>
                <div style="font-size:9px;color:#374151;font-weight:600;margin-top:3px;font-family:monospace">${p.start_time}–${p.end_time}</div>
              </td>
              <td style="border-bottom:1px solid #F3F4F6;border-right:1px solid #F3F4F6;padding:9px 11px;vertical-align:top">${subjectCol}</td>
              <td style="border-bottom:1px solid #F3F4F6;border-right:1px solid #F3F4F6;padding:9px 11px;vertical-align:top">${teacherCol}</td>
              <td style="border-bottom:1px solid #F3F4F6;padding:9px 11px;vertical-align:top">${statusCol}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
      ${classSubs.length > 0 ? `<div style="margin-top:8px;font-size:10px;color:#059669;font-weight:600">✓ Substitutions applied for ${fmtDate(date)}</div>` : ''}
      ${SIGNATURE_HTML}
      <div style="margin-top:8px;font-size:9px;color:#9CA3AF;text-align:right">Premier Global School · AY ${schoolYearLabel} · ${fmtDate(date)}</div>
    `
  }

  return (
    <div>
      <PrintToolbar onPrint={() => openPrint(buildPrintTable(), `Class ${selectedClass} — ${dayName} ${date}`)} disabled={!ready}>
        <ToolLabel label="Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={DATE_STYLE} />
        </ToolLabel>
        <ToolLabel label="Class">
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={SELECT_STYLE}>
            <option value="">— Select class —</option>
            {classes.map(c => <option key={c.id} value={c.name}>Class {c.name}</option>)}
          </select>
        </ToolLabel>
        {!isWeekend && date && <Badge bg={PURPLE_LIGHT} color={PURPLE_MID} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>{dayName}</Badge>}
        {isWeekend && <Badge bg="#FEE2E2" color="#991B1B" style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>{dayName} — no school</Badge>}
        {classSubs.length > 0 && (
          <Badge bg="#D1FAE5" color="#065F46" style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>
            {classSubs.length} sub{classSubs.length > 1 ? 's' : ''} today
          </Badge>
        )}
      </PrintToolbar>

      {!ready ? (
        <EmptyPreview text={isWeekend ? `${dayName} is not a school day` : 'Select a date and class'} />
      ) : (
        <PreviewCard>
          <div ref={printRef}>
            <DocHeader title={`Class ${selectedClass} — ${dayName}`} subtitle={`Day Timetable · ${fmtDate(date)}`} schoolYearLabel={schoolYearLabel} />
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: PURPLE_DARK }}>
                  <th style={{ ...TH_CENTER, width: 100 }}>Period</th>
                  <th style={TH}>Subject</th>
                  <th style={TH}>Teacher</th>
                  <th style={{ ...TH, width: 180 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, idx) => {
                  if (p.is_break) return <BreakRow key={p.period_number} p={p} colSpan={4} />
                  const ents = entries[p.period_number] || []
                  if (ents.length === 0) return (
                    <tr key={p.period_number} style={{ background: RowBg(idx) }}>
                      <PeriodCell p={p} />
                      <td colSpan={3} style={{ ...TD, color: '#D1D5DB', fontStyle: 'italic' }}>—</td>
                    </tr>
                  )
                  return (
                    <tr key={p.period_number} style={{ background: ents.some(e => getSubForPeriod(p.period_number, e.teacher)) ? '#F0FDF4' : RowBg(idx) }}>
                      <PeriodCell p={p} />
                      <td style={{ ...TD, fontWeight: 700, fontSize: 13 }}>
                        {ents.map((e, i) => (
                          <div key={i} style={{ marginBottom: i < ents.length - 1 ? 8 : 0, paddingBottom: i < ents.length - 1 ? 8 : 0, borderBottom: i < ents.length - 1 ? '1px dashed #E5E7EB' : 'none' }}>
                            {e.subject}
                          </div>
                        ))}
                      </td>
                      <td style={TD}>
                        {ents.map((e, i) => {
                          const sub = getSubForPeriod(p.period_number, e.teacher)
                          return (
                            <div key={i} style={{ marginBottom: i < ents.length - 1 ? 8 : 0, paddingBottom: i < ents.length - 1 ? 8 : 0, borderBottom: i < ents.length - 1 ? '1px dashed #E5E7EB' : 'none' }}>
                              {sub ? (
                                <>
                                  <div style={{ fontSize: 11, textDecoration: 'line-through', color: '#9CA3AF' }}>{e.teacher}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46', marginTop: 3 }}>{sub.substitute_teacher}</div>
                                </>
                              ) : <span style={{ fontSize: 12 }}>{e.teacher}</span>}
                            </div>
                          )
                        })}
                      </td>
                      <td style={TD}>
                        {ents.map((e, i) => {
                          const sub = getSubForPeriod(p.period_number, e.teacher)
                          return (
                            <div key={i} style={{ marginBottom: i < ents.length - 1 ? 8 : 0, paddingBottom: i < ents.length - 1 ? 8 : 0, borderBottom: i < ents.length - 1 ? '1px dashed #E5E7EB' : 'none' }}>
                              {sub ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <Badge bg="#FEE2E2" color="#991B1B">ABSENT: {e.teacher}</Badge>
                                  <Badge bg="#D1FAE5" color="#065F46">SUB: {sub.substitute_teacher}</Badge>
                                </div>
                              ) : <span style={{ fontSize: 10, color: '#6B7280' }}>—</span>}
                            </div>
                          )
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {classSubs.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Substitutions applied for {fmtDate(date)}</div>
            )}
            {SIGNATURE_JSX}
            <div style={{ marginTop: 8, fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>Premier Global School · AY {schoolYearLabel} · {fmtDate(date)}</div>
          </div>
        </PreviewCard>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BY DAY → BY TEACHER
// ─────────────────────────────────────────────────────────────────────────────
function DayByTeacher({ sortedTeachers, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [date, setDate]                       = useState(todayStr())
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [substitutions, setSubstitutions]     = useState([])
  const printRef = useRef()

  const dayName   = getDayName(date)
  const isWeekend = dayName === 'Saturday' || dayName === 'Sunday'
  const ready     = selectedTeacher && !isWeekend

  useEffect(() => { fetchSubs(date) }, [date])
  async function fetchSubs(d) {
    const { data } = await supabase.from('substitutions').select('*').eq('date', d).eq('school_year', currentSchoolYear)
    setSubstitutions(data || [])
  }

  function getOwnSlots() {
    return allTimetableData
      .filter(e => {
        const p = e.timetable_periods
        return p && p.day === dayName && e.teacher_name === selectedTeacher && p.timetable_classes?.school_year === currentSchoolYear
      })
      .map(e => ({
        periodNumber: e.timetable_periods.period_number, startTime: e.timetable_periods.start_time,
        endTime: e.timetable_periods.end_time, subject: e.subject,
        className: e.timetable_periods.timetable_classes?.name, isClassTeacher: e.is_class_teacher,
      }))
      .sort((a, b) => a.periodNumber - b.periodNumber)
  }

  const subsCovering = substitutions.filter(s => s.substitute_teacher === selectedTeacher)
  const subsAbsent   = substitutions.filter(s => s.absent_teacher === selectedTeacher)

  function getMergedSlots() {
    const own = getOwnSlots()
    const coveringSlots = subsCovering.map(s => ({
      periodNumber: s.period_number, startTime: s.start_time, endTime: s.end_time,
      subject: s.subject, className: s.class_name, isSubstitute: true,
      coveringFor: s.absent_teacher,
    }))
    const ownMarked = own.map(slot => {
      const absSub = subsAbsent.find(s => s.period_number === slot.periodNumber && s.class_name === slot.className)
      return { ...slot, isAbsent: !!absSub, substituteTeacher: absSub?.substitute_teacher || null }
    })
    return [...ownMarked, ...coveringSlots].sort((a, b) => a.periodNumber - b.periodNumber)
  }

  const slots   = ready ? getMergedSlots() : []
  const hasSubs = subsCovering.length > 0 || subsAbsent.length > 0

  function buildPrintTable() {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:2.5px solid #3B0764">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/logo.png" alt="PGS" style="height:34px;object-fit:contain" onerror="this.style.display='none'" />
          <div>
            <div style="font-size:10px;font-weight:700;color:#7C3AED;letter-spacing:1px;text-transform:uppercase">Premier Global School</div>
            <div style="font-size:18px;font-weight:800;color:#111;margin-top:2px">${selectedTeacher}</div>
            <div style="font-size:10px;color:#6B7280;margin-top:2px">Day Schedule · ${fmtDate(date)}</div>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#6B7280">
          <div style="font-weight:600;color:#374151">Academic Year ${schoolYearLabel}</div>
          <div style="margin-top:2px">${slots.length} periods on ${dayName}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <thead><tr style="background:#3B0764">
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid #4C1D95;width:100px;text-align:center">Period</th>
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid #4C1D95;text-align:left">Subject</th>
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;border-right:1px solid #4C1D95;text-align:left">Class</th>
          <th style="color:#E9D5FF;padding:10px 12px;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;text-align:left;width:200px">Status</th>
        </tr></thead>
        <tbody>
          ${slots.length === 0 ? `<tr><td colspan="4" style="padding:24px;text-align:center;color:#9CA3AF;font-size:13px;font-style:italic">No periods scheduled for ${selectedTeacher} on ${dayName}</td></tr>` : ''}
          ${slots.map((slot, idx) => {
            const bg = slot.isSubstitute ? '#F0FDF4' : slot.isAbsent ? '#FFF5F5' : idx%2===0 ? '#fff' : '#FAFAFA'
            return `<tr style="background:${bg}">
              <td style="background:#F5F3FF;text-align:center;font-weight:700;color:#3B0764;border-bottom:1px solid #F3F4F6;border-right:1px solid #DDD6FE;padding:9px 11px;vertical-align:middle">
                <div style="font-size:11px;font-weight:800">${ordinalPeriod(slot.periodNumber)}</div>
                <div style="font-size:9px;color:#374151;font-weight:600;margin-top:3px;font-family:monospace">${slot.startTime}–${slot.endTime}</div>
              </td>
              <td style="border-bottom:1px solid #F3F4F6;border-right:1px solid #F3F4F6;padding:9px 11px;font-weight:700;font-size:12px;${slot.isAbsent?'text-decoration:line-through;color:#9CA3AF':''}">${slot.subject}</td>
              <td style="border-bottom:1px solid #F3F4F6;border-right:1px solid #F3F4F6;padding:9px 11px;font-size:11px;${slot.isAbsent?'color:#9CA3AF':'color:#047857;font-weight:600'}">Class ${slot.className}</td>
              <td style="border-bottom:1px solid #F3F4F6;padding:9px 11px">
                ${slot.isSubstitute
                  ? `<span style="background:#D1FAE5;color:#065F46;padding:2px 7px;border-radius:4px;font-weight:700;font-size:9px;display:inline-block">✦ SUBSTITUTE DUTY</span><div style="font-size:9.5px;color:#6B7280;margin-top:4px">Covering: ${slot.coveringFor}</div>`
                  : slot.isAbsent
                  ? `<span style="background:#FEE2E2;color:#991B1B;padding:2px 7px;border-radius:4px;font-weight:700;font-size:9px;display:inline-block">ABSENT</span><div style="font-size:9.5px;color:#059669;font-weight:600;margin-top:4px">Sub: ${slot.substituteTeacher}</div>`
                  : `<span style="font-size:9px;color:#6B7280">—</span>`
                }
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
      ${hasSubs ? `<div style="margin-top:8px;font-size:10px;color:#059669;font-weight:600">✓ Schedule reflects substitutions for ${fmtDate(date)}</div>` : ''}
      ${SIGNATURE_HTML}
      <div style="margin-top:8px;font-size:9px;color:#9CA3AF;text-align:right">Premier Global School · AY ${schoolYearLabel} · ${fmtDate(date)}</div>
    `
  }

  return (
    <div>
      <PrintToolbar onPrint={() => openPrint(buildPrintTable(), `${selectedTeacher} — ${dayName} ${date}`)} disabled={!ready}>
        <ToolLabel label="Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={DATE_STYLE} />
        </ToolLabel>
        <ToolLabel label="Teacher">
          <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} style={SELECT_STYLE}>
            <option value="">— Select teacher —</option>
            {sortedTeachers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </ToolLabel>
        {!isWeekend && date && <Badge bg={PURPLE_LIGHT} color={PURPLE_MID} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>{dayName}</Badge>}
        {isWeekend && <Badge bg="#FEE2E2" color="#991B1B" style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>{dayName} — no school</Badge>}
        {ready && subsCovering.length > 0 && <Badge bg="#D1FAE5" color="#065F46" style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>{subsCovering.length} substitute duty</Badge>}
        {ready && subsAbsent.length > 0 && <Badge bg="#FEE2E2" color="#991B1B" style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20 }}>Absent {subsAbsent.length} period{subsAbsent.length > 1 ? 's' : ''}</Badge>}
      </PrintToolbar>

      {!ready ? (
        <EmptyPreview text={isWeekend ? `${dayName} is not a school day` : 'Select a date and teacher'} />
      ) : (
        <PreviewCard>
          <div ref={printRef}>
            <DocHeader title={selectedTeacher} subtitle={`Day Schedule · ${fmtDate(date)}`} meta={`${slots.length} periods on ${dayName}`} schoolYearLabel={schoolYearLabel} />
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: PURPLE_DARK }}>
                  <th style={{ ...TH_CENTER, width: 100 }}>Period</th>
                  <th style={TH}>Subject</th>
                  <th style={TH}>Class</th>
                  <th style={{ ...TH, width: 200 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {slots.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>No periods on {dayName}</td></tr>
                ) : slots.map((slot, idx) => (
                  <tr key={`${slot.periodNumber}-${slot.className}`} style={{ background: slot.isSubstitute ? '#F0FDF4' : slot.isAbsent ? '#FFF5F5' : RowBg(idx) }}>
                    <td style={TD_PERIOD}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#3B0764' }}>{ordinalPeriod(slot.periodNumber)}</div>
                      <div style={{ fontSize: 9, color: '#374151', marginTop: 3, fontFamily: 'monospace', fontWeight: 600 }}>{slot.startTime}–{slot.endTime}</div>
                    </td>
                    <td style={{ ...TD, fontWeight: 700, fontSize: 13, textDecoration: slot.isAbsent ? 'line-through' : 'none', color: slot.isAbsent ? '#9CA3AF' : '#111827' }}>
                      {slot.subject}
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: slot.isAbsent ? '#9CA3AF' : '#047857', fontWeight: 600 }}>
                      Class {slot.className}
                    </td>
                    <td style={TD}>
                      {slot.isSubstitute ? (
                        <div>
                          <Badge bg="#D1FAE5" color="#065F46" style={{ marginBottom: 5 }}>✦ SUBSTITUTE DUTY</Badge>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Covering: <strong style={{ color: '#374151' }}>{slot.coveringFor}</strong></div>
                        </div>
                      ) : slot.isAbsent ? (
                        <div>
                          <Badge bg="#FEE2E2" color="#991B1B" style={{ marginBottom: 5 }}>ABSENT</Badge>
                          <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 2 }}>Sub: {slot.substituteTeacher}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: '#6B7280' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasSubs && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Schedule reflects substitutions for {fmtDate(date)}</div>
            )}
            {SIGNATURE_JSX}
            <div style={{ marginTop: 8, fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>Premier Global School · AY {schoolYearLabel} · {fmtDate(date)}</div>
          </div>
        </PreviewCard>
      )}
    </div>
  )
}

// ─── By Day wrapper ───────────────────────────────────────────────────────────
function PrintByDay({ sortedTeachers, classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [daySubTab, setDaySubTab] = useState('class')
  return (
    <div>
      <SubTabBar tabs={[['class', 'By Class'], ['teacher', 'By Teacher']]} active={daySubTab} onChange={setDaySubTab} />
      {daySubTab === 'class'   && <DayByClass classes={classes} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
      {daySubTab === 'teacher' && <DayByTeacher sortedTeachers={sortedTeachers} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function PrintTimetable({ sortedTeachers, classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [subTab, setSubTab] = useState('teacher')
  return (
    <div>
      <SubTabBar
        tabs={[['teacher', 'By Teacher'], ['class', 'By Class'], ['master', 'Master (All Classes)'], ['day', 'By Day']]}
        active={subTab}
        onChange={setSubTab}
      />
      {subTab === 'teacher' && <PrintTeacher sortedTeachers={sortedTeachers} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
      {subTab === 'class'   && <PrintClass classes={classes} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
      {subTab === 'master'  && <PrintMaster classes={classes} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
      {subTab === 'day'     && <PrintByDay sortedTeachers={sortedTeachers} classes={classes} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
    </div>
  )
}