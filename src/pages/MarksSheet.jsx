import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase, getSchoolYear, getSchoolYearLabel } from '../lib/supabase'
import {
  LAT_MONTHS, LAT_MAX, LAT_RED_AT,
  getFormativeComponents, getHalfYearlyComponents, isMarksClass, classKey,
} from '../lib/examConfig'

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
)
const SaveIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
)

// key helpers for the marks map
const keyOf = (studentId, examType, component) => `${studentId}__${examType}__${component}`

export default function MarksSheet() {
  const navigate = useNavigate()
  const location = useLocation()
  const teacher = location.state?.teacher
  const isVP = location.state?.vp === true
  const className = location.state?.className
  const subject = location.state?.subject
  // Who to record as the editor of a mark
  const editorName = isVP ? 'VP' : (teacher?.name || '')
  // Students + marks are stored under the class WITHOUT section (e.g. "4"),
  // while the timetable passes "4 A". Strip the section for data lookups.
  const studentClass = className ? classKey(className) : ''

  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [tab, setTab] = useState('lat')  // 'lat' | 'formative'
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({})     // key -> score (string)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const formativeComponents = className ? getFormativeComponents(className) : []
  const halfyearlyComponents = className ? getHalfYearlyComponents(className, subject) : []
  const inStructure = className ? isMarksClass(className) : false

  useEffect(() => {
    if ((!teacher && !isVP) || !className || !subject) {
      navigate(isVP ? '/vp/marks' : '/marks', { replace: true })
      return
    }
    load()
  }, [])

  // warn on tab close if unsaved
  useEffect(() => {
    function beforeUnload(e) { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  async function load() {
    setLoading(true)
    // students of this class
    const { data: studs } = await supabase
      .from('students')
      .select('*')
      .eq('class_name', studentClass)
      .eq('school_year', currentSchoolYear)
      .order('roll_number', { ascending: true })
    setStudents(studs || [])

    // existing marks for this class+subject
    const { data: rows } = await supabase
      .from('marks')
      .select('*')
      .eq('class_name', studentClass)
      .eq('subject', subject)
      .eq('school_year', currentSchoolYear)

    const map = {}
    for (const r of (rows || [])) {
      map[keyOf(r.student_id, r.exam_type, r.component)] = r.score == null ? '' : String(r.score)
    }
    setMarks(map)
    setDirty(false)
    setLoading(false)
  }

  function setMark(studentId, examType, component, value, max) {
    // allow empty, else clamp 0..max
    let v = value.replace(/[^\d.]/g, '')
    if (v !== '') {
      let n = parseFloat(v)
      if (isNaN(n)) v = ''
      else { if (n > max) n = max; if (n < 0) n = 0; v = String(n) }
    }
    setMarks(prev => ({ ...prev, [keyOf(studentId, examType, component)]: v }))
    setDirty(true)
  }

  function getMark(studentId, examType, component) {
    return marks[keyOf(studentId, examType, component)] ?? ''
  }

  function latTotal(studentId) {
    return LAT_MONTHS.reduce((sum, m) => {
      const v = parseFloat(getMark(studentId, 'lat', m))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
  }

  function formativeTotal(studentId) {
    return formativeComponents.reduce((sum, c) => {
      const v = parseFloat(getMark(studentId, 'formative', c.key))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
  }

  function halfyearlyTotal(studentId) {
    return halfyearlyComponents.reduce((sum, c) => {
      const v = parseFloat(getMark(studentId, 'halfyearly', c.key))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
  }

  const formativeMaxTotal = formativeComponents.reduce((s, c) => s + c.max, 0)
  const latMaxTotal = LAT_MONTHS.length * LAT_MAX

  async function save() {
    setSaving(true)
    const t = toast.loading('Saving marks…')

    // Build the rows to insert — only cells that have a value.
    const rows = []
    for (const s of students) {
      for (const m of LAT_MONTHS) {
        const raw = getMark(s.id, 'lat', m)
        if (raw !== '') {
          rows.push({
            student_id: s.id, class_name: studentClass, subject, school_year: currentSchoolYear,
            exam_type: 'lat', component: m, score: parseFloat(raw), updated_by: editorName,
          })
        }
      }
      for (const c of formativeComponents) {
        const raw = getMark(s.id, 'formative', c.key)
        if (raw !== '') {
          rows.push({
            student_id: s.id, class_name: studentClass, subject, school_year: currentSchoolYear,
            exam_type: 'formative', component: c.key, score: parseFloat(raw), updated_by: editorName,
          })
        }
      }
      for (const c of halfyearlyComponents) {
        const raw = getMark(s.id, 'halfyearly', c.key)
        if (raw !== '') {
          rows.push({
            student_id: s.id, class_name: studentClass, subject, school_year: currentSchoolYear,
            exam_type: 'halfyearly', component: c.key, score: parseFloat(raw), updated_by: editorName,
          })
        }
      }
    }

    // DELETE-THEN-INSERT for this class+subject+year.
    // This guarantees any cleared (blanked) cells are removed, since we
    // wipe everything for this sheet first, then insert only filled cells.
    const studentIds = students.map(s => s.id)

    const del = await supabase
      .from('marks')
      .delete()
      .eq('subject', subject)
      .eq('school_year', currentSchoolYear)
      .in('student_id', studentIds)

    let error = del.error

    if (!error && rows.length > 0) {
      const ins = await supabase.from('marks').insert(rows)
      error = ins.error
    }

    if (error) {
      toast.error('Failed: ' + error.message, { id: t })
      setSaving(false)
      return
    }

    toast.success('Marks saved ✓', { id: t, duration: 2500 })
    setDirty(false)
    setSaving(false)
    // Reload from DB so the screen always matches what's actually stored.
    await load()
  }

  function goBack() {
    if (dirty && !window.confirm('You have unsaved marks. Leave without saving?')) return
    if (isVP) navigate('/vp/marks')
    else navigate('/marks', { state: { teacher } })
  }

  if ((!teacher && !isVP) || !className || !subject) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 90 }}>
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 600, borderRadius: 10 } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, button { font-family: inherit; }
        input:focus { outline: none; }
        .mark-in:focus { border-color: #4F46E5 !important; box-shadow: 0 0 0 2px rgba(79,70,229,0.15) !important; }
        @keyframes ms-spin { to { transform: rotate(360deg) } }
        .ms-mobile { display: none; }
        .ms-desktop { display: block; }
        @media (max-width: 700px) {
          .ms-mobile { display: block; }
          .ms-desktop { display: none; }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #E5E5EA; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header style={{ background: '#1C1C1E', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 14px', height: 54, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={goBack}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
              <ArrowLeftIcon /> Back
            </button>
            <div>
              <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 700 }}>{subject}</div>
              <div style={{ color: '#636366', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>Class {className} · {isVP ? 'VP — edit mode' : teacher.name?.trim()}</div>
            </div>
          </div>
          <span style={{ color: '#48484A', fontSize: 10, fontFamily: 'monospace' }}>{schoolYearLabel}</span>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 14px' }}>

        {/* Not in marks structure (Nursery/LKG/UKG) */}
        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 48, textAlign: 'center' }}>
            <div style={{
              width: 30, height: 30, margin: '0 auto 14px',
              border: '3px solid #F2F2F7', borderTopColor: '#4F46E5',
              borderRadius: '50%', animation: 'ms-spin 0.7s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: '#8E8E93', fontWeight: 500 }}>Loading students…</div>
          </div>
        ) : !inStructure ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Marks coming soon for this class</div>
            <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
              The marks structure for Class {className} hasn't been set up yet. It will be added later.
            </div>
          </div>
        ) : students.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>No students in Class {className} yet</div>
            <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
              The class teacher needs to add students first (My Students). Once students are added, they'll appear here for marks entry.
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 14, background: '#EEE', borderRadius: 10, padding: 3 }}>
              {[['lat', 'LAT'], ['formative', 'Formative'], ['halfyearly', 'Half-Yearly']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{
                    flex: 1, padding: '9px', border: 'none', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    background: tab === key ? '#1C1C1E' : 'transparent',
                    color: tab === key ? '#fff' : '#636366',
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Columns for the current tab */}
            {(() => {
              const cols = tab === 'lat'
                ? LAT_MONTHS.map(m => ({ key: m, label: m, max: LAT_MAX, examType: 'lat' }))
                : tab === 'halfyearly'
                  ? halfyearlyComponents.map(c => ({ key: c.key, label: c.label, max: c.max, examType: 'halfyearly' }))
                  : formativeComponents.map(c => ({ key: c.key, label: c.label, max: c.max, examType: 'formative' }))
              const maxTotal = tab === 'lat' ? latMaxTotal
                : tab === 'halfyearly' ? halfyearlyComponents.reduce((s, c) => s + c.max, 0)
                  : formativeMaxTotal
              const totalOf = tab === 'lat' ? latTotal
                : tab === 'halfyearly' ? halfyearlyTotal
                  : formativeTotal
              const title = tab === 'lat' ? `LAT — ${LAT_MAX} marks/month`
                : tab === 'halfyearly' ? 'Half-Yearly Exam'
                  : 'Formative Assessment'

              return (
                <>
                  {/* ── MOBILE: one card per student ── */}
                  <div className="ms-mobile">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px 10px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{title}</div>
                      <div style={{ fontSize: 11, color: '#8E8E93' }}>
                        Total /{maxTotal}{tab === 'lat' ? ` · ≤${LAT_RED_AT} red` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {students.map(s => {
                        const total = totalOf(s.id)
                        return (
                          <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            {/* Student header row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#4F46E5', flexShrink: 0 }}>
                                {s.roll_number}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{s.name}</div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span style={{ fontSize: 15, fontWeight: 800, color: '#1C1C1E' }}>{total}</span>
                                <span style={{ fontSize: 10, color: '#C7C7CC' }}>/{maxTotal}</span>
                              </div>
                            </div>

                            {/* Mark inputs — all visible, no scrolling */}
                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, 1fr)`, gap: 8 }}>
                              {cols.map(col => {
                                const val = getMark(s.id, col.examType, col.key)
                                const num = parseFloat(val)
                                const isRed = col.examType === 'lat' && val !== '' && !isNaN(num) && num <= LAT_RED_AT
                                return (
                                  <div key={col.key}>
                                    <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {col.label}
                                    </label>
                                    <input className="mark-in" inputMode="decimal" value={val}
                                      onChange={e => setMark(s.id, col.examType, col.key, e.target.value, col.max)}
                                      placeholder="–"
                                      style={{
                                        width: '100%', padding: '12px 4px', textAlign: 'center', borderRadius: 10,
                                        border: `1.5px solid ${isRed ? '#FCA5A5' : val !== '' ? '#C7C7CC' : '#E5E5EA'}`,
                                        background: isRed ? '#FEF2F2' : '#FAFAFA',
                                        color: isRed ? '#DC2626' : '#1C1C1E',
                                        fontWeight: 700, fontSize: 17,
                                      }} />
                                    <div style={{ fontSize: 9, color: '#C7C7CC', textAlign: 'center', marginTop: 3 }}>/{col.max}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── DESKTOP: table ── */}
                  <div className="ms-desktop" style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{title}</div>
                      <div style={{ fontSize: 11, color: '#8E8E93' }}>
                        Total /{maxTotal}{tab === 'lat' ? ` · ≤${LAT_RED_AT} shown red` : ''}
                      </div>
                    </div>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                        <thead>
                          <tr style={{ background: '#FAFAFA' }}>
                            <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#636366', minWidth: 160 }}>Student</th>
                            {cols.map(col => (
                              <th key={col.key} style={{ padding: '9px 6px', fontSize: 11, fontWeight: 700, color: '#636366', textAlign: 'center', minWidth: 78 }}>
                                {col.label}<div style={{ fontSize: 9, color: '#C7C7CC', fontWeight: 600 }}>/{col.max}</div>
                              </th>
                            ))}
                            <th style={{ padding: '9px 10px', fontSize: 11, fontWeight: 700, color: '#1C1C1E', textAlign: 'center', minWidth: 64 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s, idx) => (
                            <tr key={s.id} style={{ borderTop: '1px solid #F3F4F6', background: idx % 2 ? '#FAFAFA' : '#fff' }}>
                              <td style={{ padding: '8px 12px', minWidth: 160 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1C1E' }}>{s.name}</div>
                                <div style={{ fontSize: 10, color: '#8E8E93' }}>Roll {s.roll_number}</div>
                              </td>
                              {cols.map(col => {
                                const val = getMark(s.id, col.examType, col.key)
                                const num = parseFloat(val)
                                const isRed = col.examType === 'lat' && val !== '' && !isNaN(num) && num <= LAT_RED_AT
                                return (
                                  <td key={col.key} style={{ padding: '6px', textAlign: 'center' }}>
                                    <input className="mark-in" inputMode="decimal" value={val}
                                      onChange={e => setMark(s.id, col.examType, col.key, e.target.value, col.max)}
                                      placeholder="–"
                                      style={{
                                        width: 58, padding: '8px 4px', textAlign: 'center', borderRadius: 7,
                                        border: `1px solid ${isRed ? '#FCA5A5' : '#E5E5EA'}`,
                                        background: isRed ? '#FEF2F2' : '#fff',
                                        color: isRed ? '#DC2626' : '#1C1C1E',
                                        fontWeight: isRed ? 700 : 500, fontSize: 14,
                                      }} />
                                  </td>
                                )
                              })}
                              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: '#1C1C1E' }}>{totalOf(s.id)}</span>
                                <span style={{ fontSize: 10, color: '#C7C7CC' }}>/{maxTotal}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )
            })()}

            <div style={{ marginTop: 12, fontSize: 11, color: '#C7C7CC', textAlign: 'center' }}>
              {students.length} student{students.length !== 1 ? 's' : ''} · marks auto-total · empty cells are left blank
            </div>
          </>
        )}
      </div>

      {/* Floating Save */}
      {!loading && inStructure && students.length > 0 && (
        <button onClick={save} disabled={saving}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 60,
            display: 'flex', alignItems: 'center', gap: 8,
            background: dirty ? '#4F46E5' : '#1C1C1E', color: '#fff', border: 'none',
            padding: '14px 22px', borderRadius: 30, fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
          <SaveIcon /> {saving ? 'Saving…' : dirty ? 'Save Marks' : 'Saved'}
        </button>
      )}
    </div>
  )
}