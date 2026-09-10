import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import {
  supabase, TEACHERS, ADMIN_PASSWORD, VP_PASSWORD,
  ML_LIMIT, CL_LIMIT, getSchoolYear, getSchoolYearLabel
} from '../lib/supabase'
import TeacherSelect from '../components/TeacherSelect'
import PinEntry from '../components/PinEntry'
import LeaveBalance from '../components/LeaveBalance'
import LeaveForm from '../components/LeaveForm'

// ── Session helpers ───────────────────────────────────────────────
const SESSION_KEY = 'pgs_teacher_session'

function saveSession(teacher) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    name: teacher.name,
    savedAt: Date.now()
  }))
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { name, savedAt } = JSON.parse(raw)
    // Expire after 30 days
    if (Date.now() - savedAt > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return TEACHERS.find(t => t.name === name) || null
  } catch {
    return null
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// ── Icons ─────────────────────────────────────────────────────────
const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const ClipboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
    <line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
)
const LogOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const ShieldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)
const ArrowLeftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

// ── Main component ────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [step, setStep] = useState('loading') // 'loading' | 'select' | 'pin' | 'dashboard' | 'leave'
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState('hr')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // ── On mount: check saved session ──
  useEffect(() => {
    const saved = loadSession()
    if (saved) {
      setSelectedTeacher(saved)
      setStep('dashboard')
      const firstName = saved.name.trim().split(' ')[0]
      toast.success(`Welcome back, ${firstName}!`, { duration: 2000 })
    } else {
      setStep('select')
    }
  }, [])

  // Fetch leave data when entering leave step
  useEffect(() => {
    if (step === 'leave' && selectedTeacher) {
      fetchBalance(selectedTeacher.name)
      fetchHistory(selectedTeacher.name)
    }
  }, [step])

  function handleTeacherSelect(name) {
    const t = TEACHERS.find(t => t.name === name) || null
    setSelectedTeacher(t)
    setBalance(null)
    setHistory([])
    setStep(t ? 'pin' : 'select')
  }

  function handlePinSuccess() {
    saveSession(selectedTeacher)
    setStep('dashboard')
    toast.success('Logged in successfully')
  }

  function handleExit() {
    clearSession()
    setStep('select')
    setSelectedTeacher(null)
    setBalance(null)
    setHistory([])
    toast('Signed out', { duration: 1500 })
  }

  async function fetchBalance(name) {
    setDataLoading(true)
    try {
      const { data: existing } = await supabase
        .from('leave_balances').select('*')
        .eq('teacher_name', name).eq('school_year', currentSchoolYear).maybeSingle()
      if (existing) {
        setBalance(existing)
      } else {
        const { data: created, error } = await supabase
          .from('leave_balances')
          .insert({ teacher_name: name, ml_used: 0, cl_used: 0, lwp_count: 0, ml_limit: ML_LIMIT, cl_limit: CL_LIMIT, school_year: currentSchoolYear, year: currentSchoolYear })
          .select().single()
        if (error) {
          const { data: retry } = await supabase.from('leave_balances').select('*')
            .eq('teacher_name', name).eq('school_year', currentSchoolYear).maybeSingle()
          setBalance(retry || { teacher_name: name, ml_used: 0, cl_used: 0, lwp_count: 0, ml_limit: ML_LIMIT, cl_limit: CL_LIMIT })
        } else {
          setBalance(created)
        }
      }
    } catch {
      setBalance({ teacher_name: name, ml_used: 0, cl_used: 0, lwp_count: 0, ml_limit: ML_LIMIT, cl_limit: CL_LIMIT })
    }
    setDataLoading(false)
  }

  async function fetchHistory(name) {
    const { data } = await supabase.from('leave_requests').select('*')
      .eq('teacher_name', name).eq('school_year', currentSchoolYear)
      .order('created_at', { ascending: false }).limit(30)
    setHistory(data || [])
  }

  function handlePasswordSubmit() {
    if (passwordTarget === 'hr' && password === ADMIN_PASSWORD) {
      sessionStorage.setItem('pgs_admin', ADMIN_PASSWORD)
      navigate('/admin')
    } else if (passwordTarget === 'vp' && password === VP_PASSWORD) {
      sessionStorage.setItem('pgs_vp', VP_PASSWORD)
      navigate('/vp')
    } else {
      setPasswordError('Incorrect password.')
      setPassword('')
      toast.error('Incorrect password')
    }
  }

  // ── Splash while checking localStorage ──
  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap');`}</style>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="PGS" style={{ height: 48, objectFit: 'contain', marginBottom: 16, opacity: 0.9 }} onError={e => e.target.style.display = 'none'} />
          <div style={{ color: '#636366', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>Premier Global School</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, borderRadius: 8 }
        }}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea, button { font-family: inherit; }
        input:focus, select:focus, textarea:focus { outline: 2px solid #1C1C1E; outline-offset: 0; border-color: #1C1C1E !important; }
        .pin-box:focus { outline: none !important; border-color: #1C1C1E !important; box-shadow: 0 0 0 3px rgba(28,28,30,0.1) !important; }
        .dash-card { transition: transform 0.14s ease, box-shadow 0.14s ease; -webkit-tap-highlight-color: transparent; }
        .dash-card:active { transform: scale(0.97) !important; box-shadow: 0 1px 4px rgba(0,0,0,0.07) !important; }
        @media (hover: hover) { .dash-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.11) !important; } }
        @media (max-width: 420px) {
          .hw { padding: 10px 14px !important; }
          .pw { padding: 14px 12px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <header style={{ background: '#1C1C1E', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="hw" style={{ maxWidth: 640, margin: '0 auto', padding: '11px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="PGS" style={{ height: 30, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase' }}>Premier Global School</div>
              <div style={{ color: '#F2F2F7', fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2 }}>Staff Portal</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#48484A', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{schoolYearLabel}</span>
            <button
              onClick={() => { setPasswordTarget('vp'); setShowPasswordModal(true); setPassword(''); setPasswordError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              <ShieldIcon /> VP
            </button>
            <button
              onClick={() => { setPasswordTarget('hr'); setShowPasswordModal(true); setPassword(''); setPasswordError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
              <ShieldIcon /> HR
            </button>
          </div>
        </div>
      </header>

      <div className="pw" style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── SELECT + PIN ── */}
        {(step === 'select' || step === 'pin') && (
          <TeacherSelect selectedTeacher={selectedTeacher} onSelect={handleTeacherSelect} />
        )}
        {step === 'pin' && (
          <PinEntry
            teacher={selectedTeacher}
            onSuccess={handlePinSuccess}
            onBack={() => handleTeacherSelect('')}
          />
        )}

        {/* ── DASHBOARD ── */}
        {step === 'dashboard' && (
          <div>
            {/* Welcome bar */}
            <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '16px 18px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>Welcome back</div>
                <div style={{ color: '#F2F2F7', fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>{selectedTeacher?.name?.trim()}</div>
              </div>
              <button
                onClick={handleExit}
                title="Sign out and clear saved session"
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                <LogOutIcon /> Sign out
              </button>
            </div>

            {/* Two main cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {/* Leave */}
              <button
                className="dash-card"
                onClick={() => setStep('leave')}
                style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '20px 16px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
                <div style={{ width: 46, height: 46, background: '#FFF0F0', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                  <ClipboardIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>Leave</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>Apply and track your leave requests</div>
                </div>
                <div style={{ color: '#C7C7CC', alignSelf: 'flex-end' }}><ChevronRightIcon /></div>
              </button>

              {/* Timetable */}
              <button
                className="dash-card"
                onClick={() => navigate('/timetable', { state: { teacher: selectedTeacher } })}
                style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '20px 16px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
                <div style={{ width: 46, height: 46, background: '#F0F4FF', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <CalendarIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>Timetable</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>View your weekly class schedule</div>
                </div>
                <div style={{ color: '#C7C7CC', alignSelf: 'flex-end' }}><ChevronRightIcon /></div>
              </button>
            </div>

            {/* AY strip */}
            <div style={{ background: '#F2F2F7', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#636366' }}>Academic Year</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E', fontFamily: "'DM Mono', monospace" }}>AY {schoolYearLabel}</span>
            </div>
          </div>
        )}

        {/* ── LEAVE ── */}
        {step === 'leave' && (
          <>
            <div style={{ background: '#1C1C1E', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setStep('dashboard')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', color: '#8E8E93' }}>
                  <ArrowLeftIcon />
                </button>
                <div>
                  <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase' }}>Leave Portal</div>
                  <div style={{ color: '#F2F2F7', fontSize: 13.5, fontWeight: 700 }}>{selectedTeacher?.name?.trim()}</div>
                </div>
              </div>
              <button
                onClick={handleExit}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>
                <LogOutIcon /> Sign out
              </button>
            </div>

            {dataLoading
              ? <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Loading...</div>
              : <LeaveBalance balance={balance} history={history} teacherName={selectedTeacher?.name} onRefresh={() => { fetchBalance(selectedTeacher.name); fetchHistory(selectedTeacher.name) }} />
            }

            <LeaveForm
              teacher={selectedTeacher}
              balance={balance}
              history={history}
              onSubmitted={() => {
                fetchBalance(selectedTeacher.name)
                fetchHistory(selectedTeacher.name)
                toast.success('Leave request submitted!')
              }}
            />
          </>
        )}
      </div>

      {/* ── Password modal (bottom sheet on mobile) ── */}
      {showPasswordModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowPasswordModal(false) }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 22px 40px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 36, height: 4, background: '#E5E5EA', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: passwordTarget === 'vp' ? '#5B21B6' : '#1C1C1E', marginBottom: 4 }}>
              {passwordTarget === 'vp' ? 'VP Access' : 'HR Access'}
            </div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 18 }}>
              Enter the {passwordTarget === 'vp' ? 'VP' : 'HR'} password to continue.
            </div>
            <input
              type="password" value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password" autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${passwordError ? '#FCA5A5' : '#E5E5EA'}`, fontSize: 15, color: '#1C1C1E', marginBottom: 8, background: '#F8F9FB' }}
            />
            {passwordError && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{passwordError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => setShowPasswordModal(false)}
                style={{ flex: 1, background: '#F2F2F7', border: 'none', padding: '13px', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#3A3A3C', fontWeight: 500 }}>
                Cancel
              </button>
              <button onClick={handlePasswordSubmit}
                style={{ flex: 1, background: passwordTarget === 'vp' ? '#5B21B6' : '#1C1C1E', border: 'none', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
                Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}