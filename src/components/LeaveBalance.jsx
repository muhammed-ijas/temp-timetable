  import { useState, useEffect, useRef } from 'react'
  import { supabase, ML_LIMIT, CL_LIMIT, CL_MONTHLY_LIMIT, getSchoolYear } from '../lib/supabase'

  function Badge({ status, exceeded, lwp, vpStatus }) {
    if (lwp) return <span style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>LWP</span>
    if (vpStatus === 'pending' && status === 'pending') return <span style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>Awaiting VP</span>
    if (vpStatus === 'approved' && status === 'pending') return <span style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>Awaiting HR</span>
    if (vpStatus === 'rejected') return <span style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>VP Rejected</span>
    const map = {
      pending: exceeded ? { label: 'Limit Exceeded', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' } : { label: 'Pending', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE' },
      approved: { label: 'Approved', color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
      rejected: { label: 'Rejected', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
      cancelled: { label: 'Cancelled', color: '#4B5563', bg: '#F3F4F6', border: '#D1D5DB' },
    }
    const s = map[status] || map.pending
    return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
  }

  export default function LeaveBalance({ balance, history, teacherName, onRefresh }) {
    const fileInputRef = useRef(null)
    const currentSchoolYear = getSchoolYear()
    const [showHistory, setShowHistory] = useState(false)
    const [docUploading, setDocUploading] = useState(false)
    const [uploadingForId, setUploadingForId] = useState(null)
    const [specialLeaves, setSpecialLeaves] = useState([])
    const [lateMarks, setLateMarks] = useState([])
    

    const mlUsed = balance?.ml_used ?? 0
    const clUsed = balance?.cl_used ?? 0
    const lwpCount = balance?.lwp_count ?? 0
    const mlLimit = balance?.ml_limit ?? ML_LIMIT
    const clLimit = balance?.cl_limit ?? CL_LIMIT
    const slGranted = balance?.sl_granted ?? 0

    // Count active (unconverted, uncancelled) lates
    const activeLates = lateMarks.filter(l => !l.cancelled && !l.converted).length

    useEffect(() => {
      if (teacherName) {
        fetchExtra()
      }
    }, [teacherName])

    async function fetchExtra() {
      const [{ data: sl }, { data: lm }] = await Promise.all([
        supabase.from('special_leaves').select('*')
          .eq('teacher_name', teacherName).eq('school_year', currentSchoolYear)
          .order('created_at', { ascending: false }),
        supabase.from('late_marks').select('*')
          .eq('teacher_name', teacherName).eq('school_year', currentSchoolYear)
          .order('date', { ascending: false })
      ])
      setSpecialLeaves(sl || [])
      setLateMarks(lm || [])
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
        onRefresh()
      }
      setDocUploading(false)
      setUploadingForId(null)
      fileInputRef.current.value = ''
    }

    const totalSlDays = specialLeaves.reduce((s, l) => s + (l.days_count || 0), 0)

    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Your Leave Balance</div>

        {/* ML / CL cards */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'ML — Medical Leave', used: mlUsed, limit: mlLimit, color: '#1D4ED8', bg: '#EFF6FF', sub: 'No monthly limit' },
            { label: 'CL — Casual Leave', used: clUsed, limit: clLimit, color: '#047857', bg: '#ECFDF5', sub: `Max ${CL_MONTHLY_LIMIT}/month` },
          ].map(item => (
            <div key={item.label} style={{ flex: 1, minWidth: 140, background: item.bg, borderRadius: 6, padding: '9px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: item.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>{item.label}</span>
                <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 500 }}>{item.used}/{item.limit}</span>
              </div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{item.sub}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.limit - item.used} <span style={{ fontSize: 11, fontWeight: 400, color: '#6B7280' }}>left</span></div>
              <div style={{ marginTop: 5, height: 3, background: '#E5E7EB', borderRadius: 2 }}>
                <div style={{ height: 3, background: item.color, borderRadius: 2, width: `${Math.min(100, (item.used / item.limit) * 100)}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* SL card if any */}
        {totalSlDays > 0 && (
          <div style={{ background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#5B21B6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>SL — Special Leave</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#5B21B6' }}>{totalSlDays} <span style={{ fontSize: 11, fontWeight: 400, color: '#7C3AED' }}>day{totalSlDays > 1 ? 's' : ''} granted</span></div>
            <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>Extra paid leave — doesn't affect ML/CL balance</div>
          </div>
        )}

        {/* Late marks warning */}
        {activeLates > 0 && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 5, padding: '6px 10px', fontSize: 12, color: '#9A3412', fontWeight: 500, marginBottom: 8 }}>
            🕐 Late marks this year: <strong>{activeLates}</strong>
            {activeLates >= 2 && <span style={{ marginLeft: 6, fontSize: 11, color: '#B91C1C' }}>— {Math.floor(activeLates / 2)} CL deduction pending HR approval</span>}
            {activeLates % 2 === 1 && <span style={{ marginLeft: 6, fontSize: 11, color: '#78716C' }}>— 1 more late = 1 CL deducted</span>}
          </div>
        )}

        {/* LWP warning */}
        {lwpCount > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 5, padding: '6px 10px', fontSize: 12, color: '#991B1B', fontWeight: 500, marginBottom: 8 }}>
            ⚠ LWP this year: {lwpCount} day{lwpCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    )
  }