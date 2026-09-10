import { useState, useEffect } from 'react'
import { supabase, TEACHERS, getSchoolYear, getSchoolYearLabel, ML_LIMIT, CL_LIMIT } from '../lib/supabase'

function Badge({ status, exceeded, vpStatus }) {
  if (vpStatus === 'approved' && status === 'pending') return <span style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Awaiting HR</span>
  if (vpStatus === 'pending' && status === 'pending') return <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Awaiting VP</span>
  if (vpStatus === 'rejected') return <span style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>VP Rejected</span>
  const map = {
    pending: exceeded ? { label: 'Limit Exceeded', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' } : { label: 'Pending', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
    approved: { label: 'Approved', color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
    rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
    cancelled: { label: 'Cancelled', color: '#4B5563', bg: '#F3F4F6', border: '#D1D5DB' },
  }
  const s = map[status] || map.pending
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{s.label}</span>
}

export default function TeacherHistoryPanel({ selectedTeacher, onClose }) {
  const currentSchoolYear = getSchoolYear()
  const [viewYear, setViewYear] = useState(currentSchoolYear)
  const [history, setHistory] = useState([])
  const [balance, setBalance] = useState(null)
  const [lateMarks, setLateMarks] = useState([])
  const [specialLeaves, setSpecialLeaves] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('leaves')

  const yearOptions = []
  for (let y = currentSchoolYear; y >= currentSchoolYear - 2; y--) yearOptions.push(y)

  useEffect(() => {
    if (selectedTeacher) fetchData()
  }, [selectedTeacher, viewYear])

  async function fetchData() {
    setLoading(true)
    const [{ data: reqs }, { data: bal }, { data: lm }, { data: sl }] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('teacher_name', selectedTeacher.name).eq('school_year', viewYear).order('created_at', { ascending: false }),
      supabase.from('leave_balances').select('*').eq('teacher_name', selectedTeacher.name).eq('school_year', viewYear).maybeSingle(),
      supabase.from('late_marks').select('*').eq('teacher_name', selectedTeacher.name).eq('school_year', viewYear).order('date', { ascending: false }),
      supabase.from('special_leaves').select('*').eq('teacher_name', selectedTeacher.name).eq('school_year', viewYear).order('created_at', { ascending: false }),
    ])
    setHistory(reqs || [])
    setBalance(bal)
    setLateMarks(lm || [])
    setSpecialLeaves(sl || [])
    setLoading(false)
  }

  if (!selectedTeacher) return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
      ← Select a teacher from the list to view their details
    </div>
  )

  const mlUsed = balance?.ml_used ?? 0
  const clUsed = balance?.cl_used ?? 0
  const lwpCount = balance?.lwp_count ?? 0
  const mlLimit = balance?.ml_limit ?? ML_LIMIT
  const clLimit = balance?.cl_limit ?? CL_LIMIT
  const activeLates = lateMarks.filter(l => !l.cancelled && !l.converted).length
  const totalSl = specialLeaves.reduce((s, l) => s + (l.days_count || 0), 0)

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#111827', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#F9FAFB', fontWeight: 700, fontSize: 15 }}>{selectedTeacher.name}</div>
          <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>Full Leave Record</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #374151', background: '#1F2937', color: '#F9FAFB', fontSize: 12, cursor: 'pointer' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}-{String(y+1).slice(2)}</option>)}
          </select>
          {onClose && <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #374151', color: '#9CA3AF', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>✕</button>}
        </div>
      </div>

      {/* Balance summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderBottom: '1px solid #F3F4F6' }}>
        {[
          { label: 'ML Used', val: `${mlUsed}/${mlLimit}`, color: '#1D4ED8', bg: '#EFF6FF' },
          { label: 'CL Used', val: `${clUsed}/${clLimit}`, color: '#047857', bg: '#ECFDF5' },
          { label: 'LWP', val: lwpCount, color: '#991B1B', bg: '#FEF2F2' },
          { label: 'Late Marks', val: activeLates, color: '#92400E', bg: '#FFF7ED' },
          { label: 'SL Granted', val: `${totalSl}d`, color: '#5B21B6', bg: '#F5F3FF' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, padding: '10px 12px', borderRight: '1px solid #F3F4F6' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: item.color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
        {[['leaves', 'Leave Requests'], ['lates', `Late Marks${activeLates > 0 ? ` (${activeLates})` : ''}`], ['special', 'Special Leaves']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveSection(key)}
            style={{ padding: '8px 14px', border: 'none', borderBottom: `2px solid ${activeSection === key ? '#111827' : 'transparent'}`, background: 'transparent', color: activeSection === key ? '#111827' : '#6B7280', fontWeight: activeSection === key ? 600 : 400, fontSize: 12, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Loading...</div>
        ) : activeSection === 'leaves' ? (
          history.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No leave requests this year.</div>
            : history.map(r => (
              <div key={r.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                      {r.leave_type === 'ML' ? 'Medical' : r.leave_type === 'CL' ? 'Casual' : r.leave_type === 'SL' ? 'Special' : r.leave_type}
                    </span>
                    {r.is_auto_generated && <span style={{ marginLeft: 5, fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3 }}>Late→CL</span>}
                    {r.lwp_days > 0 && <span style={{ marginLeft: 6, fontSize: 10, background: '#FEF2F2', color: '#991B1B', padding: '1px 5px', borderRadius: 3 }}>LWP: {r.lwp_days}d</span>}
                    <span style={{ color: '#6B7280', fontSize: 12, marginLeft: 8 }}>{r.from_date} → {r.to_date}</span>
                    <span style={{ color: '#9CA3AF', fontSize: 11, marginLeft: 6 }}>({r.days_count}d)</span>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{r.reason}</div>
                    {r.document_url
                      ? <a href={r.document_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1D4ED8', textDecoration: 'underline', marginTop: 2, display: 'inline-block' }}>📎 Document</a>
                      : r.leave_type === 'ML' && <span style={{ fontSize: 11, color: '#92400E', marginTop: 2, display: 'inline-block' }}>No document</span>}
                  </div>
                  <Badge status={r.status} exceeded={r.exceeded} vpStatus={r.vp_status} />
                </div>
              </div>
            ))
        ) : activeSection === 'lates' ? (
          lateMarks.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No late marks this year.</div>
            : lateMarks.map(lm => (
              <div key={lm.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: lm.cancelled ? '#9CA3AF' : '#111827', textDecoration: lm.cancelled ? 'line-through' : 'none', fontWeight: 500 }}>{lm.date}</div>
                {lm.cancelled && <span style={{ fontSize: 11, background: '#F3F4F6', color: '#6B7280', padding: '2px 7px', borderRadius: 3 }}>Cancelled</span>}
                {lm.converted && !lm.cancelled && <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 3 }}>→ CL Deducted</span>}
                {!lm.converted && !lm.cancelled && <span style={{ fontSize: 11, background: '#FFF7ED', color: '#9A3412', padding: '2px 7px', borderRadius: 3 }}>Active</span>}
              </div>
            ))
        ) : (
          specialLeaves.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No special leaves granted this year.</div>
            : specialLeaves.map(sl => (
              <div key={sl.id} style={{ padding: '10px 16px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: '#5B21B6', fontSize: 13 }}>{sl.days_count}d Special Leave</span>
                    <span style={{ color: '#6B7280', fontSize: 12, marginLeft: 8 }}>{sl.from_date} → {sl.to_date}</span>
                    {sl.reason && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sl.reason}</div>}
                    <div style={{ fontSize: 10, color: '#7C3AED', marginTop: 2 }}>Granted by {sl.granted_by?.toUpperCase()}</div>
                  </div>
                  <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>SL</span>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}