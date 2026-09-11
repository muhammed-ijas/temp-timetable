import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import VPHeader from '../../components/VPHeader'

const NAV_ITEMS = [
  { path: '/vp/timetable', label: 'Timetable', desc: 'Build and manage class timetables', color: '#FFF1F2', iconColor: '#BE123C' },
  { path: '/vp/subjects',  label: 'Subjects',  desc: 'Subjects per class and teacher assignments', color: '#F0FDFA', iconColor: '#0F766E' },
]

export default function VPHome() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
    supabase.from('leave_requests').select('id', { count: 'exact' })
      .eq('school_year', currentSchoolYear)
      .eq('vp_status', 'pending')
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count || 0))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } .vp-card { transition: transform 0.14s ease, box-shadow 0.14s ease; cursor: pointer; } .vp-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; } .vp-card:active { transform: scale(0.97); }`}</style>

      <VPHeader
        title="Principal Dashboard"
        rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>}
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {/* Welcome card */}
        <div style={{ background: 'linear-gradient(135deg, #1e003e 0%, #3B0764 100%)', borderRadius: 16, padding: '20px 20px', marginBottom: 20 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 }}>Welcome</div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>Principal Dashboard</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>AY {schoolYearLabel}</div>
          {pendingCount > 0 && (
            <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
              <span style={{ color: '#FCA5A5', fontSize: 12, fontWeight: 600 }}>{pendingCount} leave request{pendingCount !== 1 ? 's' : ''} awaiting review</span>
            </div>
          )}
        </div>

        {/* Nav grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {NAV_ITEMS.map(item => (
            <div key={item.path} className="vp-card"
              onClick={() => navigate(item.path)}
              style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: item.color, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 18, height: 18, borderRadius: 3, background: item.iconColor, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>{item.desc}</div>
              {item.path === '/vp/leaves' && pendingCount > 0 && (
                <div style={{ position: 'absolute', top: 14, right: 14, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{pendingCount}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}