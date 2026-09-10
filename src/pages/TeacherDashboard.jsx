import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import {
  supabase, TEACHERS, ML_LIMIT, CL_LIMIT, getSchoolYear, getSchoolYearLabel
} from '../lib/supabase'
import { isClassTeacher } from '../lib/classTeachers'
import LeaveBalance from '../components/LeaveBalance'
import LeaveForm from '../components/LeaveForm'
import AppHeader from '../components/AppHeader'

const SESSION_KEY = 'pgs_teacher_session'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { name, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return TEACHERS.find(t => t.name === name) || null
  } catch { return null }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

// Icons
const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const ClipboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const ArrowLeftIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const DiaryIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="12" y2="15" />
  </svg>
)
const StudentsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const ClassGridIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="3" />
  </svg>
)

const MarksIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [teacher, setTeacher] = useState(null)
  const [ready, setReady] = useState(false)
  const [view, setView] = useState('home') // 'home' | 'leave'
  const [balance, setBalance] = useState(null)
  const [history, setHistory] = useState([])
  const [dataLoading, setDataLoading] = useState(false)

  const showStudents = teacher && isClassTeacher(teacher.name)

  useEffect(() => {
    const saved = loadSession()
    if (!saved) {
      navigate('/login', { replace: true })
      return
    }
    setTeacher(saved)
    setReady(true)
  }, [])

  useEffect(() => {
    if (view === 'leave' && teacher) {
      fetchBalance(teacher.name)
      fetchHistory(teacher.name)
    }
  }, [view, teacher])

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

  function handleSignOut() {
    clearSession()
    navigate('/login', { replace: true })
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: '#1C1C1E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="PGS" style={{ height: 48, objectFit: 'contain', marginBottom: 16, opacity: 0.9 }} onError={e => e.target.style.display = 'none'} />
          <div style={{ color: '#636366', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, borderRadius: 8 } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea, button { font-family: inherit; }
        .dash-card { transition: transform 0.14s ease, box-shadow 0.14s ease; -webkit-tap-highlight-color: transparent; }
        .dash-card:active { transform: scale(0.97) !important; box-shadow: 0 1px 4px rgba(0,0,0,0.07) !important; }
        @media (hover: hover) { .dash-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.11) !important; } }
        @media (max-width: 420px) { .hw { padding: 10px 14px !important; } .pw { padding: 14px 12px !important; } }
      `}</style>

      <AppHeader
        title={view === 'leave' ? teacher?.name?.trim() : 'My Dashboard'}
        showSignOut={true}
        rightExtra={
          <span style={{ color: '#48484A', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{schoolYearLabel}</span>
        }
      />

      <div className="pw" style={{ maxWidth: 960, margin: '0 auto', padding: '20px 16px' }}>

        {view === 'home' && (
          <div>
            <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '18px 18px', marginBottom: 14 }}>
              <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 }}>Welcome back</div>
              <div style={{ color: '#F2F2F7', fontSize: 19, fontWeight: 700, letterSpacing: -0.3 }}>{teacher?.name?.trim()}</div>
            </div>

            <div style={{ background: '#F2F2F7', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: '#636366' }}>Academic Year</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1C1C1E', fontFamily: "'DM Mono', monospace" }}>{schoolYearLabel}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {/* Leave */}
              <button className="dash-card" onClick={() => setView('leave')}
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
              <button className="dash-card" onClick={() => navigate('/timetable', { state: { teacher } })}
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

              {/* Teacher's Diary */}
              <button className="dash-card" onClick={() => navigate('/diary', { state: { teacher } })}
                style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '20px 16px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
                <div style={{ width: 46, height: 46, background: '#F0FDF4', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <DiaryIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>Teacher's Diary</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>Fill your teaching diary</div>
                </div>
                <div style={{ color: '#C7C7CC', alignSelf: 'flex-end' }}><ChevronRightIcon /></div>
              </button>

              {/* Marks — every teacher who teaches */}
              <button className="dash-card" onClick={() => navigate('/marks', { state: { teacher } })}
                style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '20px 16px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
                <div style={{ width: 46, height: 46, background: '#FEF3C7', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
                  <MarksIcon />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>Marks Entry</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>Enter marks for your subjects</div>
                </div>
                <div style={{ color: '#C7C7CC', alignSelf: 'flex-end' }}><ChevronRightIcon /></div>
              </button>

              {/* My Students — only for class teachers */}
              {showStudents && (
                <>
                  <button className="dash-card" onClick={() => navigate('/students', { state: { teacher } })}
                    style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '20px 16px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
                    <div style={{ width: 46, height: 46, background: '#EEF2FF', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                      <StudentsIcon />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>My Students</div>
                      <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>Add and manage your class students</div>
                    </div>
                    <div style={{ color: '#C7C7CC', alignSelf: 'flex-end' }}><ChevronRightIcon /></div>
                  </button>

                  <button className="dash-card" onClick={() => navigate('/my-class', { state: { teacher } })}
                    style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '20px 16px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 160 }}>
                    <div style={{ width: 46, height: 46, background: '#FEF2F2', borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#BE123C' }}>
                      <ClassGridIcon />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 4 }}>My Class Timetable</div>
                      <div style={{ fontSize: 12, color: '#8E8E93', lineHeight: 1.5 }}>Full weekly schedule for your class</div>
                    </div>
                    <div style={{ color: '#C7C7CC', alignSelf: 'flex-end' }}><ChevronRightIcon /></div>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {view === 'leave' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <button onClick={() => setView('home')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1C1C1E', border: '1px solid #E5E5EA', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                <ArrowLeftIcon /> Back to Dashboard
              </button>
              <button onClick={() => navigate('/history', { state: { teacher } })}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1C1C1E', border: '1px solid #E5E5EA', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                View History →
              </button>
            </div>
            {dataLoading
              ? <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Loading...</div>
              : <LeaveBalance balance={balance} history={history} teacherName={teacher?.name} onRefresh={() => { fetchBalance(teacher.name); fetchHistory(teacher.name) }} />
            }
            <LeaveForm
              teacher={teacher}
              balance={balance}
              history={history}
              onSubmitted={() => {
                fetchBalance(teacher.name)
                fetchHistory(teacher.name)
                toast.success('Leave request submitted!')
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}