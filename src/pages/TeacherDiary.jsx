import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase, getSchoolYear, getSchoolYearLabel } from '../lib/supabase'
import { classKey } from '../lib/examConfig'

function todayStr() { return new Date().toISOString().split('T')[0] }
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}
function getDayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00').getDay()
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]
}

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const EMPTY_ROW = () => ({
  class_section: '', subject: '', topic: '', activity_planned: '',
  home_assignment: '', total_students: '', present_students: '',
  isSub: false, isBreak: false,
})

// Pre-primary breaks at slot 4, primary at slot 6.
function isPrePrimary(className) {
  const n = (className || '').trim().toLowerCase()
  return n.startsWith('nursery') || n.startsWith('lkg') || n.startsWith('ukg')
}

// Which slot is this teacher's break today?
// Only certain when every class they teach that day is the same section —
// a teacher working both sections teaches at slot 4 AND slot 6, so no marking.
function breakSlotFor(classNames) {
  const list = classNames.filter(Boolean)
  if (list.length === 0) return null
  const pre = list.filter(isPrePrimary).length
  if (pre === list.length) return 4
  if (pre === 0) return 6
  return null
}

// ── Print CSS ─────────────────────────────────────────────────────
const PRINT_CSS = `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 8px;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body::before {
    content: '';
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 50%; aspect-ratio: 1;
    background-image: url('/logowithtext.png');
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    opacity: 0.05;
    z-index: 0;
    pointer-events: none;
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 7px;
    padding-bottom: 5px;
    border-bottom: 2px solid #1C1C1E;
  }
  .doc-title { font-size: 15px; font-weight: 800; color: #1C1C1E; }
  .doc-meta { font-size: 9px; color: #555; line-height: 1.7; text-align: right; }
  .doc-meta strong { color: #111; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th {
    background: #1C1C1E !important;
    color: #fff !important;
    padding: 6px 5px;
    font-size: 7.5px;
    font-weight: 700;
    text-align: center;
    border: 1px solid #333;
    line-height: 1.3;
  }
  td {
    border: 1px solid #C4C4C4;
    padding: 6px 6px;
    font-size: 8px;
    vertical-align: top;
    line-height: 1.4;
    height: 32px;
  }
  .period-cell {
    background: #F5F5F5 !important;
    text-align: center;
    font-weight: 800;
    color: #1C1C1E;
    vertical-align: middle;
    font-size: 10px;
  }
  .sub-tag {
    font-size: 6.5px; font-weight: 700; background: #FEF3C7; color: #92400E;
    padding: 0 3px; border-radius: 2px; letter-spacing: 0.3px;
  }
  .sig-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 14px;
    padding-top: 0;
    page-break-inside: avoid;
  }
  .sig-block { text-align: center; width: 180px; }
  .sig-line {
    border-top: 1.5px solid #374151;
    padding-top: 5px;
    font-size: 8.5px;
    font-weight: 700;
    color: #374151;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .sig-sub { font-size: 7.5px; color: #6B7280; margin-top: 3px; }
  .footer { margin-top: 8px; font-size: 7px; color: #aaa; text-align: right; }
  tr { page-break-inside: avoid; }
`

function openPrint(html, title) {
  const win = window.open('', '_blank', 'width=1200,height=850')
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}

// ── Icons ─────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const PrintIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
)
const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

// ── Small SUB badge ───────────────────────────────────────────────
function SubTag() {
  return (
    <span style={{ fontSize: 9, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase', display: 'inline-block' }}>
      Substitute
    </span>
  )
}

// ── Cell components ───────────────────────────────────────────────
function DiaryCell({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      style={{
        width: '100%', border: 'none', outline: 'none',
        background: 'transparent', fontFamily: 'inherit',
        fontSize: 13, color: '#111827', resize: 'none',
        lineHeight: 1.5, padding: 0, minHeight: 44,
      }}
    />
  )
}

function NumberCell({ value, onChange }) {
  return (
    <input
      type="number" min={0} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="—"
      style={{
        width: '100%', border: 'none', outline: 'none',
        background: 'transparent', fontFamily: 'inherit',
        fontSize: 13, color: '#111827', textAlign: 'center', padding: 0,
      }}
    />
  )
}

// ── Mobile card view for a single period ─────────────────────────
function MobilePeriodCard({ pn, row, onChange }) {
  const fields = [
    { key: 'class_section', label: 'Class & Section', placeholder: 'e.g. 5 A' },
    { key: 'subject', label: 'Subject', placeholder: 'e.g. Mathematics' },
    { key: 'topic', label: 'Topic', placeholder: 'Topic covered...' },
    { key: 'activity_planned', label: 'Activity Planned', placeholder: 'Activity / method...' },
    { key: 'home_assignment', label: 'Home Assignment', placeholder: 'Assignment given...' },
  ]
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <div style={{ background: '#1C1C1E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#1C1C1E', flexShrink: 0 }}>
          {pn}
        </div>
        <span style={{ color: '#F2F2F7', fontSize: 13, fontWeight: 600 }}>Period {pn}</span>
        {row.isSub && <div style={{ marginLeft: 'auto' }}><SubTag /></div>}
      </div>
      <div style={{ padding: '12px 14px' }}>
        {fields.map(f => (
          <div key={f.key} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{f.label}</div>
            <textarea
              value={row[f.key]}
              onChange={e => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.key === 'class_section' || f.key === 'subject' ? 1 : 2}
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#111827', fontFamily: 'inherit', resize: 'none', background: '#FAFAFA', outline: 'none' }}
            />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Total Students</div>
            <input type="number" min={0} value={row.total_students} onChange={e => onChange('total_students', e.target.value)} placeholder="—"
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#111827', fontFamily: 'inherit', background: '#FAFAFA', outline: 'none', textAlign: 'center' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Present</div>
            <input type="number" min={0} value={row.present_students} onChange={e => onChange('present_students', e.target.value)} placeholder="—"
              style={{ width: '100%', border: '1px solid #E5E5EA', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#111827', fontFamily: 'inherit', background: '#FAFAFA', outline: 'none', textAlign: 'center' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function TeacherDiary() {
  const navigate = useNavigate()
  const location = useLocation()
  const teacher = location.state?.teacher

  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [date, setDate] = useState(todayStr())
  const [rows, setRows] = useState(PERIODS.map(() => EMPTY_ROW()))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 700)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 700)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Warn if the tab is closed with unsaved changes
  useEffect(() => {
    function handler(e) {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    if (!teacher) { navigate('/login', { replace: true }); return }
    fetchDiary()
  }, [date])

  // ── Build Class + Subject suggestions from timetable + substitutions ──
  async function fetchSuggestions() {
    const result = {} // period_number -> { class_section, subject, isSub }
    const dayName = getDayName(date)
    if (dayName === 'Saturday' || dayName === 'Sunday') return result

    const { data: entries } = await supabase
      .from('timetable_entries')
      .select('*, timetable_periods(*, timetable_classes(*))')
      .eq('teacher_name', teacher.name)

    for (const e of (entries || [])) {
      const p = e.timetable_periods
      if (!p || p.is_break) continue
      if (p.day !== dayName) continue
      if (p.timetable_classes?.school_year !== currentSchoolYear) continue
      const pn = p.period_number
      if (!result[pn]) {
        result[pn] = {
          class_section: p.timetable_classes?.name || '',
          subject: e.subject || '',
          isSub: false,
        }
      }
    }

    const { data: subs } = await supabase
      .from('substitutions')
      .select('*')
      .eq('date', date)
      .eq('substitute_teacher', teacher.name)
      .eq('school_year', currentSchoolYear)

    for (const s of (subs || [])) {
      result[s.period_number] = {
        class_section: s.class_name || '',
        subject: s.subject || '',
        isSub: true,
      }
    }

    // ── Look up how many students are in each class we're teaching today ──
    // Students are stored without the section ("4"), timetable gives "4 A",
    // so classKey() normalises before matching.
    const classNames = [...new Set(
      Object.values(result).map(r => classKey(r.class_section)).filter(Boolean)
    )]

    if (classNames.length > 0) {
      const { data: studs } = await supabase
        .from('students')
        .select('class_name')
        .in('class_name', classNames)
        .eq('school_year', currentSchoolYear)

      const counts = {}
      for (const s of (studs || [])) {
        counts[s.class_name] = (counts[s.class_name] || 0) + 1
      }
      // attach the count to each period's suggestion
      for (const pn of Object.keys(result)) {
        const key = classKey(result[pn].class_section)
        result[pn].total_students = counts[key] ? String(counts[key]) : ''
      }
    }

    return result
  }

  async function fetchDiary() {
    setLoading(true)

    const { data: savedData } = await supabase
      .from('teacher_diary')
      .select('*')
      .eq('teacher_name', teacher.name)
      .eq('date', date)
      .eq('school_year', currentSchoolYear)
      .order('period_number')

    const suggestions = await fetchSuggestions()

    const breakSlot = breakSlotFor(
      Object.values(suggestions).map(s => s.class_section)
    )

    const newRows = PERIODS.map(pn => {

      const found = (savedData || []).find(r => r.period_number === pn)
      const sug = suggestions[pn]
      if (found) {
        // Only auto-fill Total if the saved cell is empty — never overwrite a typed value.
        const savedTotal = found.total_students ?? ''
        return {
          class_section: found.class_section || sug?.class_section || '',
          subject: found.subject || sug?.subject || '',
          topic: found.topic || '',
          activity_planned: found.activity_planned || '',
          home_assignment: found.home_assignment || '',
          total_students: savedTotal !== '' && savedTotal !== null
            ? savedTotal
            : (sug?.total_students || ''),
         present_students: found.present_students ?? '',
          isSub: sug?.isSub || false,
          isBreak: pn === breakSlot && !sug,
        }
      }
     return {
        ...EMPTY_ROW(),
        class_section: sug?.class_section || '',
        subject: sug?.subject || '',
        total_students: sug?.total_students || '',
        isSub: sug?.isSub || false,
        isBreak: pn === breakSlot && !sug,
      }
    })
    setRows(newRows)
    setDirty(false)   // freshly loaded = nothing unsaved
    setLoading(false)
  }

  function updateCell(periodIdx, field, value) {
    setRows(prev => prev.map((r, i) => i === periodIdx ? { ...r, [field]: value } : r))
    setDirty(true)
  }

  // Guard date changes so unsaved work is never wiped silently
  function handleDateChange(newDate) {
    if (!newDate) return
    if (dirty) {
      const ok = window.confirm('You have unsaved changes for this date.\n\nSwitch date anyway? Your unsaved changes will be lost.')
      if (!ok) return
    }
    setDate(newDate)
  }

  async function saveDiary() {
    if (!teacher || saving) return
    setSaving(true)
    const t = toast.loading('Saving diary…')

    try {
      const { error: delError } = await supabase
        .from('teacher_diary')
        .delete()
        .eq('teacher_name', teacher.name)
        .eq('date', date)
        .eq('school_year', currentSchoolYear)

      if (delError) throw new Error(delError.message)

      const toInsert = PERIODS.map((pn, i) => ({
        teacher_name: teacher.name,
        date,
        school_year: currentSchoolYear,
        period_number: pn,
        class_section: rows[i].class_section || null,
        subject: rows[i].subject || null,
        topic: rows[i].topic || null,
        activity_planned: rows[i].activity_planned || null,
        home_assignment: rows[i].home_assignment || null,
        total_students: rows[i].total_students !== '' ? Number(rows[i].total_students) : null,
        present_students: rows[i].present_students !== '' ? Number(rows[i].present_students) : null,
        updated_at: new Date().toISOString(),
      }))

      const { error: insError } = await supabase.from('teacher_diary').insert(toInsert)
      if (insError) throw new Error(insError.message)

      setDirty(false)
      toast.success('Diary saved ✓', { id: t, duration: 3000 })
    } catch (err) {
      toast.error('Save failed: ' + err.message, { id: t, duration: 6000 })
    }

    setSaving(false)
  }

  function handlePrint() {
    const teacherName = teacher?.name?.trim() || ''
    const dateLabel = fmtDate(date)

    const rowsHTML = rows.map((row, i) => `
      <tr>
        <td class="period-cell">${PERIODS[i]}</td>
        <td>${row.class_section || ''}${row.isSub ? ' <span class="sub-tag">SUB</span>' : ''}</td>
        <td>${row.subject || ''}</td>
        <td>${(row.topic || '').replace(/\n/g, '<br/>')}</td>
        <td>${(row.activity_planned || '').replace(/\n/g, '<br/>')}</td>
        <td>${(row.home_assignment || '').replace(/\n/g, '<br/>')}</td>
        <td style="text-align:center">${row.total_students !== '' ? row.total_students : ''}</td>
        <td style="text-align:center">${row.present_students !== '' ? row.present_students : ''}</td>
      </tr>`).join('')

    const html = `
      <div class="doc-header">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
            <img src="/logo.png" alt="PGS" style="height:30px;object-fit:contain" onerror="this.style.display='none'" />
            <span style="font-size:9px;font-weight:700;color:#555;letter-spacing:1px;text-transform:uppercase">Premier Global School</span>
          </div>
          <div class="doc-title">Teacher's Diary</div>
        </div>
        <div class="doc-meta">
          <div><strong>Name of the Teacher:</strong> ${teacherName}</div>
          <div><strong>Date:</strong> ${dateLabel}</div>
          <div style="margin-top:2px;color:#888">Academic Year ${schoolYearLabel}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:34px">Period</th>
            <th style="width:75px">Class &amp; Section</th>
            <th style="width:80px">Subject</th>
            <th>Topic</th>
            <th>Activity Planned</th>
            <th>Home Assignment</th>
            <th style="width:48px">Total Students</th>
            <th style="width:48px">Present</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>

      <div class="sig-section">
        <div class="sig-block">
          <div style="height:34px"></div>
          <div class="sig-line">Teacher's Signature</div>
          <div class="sig-sub">${teacherName}</div>
        </div>
        <div style="font-size:7px;color:#ccc;text-align:center;align-self:flex-end;padding-bottom:4px">
          Premier Global School · AY ${schoolYearLabel}
        </div>
        <div class="sig-block">
          <div style="height:34px"></div>
          <div class="sig-line">HM / VP / Principal Signature</div>
          <div class="sig-sub">Premier Global School</div>
        </div>
      </div>

      <div class="footer">
        Teacher's Diary · Premier Global School · AY ${schoolYearLabel} · ${dateLabel}
      </div>
    `
    openPrint(html, `Teacher's Diary — ${teacherName} — ${date}`)
  }

  if (!teacher) return null

  const TH = {
    background: '#1C1C1E', color: '#F2F2F7',
    padding: '11px 10px', fontSize: 11, fontWeight: 700,
    textAlign: 'left', letterSpacing: 0.5, textTransform: 'uppercase',
    borderRight: '1px solid #2C2C2E', whiteSpace: 'nowrap',
  }
  const TD = {
    borderBottom: '1px solid #F3F4F6', borderRight: '1px solid #F3F4F6',
    padding: '10px 12px', verticalAlign: 'top',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 600, borderRadius: 10 } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, button, select { font-family: inherit; }
        textarea:focus, input:focus { outline: none; }
        textarea::placeholder, input::placeholder { color: #D1D5DB; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #E5E5EA; border-radius: 4px; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background: '#1C1C1E', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 14px', height: 54, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <button onClick={() => {
              if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
              navigate('/dashboard', { state: { teacher } })
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
              <ArrowLeftIcon /> {!isMobile && 'Dashboard'}
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 700 }}>Teacher's Diary</div>
              <div style={{ color: '#636366', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {teacher.name?.trim()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
            {!isMobile && <span style={{ color: '#48484A', fontSize: 10, fontFamily: 'monospace' }}>{schoolYearLabel}</span>}
            <button onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#C4B5FD', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <PrintIcon /> {!isMobile && 'Print'}
            </button>
            <button onClick={saveDiary} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: saving ? '#2C2C2E' : '#F2F2F7', border: 'none', color: saving ? '#636366' : '#1C1C1E', padding: '7px 14px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
              <SaveIcon /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 14px 90px' }}>

        {/* ── Top bar ── */}
        <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>Teacher's Diary</div>
            <div style={{ color: '#F2F2F7', fontSize: isMobile ? 15 : 17, fontWeight: 700 }}>{teacher.name?.trim()}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ color: '#636366', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Date</label>
            <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} disabled={saving}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #3A3A3C', background: '#2C2C2E', color: '#F2F2F7', fontSize: 13 }} />
            {!isMobile && <div style={{ color: '#8E8E93', fontSize: 11 }}>{fmtDate(date)}</div>}
          </div>
        </div>

        {isMobile && (
          <div style={{ fontSize: 11, color: '#8E8E93', textAlign: 'center', marginBottom: 10 }}>{fmtDate(date)}</div>
        )}

        {/* Auto-fill note */}
        <div style={{ fontSize: 11, color: '#8E8E93', marginBottom: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px' }}>
          Class, Subject &amp; Total Students are filled automatically — you can edit them if needed. Substitution periods are tagged.
        </div>

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 48, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>
            Loading diary...
          </div>
        ) : isMobile ? (
          // ── MOBILE: card per period ──
          <>
            {PERIODS.map((pn, i) => rows[i].isBreak ? (
              <div key={pn} style={{
                background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12,
                marginBottom: 12, padding: '14px', textAlign: 'center',
                color: '#059669', fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
              }}>
                Break
              </div>
            ) : (
              <MobilePeriodCard
                key={pn}
                pn={pn}
                row={rows[i]}
                onChange={(field, val) => updateCell(i, field, val)}
              />
            ))}
            <button onClick={saveDiary} disabled={saving}
              style={{ width: '100%', background: saving ? '#E5E5EA' : '#1C1C1E', border: 'none', color: saving ? '#8E8E93' : '#fff', padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
              <SaveIcon /> {saving ? 'Saving...' : 'Save Diary'}
            </button>
          </>
        ) : (
          // ── DESKTOP: table ──
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 60, textAlign: 'center' }}>Period</th>
                    <th style={{ ...TH, width: 120 }}>Class &amp; Section</th>
                    <th style={{ ...TH, width: 130 }}>Subject</th>
                    <th style={TH}>Topic</th>
                    <th style={TH}>Activity Planned</th>
                    <th style={TH}>Home Assignment</th>
                    <th style={{ ...TH, width: 80, textAlign: 'center' }}>Total</th>
                    <th style={{ ...TH, width: 80, textAlign: 'center', borderRight: 'none' }}>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => row.isBreak ? (
                    <tr key={PERIODS[i]}>
                      <td colSpan={8} style={{
                        borderBottom: '1px solid #F3F4F6', background: '#F0FDF4',
                        textAlign: 'center', padding: '10px', color: '#059669',
                        fontSize: 13, fontWeight: 700, fontStyle: 'italic', letterSpacing: 0.5,
                      }}>
                        Break
                      </td>
                    </tr>
                  ) : (
                    <tr key={PERIODS[i]} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ ...TD, background: '#F5F3FF', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, fontSize: 16, color: '#1C1C1E', borderRight: '1px solid #E5E5EA', width: 60 }}>
                        {PERIODS[i]}
                      </td>
                      <td style={{ ...TD, width: 120 }}>
                        {row.isSub && <div style={{ marginBottom: 4 }}><SubTag /></div>}
                        <DiaryCell value={row.class_section} onChange={v => updateCell(i, 'class_section', v)} placeholder="e.g. 5 A" />
                      </td>
                      <td style={{ ...TD, width: 130 }}>
                        <DiaryCell value={row.subject} onChange={v => updateCell(i, 'subject', v)} placeholder="Subject..." />
                      </td>
                      <td style={TD}>
                        <DiaryCell value={row.topic} onChange={v => updateCell(i, 'topic', v)} placeholder="Topic covered..." />
                      </td>
                      <td style={TD}>
                        <DiaryCell value={row.activity_planned} onChange={v => updateCell(i, 'activity_planned', v)} placeholder="Activity / method..." />
                      </td>
                      <td style={TD}>
                        <DiaryCell value={row.home_assignment} onChange={v => updateCell(i, 'home_assignment', v)} placeholder="Assignment given..." />
                      </td>
                      <td style={{ ...TD, width: 80, textAlign: 'center', verticalAlign: 'middle' }}>
                        <NumberCell value={row.total_students} onChange={v => updateCell(i, 'total_students', v)} />
                      </td>
                      <td style={{ ...TD, width: 80, textAlign: 'center', verticalAlign: 'middle', borderRight: 'none' }}>
                        <NumberCell value={row.present_students} onChange={v => updateCell(i, 'present_students', v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>Class &amp; Subject auto-filled from timetable · Switch dates anytime to view past entries</span>
              <button onClick={saveDiary} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: saving ? '#F2F2F7' : '#1C1C1E', border: 'none', color: saving ? '#8E8E93' : '#fff', padding: '9px 22px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                <SaveIcon /> {saving ? 'Saving...' : 'Save Diary'}
              </button>
            </div>
          </div>
        )}

        {/* ── Signature block ── */}
        <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ textAlign: 'center', minWidth: 130 }}>
            <div style={{ height: 44, borderBottom: '1.5px solid #374151', marginBottom: 7 }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>Teacher's Signature</div>
            <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>{teacher.name?.trim()}</div>
          </div>
          <div style={{ fontSize: 10, color: '#C7C7CC', textAlign: 'center' }}>
            Premier Global School · AY {schoolYearLabel}
          </div>
          <div style={{ textAlign: 'center', minWidth: 130 }}>
            <div style={{ height: 44, borderBottom: '1.5px solid #374151', marginBottom: 7 }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 }}>HM / VP / Principal</div>
            <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 2 }}>Premier Global School</div>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: '#C7C7CC', textAlign: 'center' }}>
          Entries saved per date · Switch dates to view or edit any day's diary
        </div>
      </div>

      {/* ── Floating Save button (always reachable) ── */}
      <button onClick={saveDiary} disabled={saving}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 60,
          display: 'flex', alignItems: 'center', gap: 8,
          background: saving ? '#3A3A3C' : (dirty ? '#1C1C1E' : '#059669'),
          color: '#fff', border: '2px solid #fff',
          boxShadow: '0 6px 22px rgba(0,0,0,0.28)',
          padding: '14px 22px', borderRadius: 999,
          fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
        }}>
        <SaveIcon /> {saving ? 'Saving…' : (dirty ? 'Save Diary' : 'Saved ✓')}
      </button>
    </div>
  )
}