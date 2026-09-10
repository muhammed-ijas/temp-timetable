import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, ADMIN_PASSWORD, ML_LIMIT, CL_LIMIT, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import HRHeader from '../../components/HRHeader'
import TeacherHistoryPanel from '../../components/TeacherHistoryPanel'

export default function HRTeachers() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [balances, setBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeacher, setSelectedTeacher] = useState(null)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_admin') !== ADMIN_PASSWORD) { navigate('/'); return }
    fetchBalances()
  }, [])

  async function fetchBalances() {
    setLoading(true)
    const { data } = await supabase.from('leave_balances').select('*').eq('school_year', currentSchoolYear)
    const balMap = {}
    ;(data || []).forEach(b => { balMap[b.teacher_name] = b })
    setBalances(TEACHERS.map(t => balMap[t.name] || { teacher_name: t.name, ml_used: 0, cl_used: 0, ml_limit: ML_LIMIT, cl_limit: CL_LIMIT, id: null }))
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } @media(max-width:768px){.th-grid{grid-template-columns:1fr !important;}}`}</style>

      <HRHeader title="Teacher History" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
        </div>

        <div className="th-grid" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' }}>
              All Teachers
            </div>
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
              ) : TEACHERS.map(t => {
                const bal = balances.find(b => b.teacher_name === t.name)
                const isSelected = selectedTeacher?.name === t.name
                return (
                  <button key={t.name} onClick={() => setSelectedTeacher(t)}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', borderBottom: '1px solid #F9FAFB', background: isSelected ? '#111827' : 'transparent', cursor: 'pointer', display: 'block' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#F9FAFB' : '#111827', marginBottom: 2 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: isSelected ? '#9CA3AF' : '#6B7280' }}>
                      ML: {bal?.ml_used ?? 0}/{bal?.ml_limit ?? ML_LIMIT} · CL: {bal?.cl_used ?? 0}/{bal?.cl_limit ?? CL_LIMIT}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <TeacherHistoryPanel selectedTeacher={selectedTeacher} onClose={() => setSelectedTeacher(null)} />
        </div>
      </div>
    </div>
  )
}