import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, ADMIN_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import HRHeader from '../../components/HRHeader'

const NAV_ITEMS = [
  { path: '/admin/leaves', label: 'Leave Requests', desc: 'Approve or reject leave after VP review', color: '#EFF6FF', iconColor: '#1D4ED8' },
  { path: '/admin/holidays', label: 'Holidays', desc: 'Add and manage school holidays', color: '#FEF3C7', iconColor: '#92400E' },
  { path: '/admin/special', label: 'Special Leave', desc: 'Grant special leave to teachers', color: '#F5F3FF', iconColor: '#5B21B6' },
  { path: '/admin/teachers', label: 'Teacher History', desc: 'View full leave history per teacher', color: '#F0FDF4', iconColor: '#047857' },
  { path: '/admin/balances', label: 'Leave Balances', desc: 'View and edit teacher leave balances', color: '#FFF1F2', iconColor: '#BE123C' },
]

export default function HRHome() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [counts, setCounts] = useState({ pending: 0, exceeded: 0 })

  useEffect(() => {
    if (sessionStorage.getItem('pgs_admin') !== ADMIN_PASSWORD) { navigate('/'); return }
    supabase.from('leave_requests').select('*')
      .eq('school_year', currentSchoolYear)
      .eq('status', 'pending')
      .eq('vp_status', 'approved')
      .then(({ data }) => {
        const reqs = data || []
        setCounts({
          pending: reqs.length,
          exceeded: reqs.filter(r => r.exceeded).length,
        })
      })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; } .hr-card { transition: transform 0.14s ease, box-shadow 0.14s ease; cursor: pointer; } .hr-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; } .hr-card:active { transform: scale(0.97); }`}</style>

      <HRHeader
        title="HR Dashboard"
        rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>}
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {/* Welcome card */}
        <div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 100%)', borderRadius: 16, padding: '20px', marginBottom: 20 }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 }}>Welcome</div>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 4 }}>HR Dashboard</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>AY {schoolYearLabel}</div>
          {counts.pending > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '6px 12px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6' }} />
                <span style={{ color: '#93C5FD', fontSize: 12, fontWeight: 600 }}>{counts.pending} awaiting HR approval</span>
              </div>
              {counts.exceeded > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 12px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
                  <span style={{ color: '#FCA5A5', fontSize: 12, fontWeight: 600 }}>{counts.exceeded} limit exceeded</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {NAV_ITEMS.map(item => (
            <div key={item.path} className="hr-card"
              onClick={() => navigate(item.path)}
              style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '18px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: item.color, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 18, height: 18, borderRadius: 3, background: item.iconColor, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.4 }}>{item.desc}</div>
              {item.path === '/admin/leaves' && counts.pending > 0 && (
                <div style={{ position: 'absolute', top: 14, right: 14, background: '#3B82F6', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{counts.pending}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}