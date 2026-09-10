import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, VP_PASSWORD, TEACHERS, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'

// ═══════════════════════════════════════════════════════════════
//  VP — Subjects & Teacher Assignments
//
//  `subjects` is the master list of exam subjects per class.
//  `teacher_subjects` says which teacher enters marks for each.
//  Teachers' Marks Entry reads ONLY these tables — the timetable
//  no longer decides who can mark what.
//
//  Rename calls the `rename_subject` SQL function so subjects,
//  marks and timetable are updated together.
// ═══════════════════════════════════════════════════════════════

const PURPLE_DARK = '#3B0764'
const PURPLE      = '#5B21B6'
const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8']
const classLabel = c => /^[0-9]+$/.test(c) ? `Class ${c}` : c

const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
)
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
)
const EyeOffIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
)
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
)
const PrintIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
)

export default function VPSubjects() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel   = getSchoolYearLabel(currentSchoolYear)

  const [selectedClass, setSelectedClass] = useState('1')
  const [subjects, setSubjects] = useState([])   // [{ id, name, active, teachers: [name] }]
  const [loading, setLoading]   = useState(true)
  const [newName, setNewName]   = useState('')
  const [busyId, setBusyId]     = useState(null)
  const [toast, setToast]       = useState(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
  }, [])

  useEffect(() => { load(selectedClass) }, [selectedClass])

  function showToast(text, ok = true) {
    setToast({ text, ok })
    setTimeout(() => setToast(null), 2600)
  }

  async function load(cls) {
    setLoading(true)
    const [{ data: subs }, { data: assigns }] = await Promise.all([
      supabase.from('subjects').select('id, name, active')
        .eq('school_year', currentSchoolYear).eq('class_name', cls).order('name'),
      supabase.from('teacher_subjects').select('subject_id, teacher_name')
        .eq('school_year', currentSchoolYear).eq('class_name', cls),
    ])
    const byId = {}
    for (const a of (assigns || [])) (byId[a.subject_id] ||= []).push(a.teacher_name)
    setSubjects((subs || []).map(s => ({ ...s, teachers: (byId[s.id] || []).sort() })))
    setLoading(false)
  }

  // ── Actions ──
  async function addSubject() {
    const name = newName.trim()
    if (!name) return
    const { error } = await supabase.from('subjects')
      .insert({ school_year: currentSchoolYear, class_name: selectedClass, name })
    if (error) { showToast(error.code === '23505' ? 'That subject already exists in this class' : error.message, false); return }
    setNewName('')
    showToast(`Added ${name}`)
    load(selectedClass)
  }

  async function renameSubject(sub) {
    const name = window.prompt(`Rename "${sub.name}" to:`, sub.name)
    if (name == null) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === sub.name) return
    setBusyId(sub.id)
    const { error } = await supabase.rpc('rename_subject', { p_subject_id: sub.id, p_new_name: trimmed })
    setBusyId(null)
    if (error) { showToast(error.message, false); return }
    showToast(`Renamed to ${trimmed} — marks and timetable updated`)
    load(selectedClass)
  }

  async function toggleActive(sub) {
    setBusyId(sub.id)
    const { error } = await supabase.from('subjects').update({ active: !sub.active }).eq('id', sub.id)
    setBusyId(null)
    if (error) { showToast(error.message, false); return }
    showToast(sub.active ? `${sub.name} hidden from teachers` : `${sub.name} is active again`)
    load(selectedClass)
  }

  async function assignTeacher(sub, teacherName) {
    if (!teacherName) return
    setBusyId(sub.id)
    const { error } = await supabase.from('teacher_subjects')
      .insert({ school_year: currentSchoolYear, teacher_name: teacherName, class_name: selectedClass, subject_id: sub.id })
    setBusyId(null)
    if (error && error.code !== '23505') { showToast(error.message, false); return }
    showToast(`${teacherName} can now mark ${sub.name}`)
    load(selectedClass)
  }

  async function unassignTeacher(sub, teacherName) {
    if (!window.confirm(`Remove ${teacherName} from ${sub.name}?\n\nMarks already entered are kept — they just won't see this subject in Marks Entry.`)) return
    setBusyId(sub.id)
    const { error } = await supabase.from('teacher_subjects').delete()
      .eq('subject_id', sub.id).eq('teacher_name', teacherName)
    setBusyId(null)
    if (error) { showToast(error.message, false); return }
    showToast(`${teacherName} removed from ${sub.name}`)
    load(selectedClass)
  }

  // ── Printing ──
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const classOrder = c => { const i = CLASSES.indexOf(c); return i === -1 ? 99 : i }

  // Balvatika / pre-primary timetable names → subject class keys
  function ttClassKey(name) {
    const n = String(name).toLowerCase()
    if (n.startsWith('balvatika 1') || n.startsWith('nursery')) return 'Nursery'
    if (n.startsWith('balvatika 2') || n.startsWith('lkg')) return 'LKG'
    if (n.startsWith('balvatika 3') || n.startsWith('ukg')) return 'UKG'
    const m = n.match(/^(\d+)/); return m ? m[1] : name
  }

  async function fetchAllForPrint() {
    setPrinting(true)
    const [{ data: subs }, { data: assigns }, { data: tt }] = await Promise.all([
      supabase.from('subjects').select('id, class_name, name, active')
        .eq('school_year', currentSchoolYear).eq('active', true).order('name'),
      supabase.from('teacher_subjects').select('subject_id, teacher_name')
        .eq('school_year', currentSchoolYear),
      supabase.from('timetable_entries')
        .select('subject, teacher_name, timetable_periods!inner(is_break, timetable_classes!inner(name, school_year))')
        .eq('timetable_periods.timetable_classes.school_year', currentSchoolYear),
    ])
    setPrinting(false)
    // periods per week keyed "class|subject|teacher" and "class|subject"
    const weekly = {}
    for (const e of (tt || [])) {
      const cls = ttClassKey(e.timetable_periods?.timetable_classes?.name || '')
      weekly[`${cls}|${e.subject}|${e.teacher_name}`] = (weekly[`${cls}|${e.subject}|${e.teacher_name}`] || 0) + 1
      weekly[`${cls}|${e.subject}`] = (weekly[`${cls}|${e.subject}`] || 0) + 1
    }
    return { subs: subs || [], assigns: assigns || [], weekly }
  }

  function openPrintWindow(title, meta, bodyHtml) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — ${schoolYearLabel}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; padding: 6mm 8mm;
          -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1C1C1E; padding-bottom: 10px; margin-bottom: 6px; }
        .head img { height: 46px; object-fit: contain; }
        .school { font-size: 11px; color: #5B21B6; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; }
        .title { font-size: 20px; font-weight: 800; }
        .meta { font-size: 11px; color: #6B7280; margin-bottom: 14px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 10mm; row-gap: 8mm; align-items: start; }
        .cls { break-inside: avoid; page-break-inside: avoid; }
        h2 { font-size: 12px; font-weight: 800; background: #F5F3FF; color: #3B0764; padding: 6px 10px; border-left: 4px solid #5B21B6; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }
        h2 span { font-size: 9.5px; font-weight: 600; color: #6B7280; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .6px; color: #6B7280; padding: 4px 6px; border-bottom: 1px solid #D1D5DB; }
        td { padding: 5px 6px; border-bottom: 1px solid #E5E7EB; vertical-align: top; font-size: 10.5px; word-wrap: break-word; }
        td.s { font-weight: 600; width: 46%; }
        td.c { font-weight: 600; width: 30%; color: #3B0764; }
        td.none { color: #B91C1C; font-style: italic; }
        th.n, td.n { text-align: center; width: 48px; }
        .foot { margin-top: 14px; font-size: 10px; color: #9CA3AF; text-align: right; }
      </style></head><body>
      <div class="head">
        <img src="/logo.png" onerror="this.style.display='none'" />
        <div><div class="school">Premier Global School</div><div class="title">${esc(title)}</div></div>
      </div>
      <div class="meta">Academic Year ${schoolYearLabel} · ${esc(meta)}</div>
      <div class="grid">${bodyHtml}</div>
      <div class="foot">Printed ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) { showToast('Pop-up blocked — allow pop-ups to print', false); return }
    w.document.open(); w.document.write(html); w.document.close()
  }

  // Print A: by class → subject → teacher
  async function printByClass() {
    const { subs, assigns, weekly } = await fetchAllForPrint()
    const byId = {}
    for (const a of assigns) (byId[a.subject_id] ||= []).push(a.teacher_name)
    const byClass = {}
    for (const s of subs) (byClass[s.class_name] ||= []).push({ ...s, teachers: (byId[s.id] || []).sort() })

    const sections = CLASSES.filter(c => byClass[c]?.length).map(c => `
      <section class="cls">
        <h2>${esc(classLabel(c))} <span>${byClass[c].length} subject${byClass[c].length === 1 ? '' : 's'}</span></h2>
        <table>
          <thead><tr><th>Subject</th><th>Teacher</th><th class="n">/ week</th></tr></thead>
          <tbody>${byClass[c].map(s => `
            <tr><td class="s">${esc(s.name)}</td>
                <td class="${s.teachers.length ? '' : 'none'}">${s.teachers.length ? esc(s.teachers.join(', ')) : 'Not assigned'}</td>
                <td class="n">${weekly[`${c}|${s.name}`] || '—'}</td></tr>`).join('')}
          </tbody>
        </table>
      </section>`).join('')

    const totalClasses = CLASSES.filter(c => byClass[c]?.length).length
    const totalPeriods = Object.entries(weekly).filter(([k]) => k.split('|').length === 2).reduce((a, [, v]) => a + v, 0)
    openPrintWindow('Subjects & Teachers', `${totalClasses} classes · ${subs.length} subjects · ${totalPeriods} periods a week`, sections)
  }

  // Print B: by teacher → class → subject
  async function printByTeacher() {
    const { subs, assigns, weekly } = await fetchAllForPrint()
    const subById = {}
    for (const s of subs) subById[s.id] = s
    const byTeacher = {}
    for (const a of assigns) {
      const s = subById[a.subject_id]
      if (!s) continue
      (byTeacher[a.teacher_name] ||= []).push({ cls: s.class_name, subject: s.name })
    }
    // Include teachers with no assignments so gaps are visible
    for (const t of TEACHERS) byTeacher[t.name] ||= []

    const names = Object.keys(byTeacher).sort((a, b) => a.localeCompare(b))
    const sections = names.map(name => {
      const rows = byTeacher[name].sort((a, b) => classOrder(a.cls) - classOrder(b.cls) || a.subject.localeCompare(b.subject))
        .map(r => ({ ...r, n: weekly[`${r.cls}|${r.subject}|${name}`] || 0 }))
      const classCount = new Set(rows.map(r => r.cls)).size
      const total = rows.reduce((a, r) => a + r.n, 0)
      return `
      <section class="cls">
        <h2>${esc(name)} <span>${rows.length ? `${classCount} class${classCount === 1 ? '' : 'es'} · ${rows.length} subject${rows.length === 1 ? '' : 's'} · <b>${total} periods/week</b>` : 'no subjects'}</span></h2>
        <table>
          <thead><tr><th>Class</th><th>Subject</th><th class="n">/ week</th></tr></thead>
          <tbody>${rows.length ? rows.map(r => `
            <tr><td class="c">${esc(classLabel(r.cls))}</td><td>${esc(r.subject)}</td><td class="n">${r.n || '—'}</td></tr>`).join('')
            : `<tr><td class="none" colspan="3">Not assigned to any subject</td></tr>`}
          </tbody>
        </table>
      </section>`
    }).join('')

    const assigned = names.filter(n => byTeacher[n].length).length
    openPrintWindow('Teachers & Subjects', `${assigned} of ${names.length} teachers assigned · ${assigns.length} assignments`, sections)
  }

  const activeCount     = subjects.filter(s => s.active).length
  const unassignedCount = subjects.filter(s => s.active && s.teachers.length === 0).length

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3FF', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button, input, select { font-family: inherit; }

        .vps-classbar { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .vps-classbar::-webkit-scrollbar { display: none; }
        .vps-pill { flex: 0 0 auto; border: 1.5px solid #DDD6FE; background: #fff; color: #4C1D95; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .vps-pill.on { background: ${PURPLE_DARK}; border-color: ${PURPLE_DARK}; color: #fff; }

        .vps-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 720px) { .vps-grid { grid-template-columns: 1fr; } }

        .vps-card { background: #fff; border: 1px solid #E9E5F5; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(59,7,100,0.05); }
        .vps-card.off { opacity: .6; }
        .vps-card-head { padding: 14px 16px 10px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .vps-card-body { padding: 0 16px 14px; flex: 1; }
        .vps-card-foot { border-top: 1px solid #F3F0FA; padding: 10px 12px; display: flex; gap: 6px; flex-wrap: wrap; }

        .vps-teacher { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .vps-teacher + .vps-teacher { border-top: 1px dashed #EEEAF7; }
        .vps-avatar { width: 30px; height: 30px; border-radius: 50%; background: #EDE9FE; color: ${PURPLE}; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .vps-remove { margin-left: auto; background: transparent; border: 0; color: #9CA3AF; font-size: 12px; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
        .vps-remove:hover { color: #B91C1C; background: #FEF2F2; }

        .vps-ibtn { display: inline-flex; align-items: center; gap: 6px; background: #F9F7FE; border: 1px solid #E9E5F5; color: #4C1D95; padding: 7px 11px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; }
        .vps-ibtn:hover { background: #EDE9FE; }
        .vps-ibtn:disabled { opacity: .5; cursor: default; }
        .vps-select { flex: 1; min-width: 150px; appearance: none; -webkit-appearance: none; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236D28D9' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center; border: 1px solid #DDD6FE; color: #4C1D95; padding: 7px 28px 7px 11px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; }
        .vps-select:disabled { opacity: .5; cursor: default; }

        .vps-addrow { display: flex; gap: 8px; }
        @media (max-width: 480px) { .vps-addrow { flex-direction: column; } .vps-addrow button { width: 100%; justify-content: center; } }
      `}</style>

      <header style={{ background: PURPLE_DARK, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '9px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="PGS" style={{ height: 32, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>Premier Global School</div>
              <div style={{ color: '#F9FAFB', fontSize: 14, fontWeight: 700 }}>VP — Subjects</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={printByClass} disabled={printing} title="One section per class: subject and teacher"
              style={{ background: '#fff', border: '1px solid #fff', color: PURPLE_DARK, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: printing ? .6 : 1 }}>
              <PrintIcon /> By class
            </button>
            <button onClick={printByTeacher} disabled={printing} title="One section per teacher: class and subject"
              style={{ background: '#fff', border: '1px solid #fff', color: PURPLE_DARK, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, opacity: printing ? .6 : 1 }}>
              <PrintIcon /> By teacher
            </button>
            <button onClick={() => navigate('/vp')}
              style={{ background: 'transparent', border: '1px solid #6D28D9', color: '#C4B5FD', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeftIcon /> Dashboard
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 16px 40px' }}>

        {/* Class picker */}
        <div className="vps-classbar" style={{ marginBottom: 14 }}>
          {CLASSES.map(c => (
            <button key={c} className={`vps-pill${selectedClass === c ? ' on' : ''}`} onClick={() => setSelectedClass(c)}>{classLabel(c)}</button>
          ))}
        </div>

        {/* Summary + add */}
        <div style={{ background: '#fff', border: '1px solid #E9E5F5', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{classLabel(selectedClass)}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>
              {loading ? 'Loading…' : (
                <>
                  {activeCount} subject{activeCount === 1 ? '' : 's'}
                  {unassignedCount > 0 && <span style={{ color: '#B91C1C', fontWeight: 600 }}> · {unassignedCount} without a teacher</span>}
                  <span style={{ color: '#9CA3AF' }}> · AY {schoolYearLabel}</span>
                </>
              )}
            </div>
          </div>
          <div className="vps-addrow">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSubject() }}
              placeholder="New subject name, e.g. Computer"
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #DDD6FE', borderRadius: 10, fontSize: 14, background: '#FCFBFF' }} />
            <button onClick={addSubject} disabled={!newName.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: PURPLE_DARK, color: '#fff', border: 0, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: newName.trim() ? 1 : .5 }}>
              <PlusIcon /> Add subject
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!loading && subjects.length === 0 && (
          <div style={{ background: '#fff', border: '1px dashed #DDD6FE', borderRadius: 14, padding: 28, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
            No subjects yet for {classLabel(selectedClass)}. Add the first one above.
          </div>
        )}

        {/* Subject cards */}
        <div className="vps-grid">
          {subjects.map(sub => {
            const busy = busyId === sub.id
            const unassigned = TEACHERS.map(t => t.name).filter(n => !sub.teachers.includes(n))
            return (
              <div key={sub.id} className={`vps-card${sub.active ? '' : ' off'}`}>

                <div className="vps-card-head">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', lineHeight: 1.25, wordBreak: 'break-word' }}>{sub.name}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: sub.active ? '#6B7280' : '#9CA3AF' }}>
                      {sub.active
                        ? (sub.teachers.length === 0 ? 'Not visible to any teacher yet' : `Marked by ${sub.teachers.length} teacher${sub.teachers.length === 1 ? '' : 's'}`)
                        : 'Hidden from teachers'}
                    </div>
                  </div>
                  <span style={{
                    flexShrink: 0, width: 9, height: 9, borderRadius: '50%', marginTop: 5,
                    background: !sub.active ? '#D1D5DB' : sub.teachers.length === 0 ? '#EF4444' : '#22C55E'
                  }} />
                </div>

                <div className="vps-card-body">
                  {sub.teachers.length === 0 ? (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 500 }}>
                      No teacher assigned — nobody can enter marks for this subject.
                    </div>
                  ) : sub.teachers.map(t => (
                    <div key={t} className="vps-teacher">
                      <div className="vps-avatar">{initials(t)}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1F2937', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</div>
                      <button className="vps-remove" disabled={busy} onClick={() => unassignTeacher(sub, t)}>Remove</button>
                    </div>
                  ))}
                </div>

                <div className="vps-card-foot">
                  <select className="vps-select" value="" disabled={busy || unassigned.length === 0}
                    onChange={e => assignTeacher(sub, e.target.value)}>
                    <option value="">Assign a teacher…</option>
                    {unassigned.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="vps-ibtn" disabled={busy} onClick={() => renameSubject(sub)}><PencilIcon /> Rename</button>
                  <button className="vps-ibtn" disabled={busy} onClick={() => toggleActive(sub)}>
                    {sub.active ? <><EyeOffIcon /> Hide</> : <><EyeIcon /> Show</>}
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#111827' : '#B91C1C', color: '#fff', padding: '10px 16px',
          borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 6px 20px rgba(0,0,0,0.25)', zIndex: 100, maxWidth: '90vw', textAlign: 'center'
        }}>{toast.text}</div>
      )}
    </div>
  )
}