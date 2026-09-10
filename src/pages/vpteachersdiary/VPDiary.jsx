import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import VPHeader from '../../components/VPHeader'

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Pre-primary breaks at slot 4, primary at slot 6.
function isPrePrimary(className) {
  const n = (className || '').trim().toLowerCase()
  return n.startsWith('nursery') || n.startsWith('lkg') || n.startsWith('ukg')
}

// Which slot is this teacher's break on this day?
// Only certain when every class they taught is the same section — a teacher
// working both sections teaches at slot 4 AND slot 6, so nothing is marked.
function breakSlotFor(classNames) {
  const list = classNames.filter(Boolean)
  if (list.length === 0) return null
  const pre = list.filter(isPrePrimary).length
  if (pre === list.length) return 4
  if (pre === 0) return 6
  return null
}

function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmtChip(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8px; color: #111;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-end;
    margin-bottom: 7px; padding-bottom: 5px; border-bottom: 2px solid #1C1C1E; }
  .doc-title { font-size: 15px; font-weight: 800; color: #1C1C1E; }
  .doc-meta { font-size: 9px; color: #555; line-height: 1.7; text-align: right; }
  .doc-meta strong { color: #111; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #1C1C1E !important; color: #fff !important; padding: 6px 5px;
    font-size: 7.5px; font-weight: 700; text-align: center; border: 1px solid #333; line-height: 1.3; }
  td { border: 1px solid #C4C4C4; padding: 6px 6px; font-size: 8px; vertical-align: top;
    line-height: 1.4; height: 32px; }
  .period-cell { background: #F5F5F5 !important; text-align: center; font-weight: 800;
    color: #1C1C1E; vertical-align: middle; font-size: 10px; }
  .sig-section { display: flex; justify-content: space-between; align-items: flex-end;
    margin-top: 14px; page-break-inside: avoid; }
  .sig-block { text-align: center; width: 180px; }
  .sig-line { border-top: 1.5px solid #374151; padding-top: 5px; font-size: 8.5px;
    font-weight: 700; color: #374151; letter-spacing: 0.5px; text-transform: uppercase; }
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

const PrintIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
)

export default function VPDiary() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [teacherName, setTeacherName] = useState('')
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  const [pickDate, setPickDate] = useState('')
  const [rows, setRows] = useState([])
  const [loadingDates, setLoadingDates] = useState(false)
  const [loadingDiary, setLoadingDiary] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 700)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) navigate('/')
  }, [])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 700)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!teacherName) { setDates([]); setSelectedDate(''); setRows([]); return }
    fetchDates()
  }, [teacherName])

  useEffect(() => {
    if (!teacherName || !selectedDate) { setRows([]); return }
    fetchDiary()
  }, [selectedDate])

  async function fetchDates() {
    setLoadingDates(true)
    setSelectedDate('')
    setRows([])
    const { data } = await supabase
      .from('teacher_diary')
      .select('date')
      .eq('teacher_name', teacherName)
      .eq('school_year', currentSchoolYear)
      .order('date', { ascending: false })

    const unique = [...new Set((data || []).map(r => r.date))]
    setDates(unique)
    setLoadingDates(false)
    if (unique.length) setSelectedDate(unique[0])
  }

  async function fetchDiary() {
    setLoadingDiary(true)
    const { data } = await supabase
      .from('teacher_diary')
      .select('*')
      .eq('teacher_name', teacherName)
      .eq('date', selectedDate)
      .eq('school_year', currentSchoolYear)
      .order('period_number')

    const breakSlot = breakSlotFor((data || []).map(r => r.class_section))

    const newRows = PERIODS.map(pn => {
      const found = (data || []).find(r => r.period_number === pn)
      return {
        period_number: pn,
        isBreak: pn === breakSlot && !found,
        class_section: found?.class_section || '',
        subject: found?.subject || '',
        topic: found?.topic || '',
        activity_planned: found?.activity_planned || '',
        home_assignment: found?.home_assignment || '',
        total_students: found?.total_students ?? '',
        present_students: found?.present_students ?? '',
      }
    })
    setRows(newRows)
    setLoadingDiary(false)
  }

  function handlePrint() {
    if (!teacherName || !selectedDate) return
    const dateLabel = fmtDate(selectedDate)
    const rowsHTML = rows.map((row) => `
      <tr>
        <td class="period-cell">${row.period_number}</td>
        <td>${row.class_section || ''}</td>
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
    openPrint(html, `Teacher's Diary — ${teacherName} — ${selectedDate}`)
  }

  const hasEntries = rows.some(r =>
    r.class_section || r.subject || r.topic || r.activity_planned || r.home_assignment ||
    r.total_students !== '' || r.present_students !== ''
  )

  const TH = {
    background: '#1C1C1E', color: '#F2F2F7', padding: '11px 10px', fontSize: 11,
    fontWeight: 700, textAlign: 'left', letterSpacing: 0.5, textTransform: 'uppercase',
    borderRight: '1px solid #2C2C2E', whiteSpace: 'nowrap',
  }
  const TD = {
    borderBottom: '1px solid #F3F4F6', borderRight: '1px solid #F3F4F6',
    padding: '11px 12px', verticalAlign: 'top', fontSize: 13, color: '#111827',
    lineHeight: 1.5, whiteSpace: 'pre-wrap',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } select, button { font-family: inherit; } ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-thumb { background: #E5E5EA; border-radius: 4px; }`}</style>

      <VPHeader
        title="Teacher Diaries"
        rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>

        <button onClick={() => navigate('/vp')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#3B0764', border: 'none', color: '#fff', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to VP Dashboard
        </button>

        <div style={{ background: 'linear-gradient(135deg, #1e003e 0%, #3B0764 100%)', borderRadius: 16, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10 }}>
            View a teacher's diary
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Teacher</label>
              <select value={teacherName} onChange={e => setTeacherName(e.target.value)}
                style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
                <option value="" style={{ color: '#111' }}>— Select a teacher —</option>
                {TEACHERS.map(t => (
                  <option key={t.name} value={t.name} style={{ color: '#111' }}>{t.name}</option>
                ))}
              </select>
            </div>
            {teacherName && selectedDate && (
              <button onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#3B0764', border: 'none', padding: '11px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                <PrintIcon /> Print
              </button>
            )}
          </div>
        </div>

        {teacherName && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              {loadingDates ? 'Loading days…' : dates.length ? `${dates.length} filled day${dates.length !== 1 ? 's' : ''}` : 'No diary entries yet'}
            </div>

            {!loadingDates && dates.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Jump to date:</label>
                  <input
                    type="date"
                    value={pickDate}
                    min={dates[dates.length - 1]}
                    max={dates[0]}
                    onChange={e => {
                      const d = e.target.value
                      setPickDate(d)
                      if (dates.includes(d)) setSelectedDate(d)
                      else if (d) alert('No diary was filled on that date. Filled days are shown as chips below.')
                    }}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, color: '#111827', background: '#FAFAFA' }}
                  />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>only filled dates can be opened</span>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Recent days</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                   {dates.slice(0, 7).map(d => {
                    const active = d === selectedDate
                    return (
                      <button key={d} onClick={() => setSelectedDate(d)}
                        style={{
                          padding: '7px 14px', borderRadius: 20,
                          border: `1.5px solid ${active ? '#3B0764' : '#E5E7EB'}`,
                          background: active ? '#3B0764' : '#fff',
                          color: active ? '#fff' : '#374151',
                          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        }}>
                        {fmtChip(d)}
                      </button>
                    )
                  })}
                 {dates.length > 7 && (
                    <span style={{ alignSelf: 'center', fontSize: 12, color: '#9CA3AF' }}>
                      +{dates.length - 7} more — use "Jump to date" above
                    </span>
                  )}
                </div>
              </>
            )}

            {!loadingDates && dates.length === 0 && (
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>This teacher hasn't filled any diary for AY {schoolYearLabel} yet.</div>
            )}
          </div>
        )}

        {teacherName && selectedDate && (
          loadingDiary ? (
            <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 48, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Loading diary…</div>
          ) : (
            <>
              <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '14px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>Teacher's Diary</div>
                  <div style={{ color: '#F2F2F7', fontSize: isMobile ? 15 : 17, fontWeight: 700 }}>{teacherName}</div>
                </div>
                <div style={{ color: '#8E8E93', fontSize: 12, textAlign: 'right' }}>{fmtDate(selectedDate)}</div>
              </div>

              {!hasEntries && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
                  This day was saved but all periods are empty.
                </div>
              )}

              {isMobile ? (
               rows.map(row => {
                  if (row.isBreak) return (
                    <div key={row.period_number} style={{
                      background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12,
                      marginBottom: 12, padding: '14px', textAlign: 'center',
                      color: '#059669', fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
                    }}>
                      Break
                    </div>
                  )
                  const filled = row.class_section || row.subject || row.topic || row.activity_planned || row.home_assignment || row.total_students !== '' || row.present_students !== ''
                  return (
                    <div key={row.period_number} style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, marginBottom: 12, overflow: 'hidden', opacity: filled ? 1 : 0.55 }}>
                      <div style={{ background: '#1C1C1E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#1C1C1E' }}>{row.period_number}</div>
                        <span style={{ color: '#F2F2F7', fontSize: 13, fontWeight: 600 }}>Period {row.period_number}</span>
                      </div>
                      <div style={{ padding: '12px 14px', fontSize: 13, color: '#111827' }}>
                        {[
                          ['Class & Section', row.class_section],
                          ['Subject', row.subject],
                          ['Topic', row.topic],
                          ['Activity Planned', row.activity_planned],
                          ['Home Assignment', row.home_assignment],
                        ].map(([label, val]) => (
                          <div key={label} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>{label}</div>
                            <div style={{ whiteSpace: 'pre-wrap', color: val ? '#111827' : '#C7C7CC' }}>{val || '—'}</div>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                          <div><span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Total </span><b>{row.total_students !== '' ? row.total_students : '—'}</b></div>
                          <div><span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Present </span><b>{row.present_students !== '' ? row.present_students : '—'}</b></div>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 16 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                      <thead>
                        <tr>
                          <th style={{ ...TH, width: 60, textAlign: 'center' }}>Period</th>
                          <th style={{ ...TH, width: 110 }}>Class &amp; Section</th>
                          <th style={{ ...TH, width: 120 }}>Subject</th>
                          <th style={TH}>Topic</th>
                          <th style={TH}>Activity Planned</th>
                          <th style={TH}>Home Assignment</th>
                          <th style={{ ...TH, width: 80, textAlign: 'center' }}>Total</th>
                          <th style={{ ...TH, width: 80, textAlign: 'center', borderRight: 'none' }}>Present</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => row.isBreak ? (
                          <tr key={row.period_number}>
                            <td colSpan={8} style={{
                              borderBottom: '1px solid #F3F4F6', background: '#F0FDF4',
                              textAlign: 'center', padding: '10px', color: '#059669',
                              fontSize: 13, fontWeight: 700, fontStyle: 'italic', letterSpacing: 0.5,
                            }}>
                              Break
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.period_number} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <td style={{ ...TD, background: '#F5F3FF', textAlign: 'center', verticalAlign: 'middle', fontWeight: 800, fontSize: 16, color: '#1C1C1E', borderRight: '1px solid #E5E5EA', width: 60 }}>{row.period_number}</td>
                            <td style={{ ...TD, width: 110 }}>{row.class_section || <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                            <td style={{ ...TD, width: 120 }}>{row.subject || <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                            <td style={TD}>{row.topic || <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                            <td style={TD}>{row.activity_planned || <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                            <td style={TD}>{row.home_assignment || <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                            <td style={{ ...TD, width: 80, textAlign: 'center', verticalAlign: 'middle' }}>{row.total_students !== '' ? row.total_students : <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                            <td style={{ ...TD, width: 80, textAlign: 'center', verticalAlign: 'middle', borderRight: 'none' }}>{row.present_students !== '' ? row.present_students : <span style={{ color: '#C7C7CC' }}>—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA', fontSize: 11, color: '#8E8E93' }}>
                    Read-only view · Pick another day above to view it
                  </div>
                </div>
              )}
            </>
          )
        )}

        {!teacherName && (
          <div style={{ background: '#fff', border: '1px dashed #D1D5DB', borderRadius: 14, padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
            Select a teacher above to view their diaries.
          </div>
        )}
      </div>
    </div>
  )
}