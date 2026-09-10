import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, ADMIN_PASSWORD, ML_LIMIT, CL_LIMIT, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import HRHeader from '../../components/HRHeader'

function Badge({ status, exceeded, vpStatus }) {
  if (vpStatus === 'approved' && status === 'pending') return <span style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>VP Approved</span>
  if (vpStatus === 'pending' && status === 'pending') return <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Awaiting VP</span>
  const map = {
    pending: exceeded ? { label: 'Limit Exceeded', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' } : { label: 'Pending', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
    approved: { label: 'Approved', color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
    rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
    cancelled: { label: 'Cancelled', color: '#4B5563', bg: '#F3F4F6', border: '#D1D5DB' },
  }
  const s = map[status] || map.pending
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{s.label}</span>
}

function openWhatsApp(phone, teacherName, leaveType, fromDate, toDate, days, action) {
  const msg = `Hi ${teacherName},\n\nYour ${leaveType === 'ML' ? 'Medical Leave' : leaveType === 'SL' ? 'Special Leave' : leaveType === 'CL' && action === 'approved' ? 'leave' : 'Casual Leave'} request from ${fromDate} to ${toDate} (${days} day${days > 1 ? 's' : ''}) has been *${action === 'approved' ? 'Approved ✓' : 'Rejected ✗'}* by HR.\n\n— PGS Management`
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
}

export default function HRLeaves() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [actioned, setActioned] = useState({})

  useEffect(() => {
    if (sessionStorage.getItem('pgs_admin') !== ADMIN_PASSWORD) { navigate('/'); return }
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

  async function handleAction(req, action) {
    await supabase.from('leave_requests').update({ status: action }).eq('id', req.id)
    if (action === 'approved') {
      const { data: existingBal } = await supabase.from('leave_balances').select('*')
        .eq('teacher_name', req.teacher_name).eq('school_year', currentSchoolYear).maybeSingle()
      if (req.leave_type === 'CL' || req.leave_type === 'ML') {
        const field = req.leave_type === 'ML' ? 'ml_used' : 'cl_used'
        const balanceDays = req.days_count - (req.lwp_days || 0)
        const lwpDays = req.lwp_days || 0
        if (existingBal) {
          await supabase.from('leave_balances').update({
            [field]: (existingBal[field] || 0) + balanceDays,
            lwp_count: (existingBal.lwp_count || 0) + lwpDays,
          }).eq('id', existingBal.id)
        } else {
          await supabase.from('leave_balances').insert({
            teacher_name: req.teacher_name, [field]: balanceDays,
            lwp_count: lwpDays, ml_limit: ML_LIMIT, cl_limit: CL_LIMIT,
            school_year: currentSchoolYear, year: currentSchoolYear,
          })
        }
      }
      if (req.is_auto_generated) {
        const phone = TEACHERS.find(t => t.name === req.teacher_name)?.phone
        if (phone) {
          const msg = `Hi ${req.teacher_name},\n\nDue to late arrivals, *${req.days_count} Casual Leave* has been deducted from your balance as per school policy.\n\n— PGS Management`
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
        }
      }
    }
    setActioned(p => ({ ...p, [req.id]: action }))
    setRequests(p => p.map(r => r.id === req.id ? { ...r, status: action } : r))
    await fetchRequests()
  }

  async function cancelApproval(req) {
    if (!window.confirm(`Cancel approval for ${req.teacher_name}'s ${req.leave_type} leave (${req.days_count} days)? This will restore their balance.`)) return
    await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', req.id)
    if (req.leave_type === 'ML' || req.leave_type === 'CL') {
      const field = req.leave_type === 'ML' ? 'ml_used' : 'cl_used'
      const { data: existingBal } = await supabase.from('leave_balances').select('*')
        .eq('teacher_name', req.teacher_name).eq('school_year', currentSchoolYear).maybeSingle()
      if (existingBal?.id) {
        await supabase.from('leave_balances').update({
          [field]: Math.max(0, (existingBal[field] || 0) - (req.days_count - (req.lwp_days || 0))),
          lwp_count: Math.max(0, (existingBal.lwp_count || 0) - (req.lwp_days || 0)),
        }).eq('id', existingBal.id)
      }
    }
    setRequests(p => p.map(r => r.id === req.id ? { ...r, status: 'cancelled' } : r))
    await fetchRequests()
  }

  function getPhone(name) { return TEACHERS.find(t => t.name === name)?.phone || '' }

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending' && !r.exceeded).length,
    exceeded: requests.filter(r => r.exceeded && r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  }

  const filtered = filter === 'all' ? requests
    : filter === 'exceeded' ? requests.filter(r => r.exceeded && r.status === 'pending')
    : requests.filter(r => r.status === filter)

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'exceeded', label: 'Exceeded' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <HRHeader title="Leave Requests" rightExtra={<span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{schoolYearLabel}</span>} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {/* Stats + back */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <button onClick={() => navigate('/admin')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Pending', val: counts.pending, color: '#1E40AF', bg: '#EFF6FF' },
              { label: 'Exceeded', val: counts.exceeded, color: '#92400E', bg: '#FEF3C7' },
              { label: 'Approved', val: counts.approved, color: '#065F46', bg: '#ECFDF5' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '6px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, border: `1.5px solid ${filter === f.key ? '#111827' : '#E5E7EB'}`, background: filter === f.key ? '#111827' : '#fff', color: filter === f.key ? '#fff' : '#374151', cursor: 'pointer' }}>
              {f.label}{counts[f.key] > 0 ? ` (${counts[f.key]})` : ''}
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
          const vpApproved = req.vp_status === 'approved'
          const vpPending = req.vp_status === 'pending'
          return (
            <div key={req.id} style={{ background: '#fff', border: `1px solid ${vpPending && req.status === 'pending' ? '#DDD6FE' : req.exceeded && req.status === 'pending' ? '#FCD34D' : '#E5E7EB'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{req.teacher_name}</span>
                    <span style={{ fontSize: 11, background: '#F3F4F6', color: '#374151', padding: '2px 7px', borderRadius: 3, fontWeight: 600 }}>
                      {req.leave_type === 'ML' ? 'Medical' : req.leave_type === 'SL' ? 'Special' : req.is_auto_generated ? 'Late→CL' : 'Casual'}
                    </span>
                    <Badge status={req.status} exceeded={req.exceeded} vpStatus={req.vp_status} />
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
                    : req.leave_type === 'ML' && !req.is_auto_generated && <span style={{ fontSize: 11, color: '#92400E' }}>No document uploaded</span>
                  }
                  {req.exceeded && req.status === 'pending' && (
                    <div style={{ marginTop: 5, fontSize: 11, color: '#92400E', background: '#FEF3C7', padding: '3px 8px', borderRadius: 3, display: 'inline-block' }}>Limit exceeded — urgent</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  {req.status === 'pending' && vpApproved && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleAction(req, 'approved')}
                        style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => handleAction(req, 'rejected')}
                        style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Reject
                      </button>
                    </div>
                  )}
                  {req.status === 'pending' && vpPending && (
                    <div style={{ fontSize: 12, color: '#5B21B6', background: '#F5F3FF', border: '1px solid #DDD6FE', padding: '6px 12px', borderRadius: 6, fontWeight: 500 }}>
                      Waiting for VP
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <button onClick={() => cancelApproval(req)}
                      style={{ background: '#FFF7ED', color: '#9A3412', border: '1px solid #FED7AA', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Cancel Approval
                    </button>
                  )}
                  {(req.status !== 'pending' || actioned[req.id]) && phone && (
                    <button onClick={() => openWhatsApp(phone, req.teacher_name, req.leave_type, req.from_date, req.to_date, req.days_count, req.status)}
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