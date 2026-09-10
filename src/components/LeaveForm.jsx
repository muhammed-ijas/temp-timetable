import { useState, useEffect } from 'react'
import { supabase, ML_LIMIT, CL_LIMIT, CL_MONTHLY_LIMIT, getSchoolYear, countLeaveDays, fetchHolidayDates, schoolYearStart, schoolYearEnd } from '../lib/supabase'

const today = () => new Date().toISOString().split('T')[0]
function getMonthKey(dateStr) { return dateStr.slice(0, 7) }

export default function LeaveForm({ teacher, balance, history, onSubmitted }) {
  const currentSchoolYear = getSchoolYear()

  const [leaveType, setLeaveType] = useState('CL')
  const [fromDate, setFromDate] = useState(today())
  const [toDate, setToDate] = useState(today())
  const [reason, setReason] = useState('')
  const [docFile, setDocFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lwpWarning, setLwpWarning] = useState(false)
  const [showExceededConfirm, setShowExceededConfirm] = useState(false)
  const [holidays, setHolidays] = useState([])

  const mlUsed = balance?.ml_used ?? 0
  const clUsed = balance?.cl_used ?? 0
  const mlLimit = balance?.ml_limit ?? ML_LIMIT
  const clLimit = balance?.cl_limit ?? CL_LIMIT

  // Fetch holidays once
  useEffect(() => {
    fetchHolidayDates(currentSchoolYear).then(setHolidays)
  }, [currentSchoolYear])

  // Computed days using new helper
  const days = countLeaveDays(fromDate, toDate, holidays)

  // Detect sandwich for UI hint
  const sandwichActive = (() => {
    const from = new Date(fromDate)
    const to = new Date(toDate)
    let d = new Date(from)
    while (d <= to) {
      if (d.getDay() === 5) {
        const mon = new Date(d); mon.setDate(mon.getDate() + 3)
        if (mon <= to) return true
      }
      d.setDate(d.getDate() + 1)
    }
    return false
  })()

  // Count how many days were excluded (for info display)
  const rawDays = Math.max(1, Math.round((new Date(toDate) - new Date(fromDate)) / 86400000) + 1)
  const excludedDays = rawDays - days

  function getMonthlyClUsed(month) {
    return history.filter(r =>
      r.leave_type === 'CL' && r.status !== 'cancelled' && r.vp_status !== 'rejected' && getMonthKey(r.from_date) === month
    ).reduce((sum, r) => sum + (r.days_count || 0), 0)
  }

  function checkLwp() {
    if (leaveType !== 'CL') return { isLwp: false, lwpDays: 0, clDays: 0 }
    const month = getMonthKey(fromDate)
    const monthlyUsed = getMonthlyClUsed(month)
    const remaining = Math.max(0, CL_MONTHLY_LIMIT - monthlyUsed)
    const lwpDays = Math.max(0, days - remaining)
    return { isLwp: lwpDays > 0, lwpDays, clDays: days - lwpDays }
  }

  const { isLwp, lwpDays, clDays } = checkLwp()

  async function uploadDoc(file, requestId) {
    const ext = file.name.split('.').pop()
    const path = `${requestId}.${ext}`
    const { error } = await supabase.storage.from('leave-documents').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('leave-documents').getPublicUrl(path)
    return data.publicUrl
  }

  function handleApply() {
    if (!reason.trim()) return alert('Please enter a reason.')
    const used = leaveType === 'ML' ? mlUsed : clUsed
    const limit = leaveType === 'ML' ? mlLimit : clLimit
    if (used >= limit) { setShowExceededConfirm(true); return }
    submitLeave(false)
  }

  async function submitLeave(exceeded) {
    setShowExceededConfirm(false)
    setSubmitting(true)
    const { isLwp, lwpDays } = checkLwp()
    const { data: inserted } = await supabase.from('leave_requests').insert({
      teacher_name: teacher.name,
      leave_type: leaveType,
      from_date: fromDate,
      to_date: toDate,
      days_count: days,
      reason,
      status: 'pending',
      exceeded,
      lwp_days: isLwp ? lwpDays : 0,
      vp_status: 'pending',
      school_year: currentSchoolYear,
    }).select().single()

    if (docFile && inserted?.id) {
      const url = await uploadDoc(docFile, inserted.id)
      if (url) await supabase.from('leave_requests').update({ document_url: url }).eq('id', inserted.id)
    }

    setReason(''); setFromDate(today()); setToDate(today())
    setDocFile(null); setSubmitting(false); setSuccess(true)
    setLwpWarning(isLwp)
    onSubmitted()
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Apply for Leave</div>

      {success && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 5, padding: '10px 12px', marginBottom: 12, color: '#065F46', fontSize: 13, fontWeight: 500 }}>
          ✓ Request submitted! It will be reviewed by VP then HR.
          {lwpWarning && <div style={{ marginTop: 4, color: '#92400E', fontSize: 12 }}>⚠ Some days counted as LWP (monthly CL limit exceeded).</div>}
        </div>
      )}

      {/* Leave Type */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Leave Type</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['CL', 'Casual Leave'], ['ML', 'Medical Leave']].map(([type, label]) => (
            <button key={type} onClick={() => { setLeaveType(type); setDocFile(null) }}
              style={{ flex: 1, padding: '10px 6px', borderRadius: 6, border: `2px solid ${leaveType === type ? '#111827' : '#D1D5DB'}`, background: leaveType === type ? '#111827' : '#FAFAFA', color: leaveType === type ? '#fff' : '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>From Date</label>
          <input type="date" value={fromDate}
            min={schoolYearStart(currentSchoolYear)} max={schoolYearEnd(currentSchoolYear)}
            onChange={e => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value) }}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>To Date</label>
          <input type="date" value={toDate}
            min={fromDate} max={schoolYearEnd(currentSchoolYear)}
            onChange={e => setToDate(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', color: '#111827' }} />
        </div>
      </div>

      {/* Duration info box */}
      <div style={{
        background: isLwp ? '#FEF3C7' : sandwichActive ? '#FFF7ED' : '#F9FAFB',
        border: `1px solid ${isLwp ? '#FCD34D' : sandwichActive ? '#FED7AA' : '#E5E7EB'}`,
        borderRadius: 5, padding: '8px 12px', marginBottom: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>
            <strong>{days} day{days > 1 ? 's' : ''}</strong> selected
          </span>
          <span style={{ fontSize: 12, color: '#6B7280' }}>
            {leaveType === 'ML' ? mlLimit - mlUsed : clLimit - clUsed} days remaining
          </span>
        </div>
        {excludedDays > 0 && !sandwichActive && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#6B7280' }}>
            {excludedDays} day{excludedDays > 1 ? 's' : ''} excluded (Sundays/holidays not counted)
          </div>
        )}
        {sandwichActive && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#92400E', fontWeight: 600 }}>
            🥪 Sandwich rule applied — weekend between Fri &amp; Mon is counted
          </div>
        )}
        {leaveType === 'CL' && isLwp && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#92400E', fontWeight: 500 }}>
            ⚠ Monthly CL limit exceeded — {clDays > 0 ? `${clDays}d CL + ` : ''}{lwpDays}d will be <strong>LWP</strong>
          </div>
        )}
      </div>

      {/* Reason */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Reason</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Briefly describe your reason..." rows={3}
          style={{ width: '100%', padding: '9px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 13, background: '#FAFAFA', resize: 'none', color: '#111827' }} />
      </div>

      {/* ML Upload */}
      {leaveType === 'ML' && (
        <div style={{ marginBottom: 12, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 6 }}>MEDICAL DOCUMENT (Optional — can upload later)</div>
          <input type="file" accept="image/*,.pdf" onChange={e => setDocFile(e.target.files?.[0] || null)} style={{ fontSize: 12, color: '#374151' }} />
          {docFile && <div style={{ fontSize: 11, color: '#065F46', marginTop: 4 }}>✓ {docFile.name}</div>}
        </div>
      )}

      <button onClick={handleApply} disabled={submitting}
        style={{ width: '100%', background: '#111827', color: '#fff', border: 'none', padding: '12px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Submitting...' : 'Submit Leave Request'}
      </button>

      {/* Exceeded Modal */}
      {showExceededConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 22, maxWidth: 380, width: '100%' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 4, padding: '4px 8px', marginBottom: 10, display: 'inline-block' }}>Leave Limit Reached</div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 18 }}>
              Your <strong>{leaveType === 'ML' ? 'Medical' : 'Casual'} Leave</strong> limit is fully used. You can still submit for HR review.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowExceededConfirm(false)} style={{ flex: 1, background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '9px', borderRadius: 5, fontSize: 13, cursor: 'pointer', color: '#374151' }}>Cancel</button>
              <button onClick={() => submitLeave(true)} style={{ flex: 1, background: '#111827', border: 'none', padding: '9px', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>Send to HR Anyway</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}