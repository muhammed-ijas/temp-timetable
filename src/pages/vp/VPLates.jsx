import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import VPHeader from '../../components/VPHeader'

const today = () => new Date().toISOString().split('T')[0]

// ── Search Icon ──
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const ChevronDown = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

// ── Avatar ──
function Avatar({ name, size = 30, dark = false }) {
  const initials = name.trim().split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: dark ? '#3B0764' : '#F5F3FF', color: dark ? '#fff' : '#5B21B6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

// ── Highlight ──
function HighlightText({ text, query }) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ fontWeight: 700, background: '#EDE9FE', borderRadius: 3, padding: '0 2px', color: '#5B21B6' }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Teacher Picker ──
function TeacherPicker({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const containerRef = useRef(null)

  const filtered = TEACHERS.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    if (listRef.current && open) {
      listRef.current.children[highlighted]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted, open])

  function handleSelect(teacher) { onChange(teacher.name); setQuery(''); setOpen(false) }
  function handleClear(e) { e.stopPropagation(); onChange(''); setQuery(''); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }
  function handleInputClick() { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }

  function handleKeyDown(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) handleSelect(filtered[highlighted]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div onClick={handleInputClick} style={{ display: 'flex', alignItems: 'center', gap: 10, background: open ? '#fff' : '#FAFAFA', border: `2px solid ${open ? '#3B0764' : '#E5E7EB'}`, borderRadius: open ? '10px 10px 0 0' : 10, padding: '10px 12px', cursor: 'text', transition: 'all 0.15s' }}>
        {value && !open
          ? <Avatar name={value} size={28} dark />
          : <div style={{ color: '#9CA3AF', flexShrink: 0, display: 'flex' }}><SearchIcon /></div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          {value && !open ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Tap to change</div>
            </div>
          ) : (
            <input ref={inputRef} value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onKeyDown={handleKeyDown} onFocus={() => setOpen(true)}
              placeholder={value || 'Search teacher name...'}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#111827', width: '100%', fontFamily: 'inherit' }} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {value && (
            <button onClick={handleClear} style={{ width: 20, height: 20, borderRadius: '50%', background: '#F3F4F6', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XIcon />
            </button>
          )}
          <div style={{ color: '#9CA3AF', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex' }}><ChevronDown /></div>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: '#fff', border: '2px solid #3B0764', borderTop: '1px solid #EDE9FE', borderRadius: '0 0 10px 10px', boxShadow: '0 16px 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <div style={{ padding: '5px 12px', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>
              {query ? (filtered.length === 0 ? 'No results' : `${filtered.length} match${filtered.length !== 1 ? 'es' : ''}`) : `${TEACHERS.length} teachers`}
            </span>
            <span style={{ fontSize: 10, color: '#C7C7CC' }}>↑↓ navigate · Enter select</span>
          </div>
          <div ref={listRef} style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>No teacher named "{query}"</div>
            ) : filtered.map((teacher, idx) => {
              const isHighlighted = idx === highlighted
              const isSelected = value === teacher.name
              return (
                <div key={teacher.name}
                  onMouseEnter={() => setHighlighted(idx)}
                  onMouseDown={e => { e.preventDefault(); handleSelect(teacher) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: isHighlighted ? '#F5F3FF' : '#fff', cursor: 'pointer', borderBottom: idx < filtered.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                  <Avatar name={teacher.name} size={32} dark={isSelected} />
                  <div style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: isSelected ? 700 : 500 }}>
                    <HighlightText text={teacher.name} query={query} />
                  </div>
                  {isSelected && <div style={{ color: '#5B21B6' }}><CheckIcon /></div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function VPLates() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [lateMarksAll, setLateMarksAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [lateTeacher, setLateTeacher] = useState('')
  const [lateDate, setLateDate] = useState(today())
  const [markingLate, setMarkingLate] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
    fetchLates()
  }, [])

  async function fetchLates() {
    setLoading(true)
    const { data } = await supabase.from('late_marks').select('*')
      .eq('school_year', currentSchoolYear)
      .order('date', { ascending: false })
    setLateMarksAll(data || [])
    setLoading(false)
  }

  async function markLate() {
    if (!lateTeacher || !lateDate) return alert('Select teacher and date.')
    const exists = lateMarksAll.find(l => l.teacher_name === lateTeacher && l.date === lateDate && !l.cancelled)
    if (exists) return alert('This teacher already has a late mark on this date.')
    setMarkingLate(true)
    const { data: inserted, error } = await supabase.from('late_marks').insert({
      teacher_name: lateTeacher, date: lateDate, school_year: currentSchoolYear,
    }).select().single()
    if (error || !inserted) { setMarkingLate(false); return alert('Failed to mark late.') }
    const lateMonth = lateDate.slice(0, 7)
    const { data: activeLates } = await supabase.from('late_marks').select('*')
      .eq('teacher_name', lateTeacher).eq('school_year', currentSchoolYear)
      .eq('converted', false).eq('cancelled', false)
      .gte('date', `${lateMonth}-01`).lte('date', `${lateMonth}-31`)
    let clTriggered = false
    if (activeLates && activeLates.length % 2 === 0 && activeLates.length >= 2) {
      const toConvert = activeLates.slice(-2)
      const { data: clReq } = await supabase.from('leave_requests').insert({
        teacher_name: lateTeacher, leave_type: 'CL', from_date: lateDate, to_date: lateDate,
        days_count: 1, reason: `Auto: 2 late marks in ${lateMonth} → 1 CL deduction`,
        status: 'pending', exceeded: false, lwp_days: 0, vp_status: 'approved',
        is_auto_generated: true, school_year: currentSchoolYear,
      }).select().single()
      await supabase.from('late_marks').update({ converted: true, conversion_request_id: clReq?.id })
        .in('id', toConvert.map(l => l.id))
      clTriggered = true
    }
    setMarkingLate(false)
    setLateTeacher('')
    setLateDate(today())
    await fetchLates()
    alert(`Late mark added for ${lateTeacher}${clTriggered ? '\n\n2 lates this month — 1 CL deduction request sent to HR.' : ''}`)
  }

  async function cancelLate(lm) {
    if (!window.confirm(`Cancel late mark for ${lm.teacher_name} on ${lm.date}?`)) return
    await supabase.from('late_marks').update({ cancelled: true }).eq('id', lm.id)
    if (lm.converted && lm.conversion_request_id) {
      await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', lm.conversion_request_id)
      await supabase.from('late_marks').update({ converted: false, conversion_request_id: null }).eq('conversion_request_id', lm.conversion_request_id)
    }
    await fetchLates()
  }

  const tLates = lateTeacher ? lateMarksAll.filter(l => l.teacher_name === lateTeacher && !l.cancelled && !l.converted) : []

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, button { font-family: inherit; }
        @media(max-width:640px){ .lates-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <VPHeader title="Late Marks" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate('/vp')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e003e', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
        </div>

        <div className="lates-grid" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 14 }}>

          {/* ── Form ── */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>

            {/* Form header */}
            <div style={{ background: 'linear-gradient(135deg, #1e003e 0%, #3B0764 100%)', padding: '16px 18px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 }}>VP Action</div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Mark Late Arrival</div>
            </div>

            <div style={{ padding: 18 }}>
              {/* Teacher picker */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Teacher</label>
                <TeacherPicker value={lateTeacher} onChange={setLateTeacher} />
              </div>

              {/* Date */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Date</label>
                <input type="date" value={lateDate} onChange={e => setLateDate(e.target.value)} max={today()}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #E5E7EB', fontSize: 13, background: '#FAFAFA', color: '#111827', outline: 'none' }} />
              </div>

              {/* Active lates warning */}
              {tLates.length > 0 && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 2 }}>
                    {tLates.length} active late{tLates.length > 1 ? 's' : ''} on record
                  </div>
                  <div style={{ fontSize: 11, color: '#B45309' }}>
                    {tLates.length === 1 ? 'One more will trigger a CL deduction.' : `Every 2 lates = 1 CL deducted.`}
                  </div>
                </div>
              )}

              {/* Submit */}
              <button onClick={markLate} disabled={markingLate || !lateTeacher}
                style={{ width: '100%', background: markingLate || !lateTeacher ? '#E5E7EB' : 'linear-gradient(135deg, #1e003e 0%, #3B0764 100%)', color: markingLate || !lateTeacher ? '#9CA3AF' : '#fff', border: 'none', padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: markingLate || !lateTeacher ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                {markingLate ? 'Marking...' : 'Mark as Late'}
              </button>

              {/* Rule note */}
              <div style={{ marginTop: 12, background: '#F5F3FF', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#5B21B6', lineHeight: 1.6 }}>
                Every 2 late marks in the same month = 1 CL deduction automatically sent to HR.
              </div>
            </div>
          </div>

          {/* ── List ── */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>All Late Marks</div>
              <span style={{ fontSize: 11, color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 8 }}>AY {schoolYearLabel}</span>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
              ) : lateMarksAll.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No late marks this year.</div>
              ) : lateMarksAll.map(lm => (
                <div key={lm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #F9FAFB', background: lm.cancelled ? '#FAFAFA' : '#fff', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {lateTeacher !== lm.teacher_name && (
                      <Avatar name={lm.teacher_name} size={32} />
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: lm.cancelled ? '#9CA3AF' : '#111827', textDecoration: lm.cancelled ? 'line-through' : 'none' }}>{lm.teacher_name}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>
                        {new Date(lm.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {lm.cancelled && <span style={{ fontSize: 11, background: '#F3F4F6', color: '#6B7280', padding: '3px 8px', borderRadius: 4 }}>Cancelled</span>}
                    {lm.converted && !lm.cancelled && <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>CL Deducted</span>}
                    {!lm.converted && !lm.cancelled && (
                      <>
                        <span style={{ fontSize: 11, background: '#FFF7ED', color: '#9A3412', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>Active</span>
                        <button onClick={() => cancelLate(lm)}
                          style={{ fontSize: 11, background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 500 }}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}