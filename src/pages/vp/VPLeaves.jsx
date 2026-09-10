import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import VPHeader from '../../components/VPHeader'

const today = () => new Date().toISOString().split('T')[0]

function Badge({ vpStatus }) {
  if (vpStatus === 'approved') return <span style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>VP Approved</span>
  if (vpStatus === 'rejected') return <span style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>VP Rejected</span>
  return <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Awaiting VP</span>
}

function openWhatsApp(phone, teacherName, leaveType, fromDate, toDate, days, action) {
  const msg = `Hi ${teacherName},\n\nYour ${leaveType === 'ML' ? 'Medical Leave' : leaveType === 'SL' ? 'Special Leave' : 'Casual Leave'} request from ${fromDate} to ${toDate} (${days} day${days > 1 ? 's' : ''}) has been *${action === 'approved' ? 'Approved by VP ✓' : 'Rejected by VP ✗'}*.\n\n— PGS Management`
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
}

export default function VPLeaves() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
    fetchRequests()
  }, [])

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase.from('leave_requests').select('*')
      .eq('school_year', currentSchoolYear)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  async function handleVPAction(req, action) {
    await supabase.from('leave_requests')
      .update({ vp_status: action, vp_reviewed_at: new Date().toISOString() })
      .eq('id', req.id)
    setRequests(p => p.map(r => r.id === req.id ? { ...r, vp_status: action } : r))
  }

  function getPhone(name) { return TEACHERS.find(t => t.name === name)?.phone || '' }

  const filtered = filter === 'pending'
    ? requests.filter(r => r.vp_status === 'pending' && r.status === 'pending')
    : filter === 'approved' ? requests.filter(r => r.vp_status === 'approved')
    : filter === 'rejected' ? requests.filter(r => r.vp_status === 'rejected')
    : requests

  const pendingCount = requests.filter(r => r.vp_status === 'pending' && r.status === 'pending').length

  const FILTERS = [
    { key: 'pending', label: 'Awaiting Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <VPHeader title="Leave Requests" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => navigate('/vp')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e003e', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            {pendingCount > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{pendingCount} pending</span>}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1.5px solid ${filter === f.key ? '#3B0764' : '#E5E7EB'}`, background: filter === f.key ? '#3B0764' : '#fff', color: filter === f.key ? '#fff' : '#374151', cursor: 'pointer' }}>
              {f.label}
            </button>
          ))}
          <button onClick={fetchRequests} style={{ padding: '6px 10px', borderRadius: 20, border: '1.5px solid #E5E7EB', background: '#fff', color: '#6B7280', fontSize: 13, cursor: 'pointer' }}>↻</button>
        </div>

        {loading ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No requests found.</div>
        ) : filtered.map(req => {
          const phone = getPhone(req.teacher_name)
          const alreadyActioned = req.vp_status !== 'pending'
          return (
            <div key={req.id} style={{ background: '#fff', border: `1px solid ${req.vp_status === 'pending' ? '#DDD6FE' : '#E5E7EB'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{req.teacher_name}</span>
                    <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 7px', borderRadius: 3, fontWeight: 600 }}>
                      {req.leave_type === 'ML' ? 'Medical' : req.leave_type === 'SL' ? 'Special' : req.is_auto_generated ? 'Late→CL' : 'Casual'}
                    </span>
                    <Badge vpStatus={req.vp_status} />
                    {req.is_auto_generated && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>Auto</span>}
                    {req.lwp_days > 0 && <span style={{ fontSize: 10, background: '#FEF2F2', color: '#991B1B', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>LWP: {req.lwp_days}d</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
                    {req.from_date} → {req.to_date}
                    <span style={{ marginLeft: 8, background: '#F3F4F6', color: '#374151', fontSize: 11, padding: '1px 6px', borderRadius: 3 }}>{req.days_count}d</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>{req.reason}</div>
                  {req.document_url
                    ? <a href={req.document_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1D4ED8', textDecoration: 'underline' }}>View Document</a>
                    : req.leave_type === 'ML' && <span style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7', padding: '2px 6px', borderRadius: 3 }}>No document yet</span>
                  }
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  {!alreadyActioned && !req.is_auto_generated && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleVPAction(req, 'approved')}
                        style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => handleVPAction(req, 'rejected')}
                        style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                  {req.is_auto_generated && req.vp_status === 'approved' && (
                    <span style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>Sent to HR</span>
                  )}
                  {alreadyActioned && phone && (
                    <button onClick={() => openWhatsApp(phone, req.teacher_name, req.leave_type, req.from_date, req.to_date, req.days_count, req.vp_status)}
                      style={{ background: '#25D366', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </button>
                  )}
                  <div style={{ fontSize: 10, color: '#9CA3AF' }}>{new Date(req.created_at).toLocaleDateString('en-IN')}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}