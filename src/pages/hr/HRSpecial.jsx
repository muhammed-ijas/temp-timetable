import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, ADMIN_PASSWORD, ML_LIMIT, CL_LIMIT, getSchoolYear, getSchoolYearLabel, countLeaveDays, fetchHolidayDates } from '../../lib/supabase'
import HRHeader from '../../components/HRHeader'

const today = () => new Date().toISOString().split('T')[0]

export default function HRSpecial() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [balances, setBalances] = useState([])
  const [holidays, setHolidays] = useState([])
  const [specialList, setSpecialList] = useState([])
  const [loading, setLoading] = useState(true)
  const [slTeacher, setSlTeacher] = useState('')
  const [slFrom, setSlFrom] = useState(today())
  const [slTo, setSlTo] = useState(today())
  const [slReason, setSlReason] = useState('')
  const [grantingSl, setGrantingSl] = useState(false)
  const [slSuccess, setSlSuccess] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_admin') !== ADMIN_PASSWORD) { navigate('/'); return }
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: bals }, { data: hols }, { data: sl }] = await Promise.all([
      supabase.from('leave_balances').select('*').eq('school_year', currentSchoolYear),
      supabase.from('holidays').select('*').eq('school_year', currentSchoolYear),
      supabase.from('special_leaves').select('*').eq('school_year', currentSchoolYear).order('created_at', { ascending: false }),
    ])
    const balMap = {}
    ;(bals || []).forEach(b => { balMap[b.teacher_name] = b })
    setBalances(TEACHERS.map(t => balMap[t.name] || { teacher_name: t.name, sl_granted: 0, id: null }))
    setHolidays(hols || [])
    setSpecialList(sl || [])
    setLoading(false)
  }

  const slDays = countLeaveDays(slFrom, slTo, holidays.map(h => h.date))

  async function grantSL() {
    if (!slTeacher || !slReason.trim()) return alert('Select teacher and enter reason.')
    setGrantingSl(true)
    const holidayDates = await fetchHolidayDates(currentSchoolYear)
    const days = countLeaveDays(slFrom, slTo, holidayDates)
    await supabase.from('special_leaves').insert({
      teacher_name: slTeacher, from_date: slFrom, to_date: slTo,
      days_count: days, reason: slReason, granted_by: 'hr', school_year: currentSchoolYear,
    })
    const bal = balances.find(b => b.teacher_name === slTeacher)
    if (bal?.id) {
      await supabase.from('leave_balances').update({ sl_granted: (bal.sl_granted || 0) + days }).eq('id', bal.id)
    } else {
      await supabase.from('leave_balances').insert({
        teacher_name: slTeacher, ml_used: 0, cl_used: 0, sl_granted: days,
        ml_limit: ML_LIMIT, cl_limit: CL_LIMIT, school_year: currentSchoolYear, year: currentSchoolYear,
      })
    }
    const phone = TEACHERS.find(t => t.name === slTeacher)?.phone
    if (phone) {
      const msg = `Hi ${slTeacher},\n\nYou have been granted *${days} day${days > 1 ? 's' : ''} Special Leave* from ${slFrom} to ${slTo}.\n\nReason: ${slReason}\n\n— PGS Management`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    }
    setSlTeacher(''); setSlReason(''); setSlFrom(today()); setSlTo(today())
    setGrantingSl(false); setSlSuccess(true)
    setTimeout(() => setSlSuccess(false), 4000)
    await fetchAll()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @media(max-width:640px){.sl-grid{grid-template-columns:1fr !important;}}`}</style>

      <HRHeader title="Special Leave" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
        </div>

        <div className="sl-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5B21B6', marginBottom: 16 }}>Grant Special Leave</div>
            {slSuccess && (
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '8px 10px', marginBottom: 12, fontSize: 12, color: '#065F46', fontWeight: 500 }}>
                Special leave granted and WhatsApp opened!
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Teacher</label>
              <select value={slTeacher} onChange={e => setSlTeacher(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827', cursor: 'pointer' }}>
                <option value="">— Select teacher —</option>
                {TEACHERS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>From</label>
                <input type="date" value={slFrom} onChange={e => { setSlFrom(e.target.value); if (e.target.value > slTo) setSlTo(e.target.value) }}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>To</label>
                <input type="date" value={slTo} min={slFrom} onChange={e => setSlTo(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
              </div>
            </div>
            <div style={{ background: '#F5F3FF', borderRadius: 6, padding: '6px 10px', marginBottom: 12, fontSize: 12, color: '#5B21B6', fontWeight: 500 }}>
              {slDays} working day{slDays > 1 ? 's' : ''} (Sundays & holidays excluded)
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Reason</label>
              <textarea value={slReason} onChange={e => setSlReason(e.target.value)}
                placeholder="Reason for special leave..." rows={3}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', resize: 'none', color: '#111827' }} />
            </div>
            <button onClick={grantSL} disabled={grantingSl || !slTeacher || !slReason.trim()}
              style={{ width: '100%', background: '#5B21B6', color: '#fff', border: 'none', padding: '10px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: grantingSl || !slTeacher || !slReason.trim() ? 'not-allowed' : 'pointer', opacity: grantingSl || !slTeacher || !slReason.trim() ? 0.6 : 1 }}>
              {grantingSl ? 'Granting...' : `Grant ${slDays}d Special Leave + WhatsApp`}
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Special Leaves Granted — AY {schoolYearLabel}
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
              ) : specialList.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No special leaves granted yet.</div>
              ) : specialList.map(sl => (
                <div key={sl.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F9FAFB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{sl.teacher_name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
                        {sl.from_date} → {sl.to_date}
                        <span style={{ background: '#F5F3FF', color: '#5B21B6', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontWeight: 600, marginLeft: 6 }}>{sl.days_count}d SL</span>
                      </div>
                      {sl.reason && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sl.reason}</div>}
                    </div>
                    <span style={{ fontSize: 10, color: '#7C3AED', whiteSpace: 'nowrap' }}>by {sl.granted_by?.toUpperCase()}</span>
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