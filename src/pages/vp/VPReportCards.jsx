import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import {
  LAT_MONTHS, LAT_MAX,
  getFormativeComponents, getHalfYearlyComponents,
  isMarksClass, classKey,
} from '../../lib/examConfig'

// ═══════════════════════════════════════════════════════════════
//  VP — Report Cards
//
//  Subjects come from the `subjects` master list. Every subject of
//  the class is on the card (blank if no marks), except split
//  language pairs (Hindi / Bengali) where only the student's own
//  language is shown. Max is per subject (3rd L Hindi is /40).
//
//  Class-wide marks are loaded once per class so the card can show
//  "Highest in Class" per subject and the student's rank.
// ═══════════════════════════════════════════════════════════════

const PURPLE_DARK = '#3B0764'
const PURPLE_MID  = '#5B21B6'
const PURPLE_SOFT = '#F5F3FF'

// ── Exam parts ──
const PARTS = {
  best_lat: {
    label: 'Best LAT', short: 'LAT',
    maxFor: () => LAT_MAX,
    valueFor: (marks, subject) => {
      let best = null
      for (const m of LAT_MONTHS) {
        const v = marks[`${subject}__lat__${m}`]
        if (typeof v === 'number' && (best === null || v > best)) best = v
      }
      return best
    },
  },
  formative: {
    label: 'Formative', short: 'FA',
    maxFor: (className) => getFormativeComponents(className).reduce((s, c) => s + c.max, 0),
    valueFor: (marks, subject, className) => {
      let sum = 0, any = false
      for (const c of getFormativeComponents(className)) {
        const v = marks[`${subject}__formative__${c.key}`]
        if (typeof v === 'number') { sum += v; any = true }
      }
      return any ? sum : null
    },
  },
  halfyearly: {
    label: 'Half-Yearly', short: 'HY',
    maxFor: (className, subject) => getHalfYearlyComponents(className, subject).reduce((s, c) => s + c.max, 0),
    valueFor: (marks, subject, className) => {
      let sum = 0, any = false
      for (const c of getHalfYearlyComponents(className, subject)) {
        const v = marks[`${subject}__halfyearly__${c.key}`]
        if (typeof v === 'number') { sum += v; any = true }
      }
      return any ? sum : null
    },
  },
}
const PART_ORDER = ['best_lat', 'formative', 'halfyearly']

// Co-scholastic areas printed as blank boxes for the class teacher to fill by hand
const CO_SCHOLASTIC = ['Punctuality', 'Obedience', 'Discipline', 'Concentration', 'Curiosity', 'Confidence']

const ArrowLeft = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>)
const PrintIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>)
const ChevRight = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>)
const CheckIcon = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>)

// ── Split-language handling ──
function langGroupKey(name) {
  const n = String(name).toLowerCase().replace(/[^a-z0-9]/g, '')
  if (n.startsWith('2ndl')) return '2ndl'
  if (n.startsWith('3rdl')) return '3rdl'
  return null
}
function resolveLanguagePairs(allSubjects, hasMarks) {
  const out = []
  const groups = {}
  allSubjects.forEach((name, i) => {
    const g = langGroupKey(name)
    if (!g) { out.push({ name, i }); return }
    if (!groups[g]) groups[g] = { names: [], i }
    groups[g].names.push(name)
  })
  for (const g of Object.values(groups)) {
    if (g.names.length === 1) { out.push({ name: g.names[0], i: g.i }); continue }
    const withMarks = g.names.filter(n => hasMarks.has(n))
    if (withMarks.length > 0) withMarks.forEach(n => out.push({ name: n, i: g.i }))
    else out.push({ name: g.names[0].split(' - ')[0].trim(), i: g.i })
  }
  return out.sort((a, b) => a.i - b.i || a.name.localeCompare(b.name)).map(x => x.name)
}

function gradeFor(pct) {
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'E'
}

// Build a marks map for one student from raw rows
function buildMap(rows) {
  const map = {}, has = new Set()
  for (const r of rows) {
    map[`${r.subject}__${r.exam_type}__${r.component}`] = r.score == null ? null : Number(r.score)
    if (r.score != null) has.add(r.subject)
  }
  return { map, has }
}

// ── Print stylesheet ──
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 210mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #111; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body::before { content: ''; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: 50%; aspect-ratio: 1; background: url('/logowithtext.png') no-repeat center / contain; opacity: .05; z-index: 0; }
  .pg { position: relative; z-index: 1; padding: 10mm 11mm 12mm; min-height: 297mm; }
  .frame { border: 2.5px solid ${PURPLE_DARK}; padding: 6mm 7mm 8mm; min-height: 275mm; display: flex; flex-direction: column; }

  .head { display: grid; grid-template-columns: 70px 1fr 70px; align-items: center; gap: 10px; margin-bottom: 6px; }
  .head img { height: 62px; width: 70px; object-fit: contain; }
  .school { text-align: center; }
  .school .n { font-size: 24px; font-weight: 800; color: ${PURPLE_DARK}; letter-spacing: -.2px; line-height: 1.1; }
  .school .a { font-size: 9.5px; color: #4B5563; margin-top: 3px; letter-spacing: .3px; }
  .banner { background: ${PURPLE_DARK}; color: #fff; text-align: center; padding: 6px 10px; font-weight: 800;
    font-size: 11.5px; letter-spacing: 1.2px; text-transform: uppercase; margin: 6px 0 8px; }
  .banner small { display: block; font-size: 9.5px; font-weight: 600; letter-spacing: 1px; opacity: .9; margin-top: 2px; }

  .info { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .info td { border: 1px solid #374151; padding: 5px 8px; font-size: 10.5px; width: 50%; }
  .info td b { color: #374151; font-weight: 700; margin-right: 6px; }

  table.marks { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.marks th { background: ${PURPLE_DARK}; color: #fff; border: 1px solid ${PURPLE_DARK}; padding: 5px 4px; font-size: 9px;
    font-weight: 700; text-align: center; line-height: 1.25; }
  table.marks th small { display: block; font-weight: 500; opacity: .85; font-size: 8px; }
  table.marks td { border: 1px solid #6B7280; padding: 5px 6px; font-size: 10.5px; text-align: center; }
  table.marks td.sub { text-align: left; font-weight: 600; }
  table.marks td.dim { color: #9CA3AF; }
  table.marks tr.tot td { background: #F3F0FA; font-weight: 800; }
  table.marks tr.tot td.sub { text-align: right; }

  .summ { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #374151; margin-bottom: 8px; }
  .summ div { padding: 6px 8px; border-right: 1px solid #374151; text-align: center; }
  .summ div:last-child { border-right: 0; }
  .summ .v { font-size: 15px; font-weight: 800; color: ${PURPLE_DARK}; }
  .summ .l { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-top: 1px; }

  .sec { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #fff; background: ${PURPLE_MID};
    padding: 3px 8px; margin: 6px 0 4px; }
  table.co { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.co th { border: 1px solid #374151; padding: 4px; font-size: 8.5px; font-weight: 700; background: #F3F0FA; }
  table.co td { border: 1px solid #374151; height: 24px; }

  .chart { display: flex; align-items: flex-end; gap: 6px; height: 74px; border: 1px solid #374151; padding: 6px 8px 0; margin-bottom: 4px; overflow: hidden; }
  .bar-g { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; min-width: 0; }
  .bars { display: flex; align-items: flex-end; gap: 2px; height: 46px; width: 100%; justify-content: center; }
  .bar { width: 9px; border-radius: 2px 2px 0 0; }
  .bar.o { background: ${PURPLE_MID}; } .bar.h { background: #C4B5FD; }
  .bar-l { font-size: 6.5px; color: #4B5563; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .legend { font-size: 7.5px; color: #4B5563; margin-bottom: 6px; display: flex; gap: 12px; }
  .legend i { display: inline-block; width: 9px; height: 7px; margin-right: 3px; vertical-align: middle; }

  .lines { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .lines td { border: 1px solid #374151; padding: 6px 8px; font-size: 10px; }
  .lines td.k { width: 34%; font-weight: 700; background: #F3F0FA; }

  .sign { display: flex; justify-content: space-between; margin-top: auto; padding-top: 34px; }
  .sign div { width: 30%; text-align: center; }
  .sign .ln { border-top: 1.5px solid #111; padding-top: 5px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }
`

export default function VPReportCards() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel   = getSchoolYearLabel(currentSchoolYear)

  const [step, setStep] = useState('class')   // 'class' | 'student' | 'card'
  const [classes, setClasses]   = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [allSubjects, setAllSubjects] = useState([])   // master list for the class
  const [classMarks, setClassMarks]   = useState([])   // every mark row for the class
  const [subjects, setSubjects] = useState([])         // rows shown on this student's card
  const [marks, setMarks]       = useState({})

  const [active, setActive] = useState({ best_lat: true, formative: true, halfyearly: true })
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [cardLoading, setCardLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
    fetchClasses()
  }, [])

  async function fetchClasses() {
    setLoading(true)
    const { data } = await supabase.from('timetable_classes').select('*')
      .eq('school_year', currentSchoolYear).order('sort_order').order('name')
    setClasses((data || []).filter(c => isMarksClass(c.name)))
    setLoading(false)
  }

  async function pickClass(cls) {
    setSelectedClass(cls); setSelectedStudent(null); setStudentSearch(''); setStep('student')
    setStudentsLoading(true)
    const ck = classKey(cls.name)
    const [{ data: stu }, { data: subj }, { data: mk }] = await Promise.all([
      supabase.from('students').select('*').eq('class_name', ck).eq('school_year', currentSchoolYear).order('roll_number', { ascending: true }),
      supabase.from('subjects').select('name').eq('school_year', currentSchoolYear).eq('class_name', ck).eq('active', true).order('name'),
      supabase.from('marks').select('student_id, subject, exam_type, component, score').eq('class_name', ck).eq('school_year', currentSchoolYear),
    ])
    setStudents(stu || [])
    setAllSubjects((subj || []).map(s => s.name))
    setClassMarks(mk || [])
    setStudentsLoading(false)
  }

  function pickStudent(stu) {
    setSelectedStudent(stu); setStep('card'); setCardLoading(true)
    const { map, has } = buildMap(classMarks.filter(r => r.student_id === stu.id))
    setMarks(map)
    setSubjects(resolveLanguagePairs(allSubjects, has))
    setCardLoading(false)
  }

  function goBack() {
    if (step === 'card') { setStep('student'); setSelectedStudent(null) }
    else if (step === 'student') { setStep('class'); setSelectedClass(null) }
    else navigate('/vp')
  }
  function toggle(part) {
    const next = { ...active, [part]: !active[part] }
    if (!Object.values(next).some(Boolean)) return
    setActive(next)
  }

  // ── Derived ──
  const cls = selectedClass?.name
  const activeParts = PART_ORDER.filter(p => active[p])

  function partMax(part, subject) { return PARTS[part].maxFor(cls, subject) }
  function rowMax(subject) { return activeParts.reduce((s, p) => s + partMax(p, subject), 0) }
  function headerMax(part) {
    const vals = new Set(subjects.map(s => partMax(part, s)))
    return vals.size === 1 ? [...vals][0] : null
  }
  function partMaxLabel(part) {
    const vals = [...new Set(subjects.map(s => partMax(part, s)))].sort((a, b) => a - b)
    if (vals.length === 0) return `/${PARTS[part].maxFor(cls)}`
    return vals.length === 1 ? `/${vals[0]}` : `/${vals[0]}–${vals[vals.length - 1]}`
  }
  function partValue(part, subject, m = marks) { return PARTS[part].valueFor(m, subject, cls) }
  function subjectTotal(subject, m = marks) {
    return activeParts.reduce((sum, p) => { const v = partValue(p, subject, m); return sum + (typeof v === 'number' ? v : 0) }, 0)
  }
  const grandTotal = subjects.reduce((s, subj) => s + subjectTotal(subj), 0)
  const grandMax   = subjects.reduce((s, subj) => s + rowMax(subj), 0)
  const percentage = grandMax > 0 ? Math.round((grandTotal / grandMax) * 1000) / 10 : 0

  // ── Class-wide: highest per subject and rank (computed from classMarks) ──
  function classStats() {
    const highest = {}   // subject -> max total among students
    const totals = []    // [{ id, total, pct }]
    for (const stu of students) {
      const { map, has } = buildMap(classMarks.filter(r => r.student_id === stu.id))
      const subs = resolveLanguagePairs(allSubjects, has)
      let t = 0, mx = 0
      for (const s of subs) {
        const st = subjectTotal(s, map)
        t += st; mx += rowMax(s)
        if (highest[s] == null || st > highest[s]) highest[s] = st
      }
      totals.push({ id: stu.id, total: t, pct: mx ? t / mx : 0 })
    }
    totals.sort((a, b) => b.pct - a.pct)
    let rank = null
    if (selectedStudent) {
      const idx = totals.findIndex(x => x.id === selectedStudent.id)
      rank = idx >= 0 ? idx + 1 : null
    }
    return { highest, rank, count: totals.length }
  }
  const stats = step === 'card' && !cardLoading ? classStats() : { highest: {}, rank: null, count: 0 }

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || String(s.roll_number).includes(studentSearch)
  )

  // ── Print ──
  function handlePrint() {
    if (!selectedClass || !selectedStudent || activeParts.length === 0) return
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const examName = active.halfyearly ? 'Half-Yearly Examination' : activeParts.map(p => PARTS[p].label).join(' + ')
    const partsLine = activeParts.map(p => PARTS[p].label).join(' + ')

    const partHead = activeParts.map(p => {
      const hm = headerMax(p)
      return `<th>${PARTS[p].label}<small>${hm != null ? `(${hm})` : 'max varies'}</small></th>`
    }).join('')

    const rows = subjects.map(subj => {
      const cells = activeParts.map(p => {
        const v = partValue(p, subj)
        const showMax = headerMax(p) == null
        return `<td class="${typeof v === 'number' ? '' : 'dim'}">${typeof v === 'number' ? v : '—'}${showMax ? `<span style="font-size:7.5px;color:#6B7280">/${partMax(p, subj)}</span>` : ''}</td>`
      }).join('')
      const t = subjectTotal(subj), mx = rowMax(subj)
      const pct = mx ? Math.round((t / mx) * 100) : 0
      const hi = stats.highest[subj] ?? '—'
      return `<tr><td class="sub">${esc(subj)}</td>${cells}<td><b>${t}</b><span style="font-size:7.5px;color:#6B7280">/${mx}</span></td><td>${pct}%</td><td>${hi}</td></tr>`
    }).join('')

    // Bar chart: obtained % vs highest %, per subject
    const bars = subjects.map(subj => {
      const mx = rowMax(subj) || 1
      const o = Math.round((subjectTotal(subj) / mx) * 100)
      const h = Math.round(((stats.highest[subj] ?? 0) / mx) * 100)
      return `<div class="bar-g"><div class="bars"><div class="bar o" style="height:${o}%"></div><div class="bar h" style="height:${h}%"></div></div><div class="bar-l">${esc(subj)}</div></div>`
    }).join('')

    const coHead = CO_SCHOLASTIC.map(c => `<th>${c}</th>`).join('')
    const coCells = CO_SCHOLASTIC.map(() => `<td></td>`).join('')

    const html = `
      <div class="pg"><div class="frame">
        <div class="head">
          <img src="/logo.png" onerror="this.style.visibility='hidden'" />
          <div class="school">
            <div class="n">Premier Global School</div>
            <div class="a">Affiliated to CBSE · Kolkata, West Bengal</div>
          </div>
          <img src="/logo.png" style="visibility:hidden" />
        </div>
        <div class="banner">Report Card — ${esc(examName)}<small>Academic Session ${schoolYearLabel}</small></div>

        <table class="info">
          <tr><td><b>Name:</b>${esc(selectedStudent.name)}</td><td><b>Roll No:</b>${esc(selectedStudent.roll_number)}</td></tr>
          <tr><td><b>Class / Sec:</b>${esc(selectedClass.name)}</td><td><b>Admission No:</b>${esc(selectedStudent.admission_no || selectedStudent.admission_number || '')}</td></tr>
        </table>

        <table class="marks">
          <thead><tr>
            <th style="text-align:left">Subject</th>${partHead}
            <th>Total<small>(${activeParts.map(p => PARTS[p].short).join('+')})</small></th>
            <th>%</th>
            <th>Highest<small>in Class</small></th>
          </tr></thead>
          <tbody>
            ${rows}
            <tr class="tot"><td class="sub" colspan="${activeParts.length + 1}">Grand Total</td><td>${grandTotal}<span style="font-size:7.5px;color:#6B7280">/${grandMax}</span></td><td>${percentage}%</td><td></td></tr>
          </tbody>
        </table>

        <div class="summ">
          <div><div class="v">${grandTotal} / ${grandMax}</div><div class="l">Total Marks</div></div>
          <div><div class="v">${percentage}%</div><div class="l">Percentage</div></div>
          <div><div class="v">${gradeFor(percentage)}</div><div class="l">Grade</div></div>
          <div><div class="v">${stats.rank ?? '—'}${stats.count ? `<span style="font-size:9px;color:#6B7280"> / ${stats.count}</span>` : ''}</div><div class="l">Rank in Class</div></div>
        </div>

        <div class="sec">Co-Scholastic Grades</div>
        <table class="co"><thead><tr>${coHead}</tr></thead><tbody><tr>${coCells}</tr></tbody></table>

        <div class="sec">Graphical Analysis</div>
        <div class="chart">${bars}</div>
        <div class="legend"><span><i style="background:${PURPLE_MID}"></i>Obtained %</span><span><i style="background:#C4B5FD"></i>Highest in class %</span></div>

        <table class="lines">
          <tr><td class="k">Attendance (Days Present / Working Days)</td><td>&nbsp;</td></tr>
          <tr><td class="k">Class Teacher's Remark</td><td>&nbsp;</td></tr>
        </table>

        <div class="sign">
          <div><div style="height:26px"></div><div class="ln">Class Teacher</div></div>
          <div><div style="height:26px"></div><div class="ln">School Seal</div></div>
          <div><div style="height:26px"></div><div class="ln">Principal</div></div>
        </div>
      </div></div>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Report Card — ${esc(selectedStudent.name)}</title><style>${PRINT_CSS}</style></head><body>${html}<script>window.onload=()=>{window.print()}<\/script></body></html>`)
    w.document.close()
  }

  // ═══════════════ RENDER ═══════════════
  return (
    <div style={{ minHeight: '100vh', background: PURPLE_SOFT, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button, input { font-family: inherit; }
        .rc-wrap { max-width: 960px; margin: 0 auto; padding: 16px; }
        .rc-hero { background: ${PURPLE_DARK}; border-radius: 16px; padding: 18px 20px; color: #fff; display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
        .rc-roll { width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,.14); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; flex-shrink: 0; }
        .rc-panel { background: #fff; border: 1px solid #E9E5F5; border-radius: 14px; padding: 14px 16px; margin-bottom: 14px; }
        .rc-chip { display: inline-flex; align-items: center; gap: 8px; border: 1.5px solid #DDD6FE; background: #fff; color: #4C1D95; padding: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .rc-chip.on { background: #EDE9FE; border-color: ${PURPLE_MID}; }
        .rc-chip .bx { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid #A78BFA; display: flex; align-items: center; justify-content: center; color: #fff; }
        .rc-chip.on .bx { background: ${PURPLE_MID}; border-color: ${PURPLE_MID}; }
        .rc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
        @media (max-width: 640px) { .rc-stats { grid-template-columns: 1fr 1fr; } }
        .rc-stat { background: #fff; border: 1px solid #E9E5F5; border-radius: 12px; padding: 12px; text-align: center; }
        .rc-stat .v { font-size: 22px; font-weight: 800; color: #111827; }
        .rc-stat .l { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-top: 2px; }
        .rc-tablewrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; border: 1px solid #E9E5F5; background: #fff; }
        table.rc-t { width: 100%; min-width: 560px; border-collapse: collapse; }
        table.rc-t th { background: #1C1C1E; color: #fff; padding: 10px 8px; font-size: 11px; text-align: center; }
        table.rc-t th:first-child { text-align: left; }
        table.rc-t td { padding: 10px 8px; font-size: 14px; text-align: center; border-bottom: 1px solid #F1EEF8; }
        table.rc-t td:first-child { text-align: left; font-weight: 600; font-size: 13px; }
        table.rc-t tr:last-child td { border-bottom: 0; }
        .rc-print { width: 100%; background: ${PURPLE_DARK}; color: #fff; border: 0; padding: 14px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; }
        .rc-list { background: #fff; border: 1px solid #E9E5F5; border-radius: 14px; overflow: hidden; }
        .rc-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 14px; border: 0; border-bottom: 1px solid #F1EEF8; background: #fff; cursor: pointer; text-align: left; }
        .rc-row:last-child { border-bottom: 0; }
        .rc-row:hover { background: #FAF8FF; }
      `}</style>

      <header style={{ background: PURPLE_DARK, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goBack} style={{ background: 'rgba(255,255,255,.12)', border: 0, color: '#fff', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft /> Back
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Report Cards</div>
            <div style={{ color: '#C4B5FD', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedClass ? `Class ${selectedClass.name}` : `AY ${schoolYearLabel}`}{selectedStudent ? ` · ${selectedStudent.name}` : ''}
            </div>
          </div>
        </div>
      </header>

      <div className="rc-wrap">

        {/* STEP 1 — class */}
        {step === 'class' && (
          <>
            <StepTitle n={1} total={2} title="Select the class" sub="Report cards are built per student" />
            {loading ? <Spinner label="Loading classes…" /> : classes.length === 0 ? (
              <Empty title="No classes" sub="No classes are set up for this year." />
            ) : (
              <div className="rc-list">
                {classes.map(c => (
                  <button key={c.id} className="rc-row" onClick={() => pickClass(c)}>
                    <div className="rc-roll" style={{ width: 40, height: 40, background: '#EDE9FE', color: PURPLE_MID, fontSize: 15 }}>{classKey(c.name)}</div>
                    <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#111827' }}>Class {c.name}</div>
                    <span style={{ color: '#A78BFA' }}><ChevRight /></span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* STEP 2 — student */}
        {step === 'student' && selectedClass && (
          <>
            <StepTitle n={2} total={2} title="Select the student" sub={`Class ${selectedClass.name}`} />
            {studentsLoading ? <Spinner label="Loading students…" /> : students.length === 0 ? (
              <Empty title="No students yet" sub={`Class ${selectedClass.name} has no students added. The class teacher adds them under My Students.`} />
            ) : (
              <>
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Search by name or roll number"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #DDD6FE', borderRadius: 12, fontSize: 14, marginBottom: 12, background: '#fff' }} />
                <div className="rc-list">
                  {filteredStudents.map(stu => (
                    <button key={stu.id} className="rc-row" onClick={() => pickStudent(stu)}>
                      <div className="rc-roll" style={{ width: 40, height: 40, background: '#EDE9FE', color: PURPLE_MID, fontSize: 14 }}>{stu.roll_number}</div>
                      <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#111827', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.name}</div>
                      <span style={{ color: '#A78BFA' }}><ChevRight /></span>
                    </button>
                  ))}
                  {filteredStudents.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No students match that search.</div>}
                </div>
              </>
            )}
          </>
        )}

        {/* STEP 3 — card */}
        {step === 'card' && selectedClass && selectedStudent && (
          <>
            <div className="rc-hero">
              <div className="rc-roll">{selectedStudent.roll_number}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{selectedStudent.name}</div>
                <div style={{ color: '#C4B5FD', fontSize: 13 }}>Class {selectedClass.name} · Roll {selectedStudent.roll_number}</div>
              </div>
            </div>

            <div className="rc-panel">
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#6B7280', marginBottom: 10 }}>Include on card</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PART_ORDER.map(p => (
                  <button key={p} className={`rc-chip${active[p] ? ' on' : ''}`} onClick={() => toggle(p)}>
                    <span className="bx">{active[p] && <CheckIcon />}</span>
                    {PARTS[p].label} <span style={{ fontSize: 11, opacity: .7 }}>{partMaxLabel(p)}</span>
                  </button>
                ))}
              </div>
            </div>

            {cardLoading ? <Spinner label="Building card…" /> : subjects.length === 0 ? (
              <Empty title="No subjects" sub="Add subjects for this class under VP → Subjects." />
            ) : (
              <>
                <div className="rc-stats">
                  <div className="rc-stat"><div className="v">{grandTotal}<span style={{ fontSize: 12, color: '#9CA3AF' }}> / {grandMax}</span></div><div className="l">Total</div></div>
                  <div className="rc-stat"><div className="v">{percentage}%</div><div className="l">Percentage</div></div>
                  <div className="rc-stat"><div className="v">{gradeFor(percentage)}</div><div className="l">Grade</div></div>
                  <div className="rc-stat"><div className="v">{stats.rank ?? '—'}<span style={{ fontSize: 12, color: '#9CA3AF' }}> / {stats.count}</span></div><div className="l">Rank in class</div></div>
                </div>

                <div className="rc-tablewrap">
                  <table className="rc-t">
                    <thead><tr>
                      <th>Subject</th>
                      {activeParts.map(p => (
                        <th key={p}>{PARTS[p].label}<div style={{ fontSize: 9, color: '#A78BFA', fontWeight: 600 }}>{headerMax(p) != null ? `/${headerMax(p)}` : 'max varies'}</div></th>
                      ))}
                      <th style={{ background: PURPLE_DARK }}>Total</th>
                      <th>Highest</th>
                    </tr></thead>
                    <tbody>
                      {subjects.map(subj => (
                        <tr key={subj}>
                          <td>{subj}</td>
                          {activeParts.map(p => {
                            const v = partValue(p, subj)
                            const showMax = headerMax(p) == null
                            return (
                              <td key={p} style={{ color: typeof v === 'number' ? '#111827' : '#D1D5DB', fontWeight: typeof v === 'number' ? 600 : 400 }}>
                                {typeof v === 'number' ? v : '—'}
                                {showMax && <span style={{ fontSize: 9, color: '#A78BFA', fontWeight: 600 }}>/{partMax(p, subj)}</span>}
                              </td>
                            )
                          })}
                          <td style={{ background: '#FAF8FF', fontWeight: 800 }}>{subjectTotal(subj)}<span style={{ fontSize: 9, color: '#A78BFA' }}>/{rowMax(subj)}</span></td>
                          <td style={{ color: '#6B7280' }}>{stats.highest[subj] ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button className="rc-print" onClick={handlePrint}><PrintIcon /> Save / Print Report Card</button>
                <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 }}>
                  Co-scholastic grades, attendance and remarks print as blank boxes for the class teacher to fill in.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StepTitle({ n, total, title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: PURPLE_MID }}>Step {n} of {total}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: '#6B7280' }}>{sub}</div>}
    </div>
  )
}
function Spinner({ label }) {
  return <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>{label}</div>
}
function Empty({ title, sub }) {
  return (
    <div style={{ background: '#fff', border: '1px dashed #DDD6FE', borderRadius: 14, padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#6B7280' }}>{sub}</div>
    </div>
  )
}