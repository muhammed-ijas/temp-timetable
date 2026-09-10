import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, ADMIN_PASSWORD, ML_LIMIT, CL_LIMIT, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import HRHeader from '../../components/HRHeader'

export default function HRBalances() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingBalance, setEditingBalance] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_admin') !== ADMIN_PASSWORD) { navigate('/'); return }
    fetchBalances()
  }, [])

  async function fetchBalances() {
    setLoading(true)
    const { data } = await supabase.from('leave_balances').select('*').eq('school_year', currentSchoolYear)
    const balMap = {}
    ;(data || []).forEach(b => { balMap[b.teacher_name] = b })
    setBalances(TEACHERS.map(t => balMap[t.name] || {
      teacher_name: t.name, ml_used: 0, cl_used: 0, lwp_count: 0,
      sl_granted: 0, ml_limit: ML_LIMIT, cl_limit: CL_LIMIT,
      school_year: currentSchoolYear, id: null,
    }))
    setLoading(false)
  }

  async function saveBalance() {
    if (!editingBalance) return
    setSaving(true)
    const { id, teacher_name, ml_used, cl_used, ml_limit, cl_limit } = editingBalance
    const payload = {
      ml_used: Number(ml_used), cl_used: Number(cl_used),
      ml_limit: Number(ml_limit), cl_limit: Number(cl_limit),
      school_year: currentSchoolYear, teacher_name,
    }
    if (id) {
      await supabase.from('leave_balances').update(payload).eq('id', id)
    } else {
      await supabase.from('leave_balances').insert(payload)
    }
    setSaving(false)
    setEditingBalance(null)
    await fetchBalances()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @media(max-width:640px){.bal-row{grid-template-columns:1.5fr 1fr 1fr 1fr 1fr 60px !important; font-size:11px !important;}}`}</style>

      <HRHeader title="Leave Balances" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Teacher Leave Balances — AY {schoolYearLabel}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Click Edit to modify</div>
          </div>

          {/* Header row */}
          <div className="bal-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 0, padding: '8px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {['Teacher', 'ML Used', 'ML Limit', 'CL Used', 'CL Limit', 'LWP', 'SL', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
          ) : balances.map(bal => (
            <div key={bal.teacher_name} className="bal-row"
              style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr 80px', gap: 0, padding: '10px 16px', borderBottom: '1px solid #F9FAFB', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{bal.teacher_name}</div>
              <div style={{ fontSize: 13, color: bal.ml_used >= (bal.ml_limit || ML_LIMIT) ? '#991B1B' : '#374151', fontWeight: bal.ml_used >= (bal.ml_limit || ML_LIMIT) ? 700 : 400 }}>{bal.ml_used}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{bal.ml_limit || ML_LIMIT}</div>
              <div style={{ fontSize: 13, color: bal.cl_used >= (bal.cl_limit || CL_LIMIT) ? '#991B1B' : '#374151', fontWeight: bal.cl_used >= (bal.cl_limit || CL_LIMIT) ? 700 : 400 }}>{bal.cl_used}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{bal.cl_limit || CL_LIMIT}</div>
              <div style={{ fontSize: 13, color: bal.lwp_count > 0 ? '#991B1B' : '#374151', fontWeight: bal.lwp_count > 0 ? 700 : 400 }}>{bal.lwp_count ?? 0}</div>
              <div style={{ fontSize: 13, color: bal.sl_granted > 0 ? '#5B21B6' : '#374151', fontWeight: bal.sl_granted > 0 ? 700 : 400 }}>{bal.sl_granted ?? 0}</div>
              <button onClick={() => setEditingBalance({ ...bal, ml_limit: bal.ml_limit || ML_LIMIT, cl_limit: bal.cl_limit || CL_LIMIT })}
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editingBalance && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 22, maxWidth: 400, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Edit Leave Balance</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>{editingBalance.teacher_name} — AY {schoolYearLabel}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[['ml_used', 'ML Used'], ['ml_limit', 'ML Limit'], ['cl_used', 'CL Used'], ['cl_limit', 'CL Limit']].map(([field, label]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 }}>{label}</label>
                  <input type="number" min="0" max="365" value={editingBalance[field]}
                    onChange={e => setEditingBalance(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 14, color: '#111827', background: '#FAFAFA' }} />
                </div>
              ))}
            </div>
            <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 5, padding: '8px 10px', fontSize: 12, color: '#92400E', marginBottom: 14 }}>
              Changing "Used" affects remaining balance. "Limit" sets a custom cap.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditingBalance(null)}
                style={{ flex: 1, background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '9px', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={saveBalance} disabled={saving}
                style={{ flex: 1, background: '#111827', border: 'none', padding: '9px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}