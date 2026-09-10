import { useState, useMemo, useEffect } from 'react'
import { DAYS, PURPLE_DARK, PURPLE_MID, PURPLE_BORDER } from './TimetableUtils'
import { supabase } from '../../lib/supabase'

// ═══════════════════════════════════════════════════════════════
//  Print Timetable (draft site)
//  Same layout as the grid: days down the side, periods across.
//  Breaks / Welcome / Dispersal are their own columns and are NOT
//  counted in period numbers. No signature block.
// ═══════════════════════════════════════════════════════════════

const fmt = t => { if (!t) return ''; const [h, m] = String(t).split(':'); return `${((parseInt(h, 10) + 11) % 12) + 1}:${m}` }
const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m }
const isPre = name => /^(balvatika|nursery|lkg|ukg)/i.test(String(name || ''))
const isDispersal = s => s.is_break && /dispersal/i.test(s.break_label || '')
const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')

// Slots for a class from the full periods list (includes breaks), labelled P1..Pn skipping breaks
function classSlots(periods, className) {
  const map = {}
  for (const p of periods) {
    if (p.className !== className) continue
    map[p.period_number] ||= { period_number: p.period_number, start_time: p.start_time, end_time: p.end_time, is_break: !!p.is_break, break_label: p.break_label }
  }
  let n = 0
  return Object.values(map).sort((a, b) => a.period_number - b.period_number)
    .map(s => ({ ...s, label: s.is_break ? (s.break_label || 'Break') : `P${++n}` }))
}

// ── Print shell ──
const PRINT_CSS = `
  @page { size: A4 landscape; margin: 14mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; padding: 6mm 8mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2.5px solid ${PURPLE_DARK}; }
  .head img { height: 42px; object-fit: contain; }
  .school { font-size: 10px; font-weight: 700; color: ${PURPLE_MID}; letter-spacing: 1.4px; text-transform: uppercase; }
  .title { font-size: 22px; font-weight: 800; color: #111; text-transform: uppercase; line-height: 1.1; }
  .sub { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .meta { text-align: right; font-size: 11px; color: #6B7280; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 12px; }
  th { background: ${PURPLE_DARK} !important; color: #fff !important; padding: 7px 4px; font-size: 11px; font-weight: 700; text-align: center; border: 1px solid #2C1A5E; line-height: 1.25; }
  th small { display: block; font-weight: 500; font-size: 9px; color: #C4B5FD; margin-top: 1px; }
  th.brk { background: #065F46 !important; } th.brk small { color: #A7F3D0; }
  th.dis { background: #4B5563 !important; } th.dis small { color: #D1D5DB; }
  th.day { text-align: left; width: 74px; }
  th.b { width: 58px; }
  td { border: 1px solid #B8B8B8; padding: 9px 9px; vertical-align: top; font-size: 11.5px; line-height: 1.35; height: 88px; }
  td.day { font-weight: 800; color: ${PURPLE_MID}; text-transform: uppercase; font-size: 11px; background: #FAFAFA; vertical-align: middle; }
  td.brk { background: #F0FDF4; color: #059669; font-style: italic; text-align: center; font-size: 8.5px; vertical-align: middle; }
  td.dis { background: #F3F4F6; color: #9CA3AF; font-style: italic; text-align: center; font-size: 8.5px; vertical-align: middle; }
  .s { font-weight: 700; color: #111; font-size: 12px; } .t { color: #4B5563; font-size: 10.5px; margin-top: 3px; } .c { color: #047857; font-weight: 600; font-size: 10px; margin-top: 2px; }
  .split { border-top: 1px dashed #C4C4C4; margin-top: 4px; padding-top: 4px; }
  .empty { color: #D1D5DB; text-align: center; vertical-align: middle; }
  .sec { font-size: 14px; font-weight: 800; color: ${PURPLE_DARK}; margin: 10px 0 6px; padding-bottom: 3px; border-bottom: 2px solid ${PURPLE_BORDER}; text-transform: uppercase; letter-spacing: .6px; }
  .block { page-break-before: always; break-before: page; }
  .block.first { page-break-before: auto; break-before: auto; }
  .master { page-break-inside: avoid; break-inside: avoid; margin-bottom: 8px; }
  .master td { height: 40px; font-size: 10px; padding: 4px 6px; }
  .master .s { font-size: 10px; } .master .t { font-size: 9px; margin-top: 1px; }
  .master th { padding: 5px 3px; font-size: 10px; } .master th small { font-size: 8px; }
  .foot { font-size: 9px; color: #9CA3AF; text-align: right; margin-top: 4px; }
`
function openPrint(html, title) {
  const w = window.open('', '_blank', 'width=1200,height=800')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${html}<script>window.onload=()=>{window.print()}<\/script></body></html>`)
  w.document.close(); w.focus()
}
function headHtml(title, sub, meta, schoolYearLabel) {
  return `<div class="head">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="/logo.png" onerror="this.style.display='none'" />
      <div><div class="school">Premier Global School</div><div class="title">${esc(title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    </div>
    <div class="meta"><div style="font-weight:600;color:#374151">Academic Year ${esc(schoolYearLabel)}</div>${meta ? `<div>${esc(meta)}</div>` : ''}</div>
  </div>`
}
function thHtml(s) {
  const cls = isDispersal(s) ? 'dis' : s.is_break ? 'brk' : ''
  const time = isDispersal(s) ? fmt(s.start_time) : `${fmt(s.start_time)}–${fmt(s.end_time)}`
  return `<th class="${cls}${s.is_break ? ' b' : ''}">${esc(s.label)}<small>${time}</small></th>`
}
function cellHtml(entries, mode) {   // mode: 'teacher' shows teacher, 'class' shows class
  if (!entries || entries.length === 0) return `<td class="empty">—</td>`
  return `<td>${entries.map((e, i) => `<div class="${i ? 'split' : ''}"><div class="s">${esc(e.subject)}</div>${mode === 'class' ? `<div class="c">${esc(e.className)}</div>` : `<div class="t">${esc(e.teacher || '')}</div>`}</div>`).join('')}</td>`
}
function classTableHtml(slots, rows, mode) {   // rows: {day -> {period_number -> [entries]}}
  return `<table><thead><tr><th class="day">Day</th>${slots.map(thHtml).join('')}</tr></thead><tbody>${
    DAYS.map(d => `<tr><td class="day">${d.slice(0, 3)}</td>${slots.map(s => isDispersal(s) ? `<td class="dis">${esc(s.label)}</td>` : s.is_break ? `<td class="brk">${esc(s.label)}</td>` : cellHtml(rows[d]?.[s.period_number], mode)).join('')}</tr>`).join('')
  }</tbody></table>`
}

// ── UI bits ──
function SubTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid #E5E7EB' }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} style={{ padding: '8px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: active === key ? 700 : 400, color: active === key ? PURPLE_MID : '#6B7280', borderBottom: `3px solid ${active === key ? PURPLE_MID : 'transparent'}`, marginBottom: -2 }}>{label}</button>
      ))}
    </div>
  )
}
function Toolbar({ onPrint, disabled, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {children}
      <button onClick={onPrint} disabled={disabled} style={{ marginLeft: 'auto', background: disabled ? '#F3F4F6' : PURPLE_DARK, color: disabled ? '#9CA3AF' : '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>Print / Download</button>
    </div>
  )
}
const SEL = { padding: '8px 12px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827', background: '#FAFAFA', cursor: 'pointer', minWidth: 220 }
function Preview({ html }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 20, overflowX: 'auto' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', marginBottom: 10, textAlign: 'right', letterSpacing: 1, textTransform: 'uppercase' }}>Preview</div>
      <style>{PRINT_CSS.replace(/@page[^}]*}/, '').replace(/body \{/, '.pv {')}</style>
      <div className="pv" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
function Empty({ text }) {
  return <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 56, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>{text}</div>
}

// ── By class ──
function classRows(allTimetableData, className, year) {
  const r = {}
  for (const d of DAYS) r[d] = {}
  for (const e of allTimetableData) {
    const p = e.timetable_periods
    if (!p || p.timetable_classes?.school_year !== year || p.timetable_classes?.name !== className) continue
    ;(r[p.day][p.period_number] ||= []).push({ subject: e.subject, teacher: e.teacher_name })
  }
  return r
}
function PrintClass({ periods, classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [selected, setSelected] = useState('')
  const html = useMemo(() => {
    if (!selected) return ''
    const slots = classSlots(periods, selected)
    const rows = classRows(allTimetableData, selected, currentSchoolYear)
    const n = slots.filter(s => !s.is_break).length
    return headHtml(selected, 'Weekly Class Timetable', `${n} periods a day`, schoolYearLabel) + classTableHtml(slots, rows, 'teacher') + `<div class="foot">Premier Global School · AY ${esc(schoolYearLabel)}</div>`
  }, [selected, allTimetableData, periods, currentSchoolYear])
  return (
    <div>
      <Toolbar onPrint={() => openPrint(html, `Timetable — ${selected}`)} disabled={!selected}>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={SEL}>
          <option value="">— Select a class —</option>
          {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </Toolbar>
      {selected ? <Preview html={html} /> : <Empty text="Select a class to preview its timetable" />}
    </div>
  )
}

// ── By teacher (columns by TIME, since Balvatika and 1–8 layouts differ) ──
function PrintTeacher({ periods, sortedTeachers, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [selected, setSelected] = useState('')
  const html = useMemo(() => {
    if (!selected) return ''
    const mine = allTimetableData.filter(e => e.teacher_name === selected && e.timetable_periods?.timetable_classes?.school_year === currentSchoolYear)
    const usesPre = mine.some(e => isPre(e.timetable_periods.timetable_classes.name))
    const usesPri = mine.some(e => !isPre(e.timetable_periods.timetable_classes.name))
    // build the column set: every slot (incl. breaks) from each layout the teacher uses, keyed by time
    const cols = {}
    const seenClass = { pre: null, pri: null }
    for (const e of allTimetableData) {
      const p = e.timetable_periods; if (!p || p.timetable_classes?.school_year !== currentSchoolYear) continue
      const k = isPre(p.timetable_classes.name) ? 'pre' : 'pri'
      if ((k === 'pre' && !usesPre) || (k === 'pri' && !usesPri)) continue
      seenClass[k] ||= p.timetable_classes.name
    }
    for (const k of ['pre', 'pri']) {
      if (!seenClass[k]) continue
      for (const s of classSlots(periods, seenClass[k])) {
        const key = `${s.start_time}-${s.end_time}`
        cols[key] ||= { start_time: s.start_time, end_time: s.end_time, is_break: s.is_break, break_label: s.break_label, labels: [] }
        cols[key].labels.push(k === 'pre' && usesPri ? `B-${s.label}` : s.label)
        if (!s.is_break) cols[key].is_break = false
      }
    }
    const slots = Object.values(cols).sort((a, b) => toMin(a.start_time) - toMin(b.start_time)).map(s => ({ ...s, label: [...new Set(s.labels)].join(' / ') }))
    const rows = {}
    for (const d of DAYS) rows[d] = {}
    for (const e of mine) {
      const p = e.timetable_periods
      ;(rows[p.day][`${p.start_time}-${p.end_time}`] ||= []).push({ subject: e.subject, className: p.timetable_classes.name })
    }
    const total = mine.length
    const table = `<table><thead><tr><th class="day">Day</th>${slots.map(thHtml).join('')}</tr></thead><tbody>${
      DAYS.map(d => `<tr><td class="day">${d.slice(0, 3)}</td>${slots.map(s => {
        const key = `${s.start_time}-${s.end_time}`; const ents = rows[d][key]
        if (ents?.length) return cellHtml(ents, 'class')
        return isDispersal(s) ? `<td class="dis">${esc(s.label)}</td>` : s.is_break ? `<td class="brk">${esc(s.label)}</td>` : `<td class="empty">—</td>`
      }).join('')}</tr>`).join('')
    }</tbody></table>`
    return headHtml(selected, 'Weekly Teaching Timetable', `${total} periods a week`, schoolYearLabel) + table + `<div class="foot">Premier Global School · AY ${esc(schoolYearLabel)}</div>`
  }, [selected, allTimetableData, periods, currentSchoolYear])
  return (
    <div>
      <Toolbar onPrint={() => openPrint(html, `Timetable — ${selected}`)} disabled={!selected}>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={SEL}>
          <option value="">— Select a teacher —</option>
          {sortedTeachers.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
      </Toolbar>
      {selected ? <Preview html={html} /> : <Empty text="Select a teacher to preview their timetable" />}
    </div>
  )
}

// ── Master: per day, one table per layout group, classes as rows ──
function PrintMaster({ periods, classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const html = useMemo(() => {
    const groups = [
      { name: 'Balvatika', cls: classes.filter(c => isPre(c.name)) },
      { name: 'Classes 1–8', cls: classes.filter(c => !isPre(c.name)) },
    ].filter(g => g.cls.length)
    const rowsByClass = Object.fromEntries(classes.map(c => [c.name, classRows(allTimetableData, c.name, currentSchoolYear)]))
    const body = DAYS.map((d, i) => `<div class="block${i === 0 ? ' first' : ''}"><div class="sec">${d}</div>${groups.map(g => {
      const slots = classSlots(periods, g.cls[0].name)
      return `<table class="master"><thead><tr><th class="day">${esc(g.name)}</th>${slots.map(thHtml).join('')}</tr></thead><tbody>${
        g.cls.map(c => `<tr><td class="day">${esc(c.name)}</td>${slots.map(s => isDispersal(s) ? `<td class="dis">${esc(s.label)}</td>` : s.is_break ? `<td class="brk">${esc(s.label)}</td>` : cellHtml(rowsByClass[c.name][d]?.[s.period_number], 'teacher')).join('')}</tr>`).join('')
      }</tbody></table>`
    }).join('')}</div>`).join('')
    return headHtml('Master Timetable', 'All classes — weekly overview', `${classes.length} classes`, schoolYearLabel) + body + `<div class="foot">Premier Global School · AY ${esc(schoolYearLabel)}</div>`
  }, [classes, allTimetableData, periods, currentSchoolYear])
  return (
    <div>
      <Toolbar onPrint={() => openPrint(html, `Master Timetable — AY ${schoolYearLabel}`)} disabled={false}>
        <div style={{ fontSize: 13, color: '#6B7280' }}>All <strong style={{ color: '#111' }}>{classes.length} classes</strong> · one section per day, classes as rows</div>
      </Toolbar>
      <Preview html={html} />
    </div>
  )
}

export default function PrintTimetable({ sortedTeachers, classes, allTimetableData, currentSchoolYear, schoolYearLabel }) {
  const [subTab, setSubTab] = useState('class')
  const [periods, setPeriods] = useState([])   // every slot of every class, incl. breaks
  useEffect(() => {
    supabase.from('timetable_periods').select('period_number, day, start_time, end_time, is_break, break_label, timetable_classes!inner(name, school_year)')
      .eq('timetable_classes.school_year', currentSchoolYear)
      .then(({ data }) => setPeriods((data || []).map(p => ({ ...p, className: p.timetable_classes?.name }))))
  }, [currentSchoolYear])
  return (
    <div>
      <SubTabBar tabs={[['class', 'By Class'], ['teacher', 'By Teacher'], ['master', 'Master (All Classes)']]} active={subTab} onChange={setSubTab} />
      {subTab === 'class'   && <PrintClass periods={periods} classes={classes} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
      {subTab === 'teacher' && <PrintTeacher periods={periods} sortedTeachers={sortedTeachers} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
      {subTab === 'master'  && <PrintMaster periods={periods} classes={classes} allTimetableData={allTimetableData} currentSchoolYear={currentSchoolYear} schoolYearLabel={schoolYearLabel} />}
    </div>
  )
}