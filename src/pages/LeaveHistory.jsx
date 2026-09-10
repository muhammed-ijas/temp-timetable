import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, TEACHERS, getSchoolYear, ML_LIMIT, CL_LIMIT } from '../lib/supabase'
import AppHeader from '../components/AppHeader'

const SESSION_KEY = 'pgs_teacher_session'

function getTeacherFromSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { name, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > 30 * 24 * 60 * 60 * 1000) return null
    return TEACHERS.find(t => t.name === name) || null
  } catch { return null }
}

function Badge({ status, exceeded, vpStatus }) {
  if (vpStatus === 'pending' && status === 'pending') return <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Awaiting VP</span>
  if (vpStatus === 'approved' && status === 'pending') return <span style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Awaiting HR</span>
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

export default function LeaveHistory() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentSchoolYear = getSchoolYear()
  const [teacher] = useState(() => location.state?.teacher || getTeacherFromSession())

  const [history, setHistory] = useState([])
  const [specialLeaves, setSpecialLeaves] = useState([])
  const [lateMarks, setLateMarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('leaves')
  const [docUploading, setDocUploading] = useState(false)
  const [uploadingForId, setUploadingForId] = useState(null)
  const fileInputRef = useRef(null)
  const [selectedMonth, setSelectedMonth] = useState('all')

  useEffect(() => {
    if (!teacher) { navigate('/login', { replace: true }); return }
    fetchAll()
  }, [teacher])

  async function fetchAll() {
    setLoading(true)
    const [{ data: reqs }, { data: sl }, { data: lm }] = await Promise.all([
      supabase.from('leave_requests').select('*')
        .eq('teacher_name', teacher.name).eq('school_year', currentSchoolYear)
        .order('created_at', { ascending: false }),
      supabase.from('special_leaves').select('*')
        .eq('teacher_name', teacher.name).eq('school_year', currentSchoolYear)
        .order('created_at', { ascending: false }),
      supabase.from('late_marks').select('*')
        .eq('teacher_name', teacher.name).eq('school_year', currentSchoolYear)
        .order('date', { ascending: false }),
    ])
    setHistory(reqs || [])
    setSpecialLeaves(sl || [])
    setLateMarks(lm || [])
    setLoading(false)
  }

  async function uploadDoc(file, requestId) {
    const ext = file.name.split('.').pop()
    const path = `${requestId}.${ext}`
    const { error } = await supabase.storage.from('leave-documents').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('leave-documents').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleLaterUpload(requestId) {
    if (!fileInputRef.current?.files?.[0]) return
    setDocUploading(true)
    setUploadingForId(requestId)
    const file = fileInputRef.current.files[0]
    const url = await uploadDoc(file, requestId)
    if (url) {
      await supabase.from('leave_requests').update({ document_url: url }).eq('id', requestId)
      fetchAll()
    }
    setDocUploading(false)
    setUploadingForId(null)
    fileInputRef.current.value = ''
  }

  const tabs = [
    { key: 'leaves', label: 'Leave Requests', count: history.length },
    { key: 'special', label: 'Special Leaves', count: specialLeaves.length },
    { key: 'lates', label: 'Late Marks', count: lateMarks.filter(l => !l.cancelled).length },
  ]

  

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <AppHeader title={teacher?.name?.trim() || 'Leave History'} showSignOut={true} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => navigate('/dashboard')}
           style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1C1C1E', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            ← Back
          </button>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>Leave History</div>
          <div style={{ width: 80 }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#F2F2F7', borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.key}onClick={() => { setActiveTab(t.key); setSelectedMonth('all') }}
              style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: 'none', background: activeTab === t.key ? '#fff' : 'transparent', color: activeTab === t.key ? '#1C1C1E' : '#8E8E93', fontWeight: activeTab === t.key ? 700 : 500, fontSize: 12, cursor: 'pointer', boxShadow: activeTab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {t.label}
              {t.count > 0 && <span style={{ marginLeft: 5, background: activeTab === t.key ? '#1C1C1E' : '#D1D1D6', color: activeTab === t.key ? '#fff' : '#636366', fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Month filter */}
{activeTab === 'leaves' && (() => {
  const months = [...new Set(history.map(r => r.from_date.slice(0, 7)))].sort().reverse()
  return months.length > 1 ? (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      <button onClick={() => setSelectedMonth('all')}
        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: selectedMonth === 'all' ? 700 : 500, border: `1.5px solid ${selectedMonth === 'all' ? '#1C1C1E' : '#E5E5EA'}`, background: selectedMonth === 'all' ? '#1C1C1E' : '#fff', color: selectedMonth === 'all' ? '#fff' : '#636366', cursor: 'pointer' }}>
        All
      </button>
      {months.map(m => {
        const [year, month] = m.split('-')
        const label = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
        return (
          <button key={m} onClick={() => setSelectedMonth(m)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: selectedMonth === m ? 700 : 500, border: `1.5px solid ${selectedMonth === m ? '#1C1C1E' : '#E5E5EA'}`, background: selectedMonth === m ? '#1C1C1E' : '#fff', color: selectedMonth === m ? '#fff' : '#636366', cursor: 'pointer' }}>
            {label}
          </button>
        )
      })}
    </div>
  ) : null
})()}

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
          onChange={() => { if (uploadingForId) handleLaterUpload(uploadingForId) }} />

        {loading ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Loading...</div>
        ) : (

          /* ── LEAVE REQUESTS ── */
          activeTab === 'leaves' ? (
           (() => {
  const filtered = history.filter(r => selectedMonth === 'all' || r.from_date.slice(0, 7) === selectedMonth)
  if (history.length === 0) return <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>No leave requests this year.</div>
  if (filtered.length === 0) return <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>No requests in this month.</div>
  return filtered.map(r => (
    <div key={r.id} style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>
                          {r.leave_type === 'ML' ? 'Medical Leave' : r.leave_type === 'CL' ? 'Casual Leave' : 'Special Leave'}
                        </span>
                        {r.is_auto_generated && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>Late→CL</span>}
                        {r.lwp_days > 0 && <span style={{ fontSize: 10, background: '#FEF2F2', color: '#991B1B', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>LWP: {r.lwp_days}d</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#636366', marginBottom: 3 }}>
                        {r.from_date} → {r.to_date}
                        <span style={{ marginLeft: 8, background: '#F2F2F7', color: '#3A3A3C', fontSize: 11, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>{r.days_count}d</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#8E8E93' }}>{r.reason}</div>
                      {r.document_url
                        ? <a href={r.document_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#1D4ED8', textDecoration: 'underline' }}>📎 View Document</a>
                        : r.leave_type === 'ML' && r.status !== 'cancelled' && !r.is_auto_generated && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7', padding: '2px 7px', borderRadius: 3 }}>📎 No document</span>
                            <button onClick={() => { setUploadingForId(r.id); fileInputRef.current?.click() }}
                              disabled={docUploading && uploadingForId === r.id}
                              style={{ fontSize: 11, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontWeight: 600 }}>
                              {docUploading && uploadingForId === r.id ? 'Uploading...' : 'Upload Now'}
                            </button>
                          </div>
                        )
                      }
                    </div>
                    <Badge status={r.status} exceeded={r.exceeded} vpStatus={r.vp_status} />
                  </div>
               </div>
  ))
})()

          /* ── SPECIAL LEAVES ── */
          ) : activeTab === 'special' ? (
            specialLeaves.length === 0
              ? <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>No special leaves granted this year.</div>
              : specialLeaves.map(sl => (
                <div key={sl.id} style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#5B21B6', marginBottom: 4 }}>{sl.days_count} day{sl.days_count > 1 ? 's' : ''} Special Leave</div>
                      <div style={{ fontSize: 12, color: '#636366', marginBottom: 3 }}>{sl.from_date} → {sl.to_date}</div>
                      {sl.reason && <div style={{ fontSize: 12, color: '#8E8E93' }}>{sl.reason}</div>}
                      <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 4 }}>Granted by {sl.granted_by?.toUpperCase()}</div>
                    </div>
                    <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>SL</span>
                  </div>
                </div>
              ))

          /* ── LATE MARKS ── */
          ) : (
            lateMarks.length === 0
              ? <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>No late marks this year.</div>
              : lateMarks.map(lm => (
                <div key={lm.id} style={{ background: lm.cancelled ? '#FAFAFA' : lm.converted ? '#FFFBEB' : '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: lm.cancelled ? '#8E8E93' : '#1C1C1E', textDecoration: lm.cancelled ? 'line-through' : 'none' }}>{lm.date}</div>
                    <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 2 }}>
                      {new Date(lm.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                  </div>
                  <div>
                    {lm.cancelled && <span style={{ fontSize: 11, background: '#F2F2F7', color: '#636366', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>Cancelled</span>}
                    {lm.converted && !lm.cancelled && <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>→ CL Deducted</span>}
                    {!lm.converted && !lm.cancelled && <span style={{ fontSize: 11, background: '#FFF7ED', color: '#9A3412', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Active</span>}
                  </div>
                </div>
              ))
          )
        )}
      </div>
    </div>
  )
}