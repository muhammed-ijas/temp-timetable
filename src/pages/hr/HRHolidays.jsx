import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, ADMIN_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import HRHeader from '../../components/HRHeader'

export default function HRHolidays() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [addingHoliday, setAddingHoliday] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_admin') !== ADMIN_PASSWORD) { navigate('/'); return }
    fetchHolidays()
  }, [])

  async function fetchHolidays() {
    setLoading(true)
    const { data } = await supabase.from('holidays').select('*')
      .eq('school_year', currentSchoolYear).order('date', { ascending: true })
    setHolidays(data || [])
    setLoading(false)
  }

  async function addHoliday() {
    if (!holidayDate || !holidayName.trim()) return alert('Enter date and holiday name.')
    setAddingHoliday(true)
    await supabase.from('holidays').upsert({
      date: holidayDate, name: holidayName.trim(),
      school_year: currentSchoolYear, created_by: 'hr'
    }, { onConflict: 'date,school_year' })
    setHolidayDate(''); setHolidayName('')
    setAddingHoliday(false)
    await fetchHolidays()
  }

  async function deleteHoliday(id) {
    if (!window.confirm('Remove this holiday?')) return
    await supabase.from('holidays').delete().eq('id', id)
    await fetchHolidays()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @media(max-width:640px){.hol-grid{grid-template-columns:1fr !important;}}`}</style>

      <HRHeader title="Holidays" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
        </div>

        <div className="hol-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 16 }}>Add Holiday</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Date</label>
              <input type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>Holiday Name</label>
              <input type="text" value={holidayName} onChange={e => setHolidayName(e.target.value)}
                placeholder="e.g. Eid ul-Fitr, Diwali..."
                onKeyDown={e => e.key === 'Enter' && addHoliday()}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
            </div>
            <button onClick={addHoliday} disabled={addingHoliday || !holidayDate || !holidayName.trim()}
              style={{ width: '100%', background: '#111827', color: '#fff', border: 'none', padding: '10px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: addingHoliday || !holidayDate || !holidayName.trim() ? 0.6 : 1 }}>
              {addingHoliday ? 'Adding...' : 'Add Holiday'}
            </button>
            <div style={{ marginTop: 12, fontSize: 11, color: '#6B7280', lineHeight: 1.6 }}>
              Holidays are automatically excluded from leave day calculations.
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 13, fontWeight: 600, color: '#111827' }}>
              Holidays — AY {schoolYearLabel} ({holidays.length} total)
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
              ) : holidays.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No holidays added yet.</div>
              ) : holidays.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F9FAFB' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <button onClick={() => deleteHoliday(h.id)}
                    style={{ fontSize: 11, background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}   