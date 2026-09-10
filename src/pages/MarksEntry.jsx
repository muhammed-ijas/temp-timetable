import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, getSchoolYear, getSchoolYearLabel } from '../lib/supabase'

// ── Icons ──
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
)
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
)

export default function MarksEntry() {
  const navigate = useNavigate()
  const location = useLocation()
  const teacher = location.state?.teacher

  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [pairs, setPairs] = useState([])  // [{ className, subject }]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teacher) { navigate('/login', { replace: true }); return }
    fetchMyClassSubjects()
  }, [])

   // Read this teacher's subject assignments (set by admin), not the timetable.
  async function fetchMyClassSubjects() {
    setLoading(true)
    const { data: rows } = await supabase
          .from('teacher_subjects')
      .select('class_name, subjects ( name, active )')
      .eq('teacher_name', teacher.name)
      .eq('school_year', currentSchoolYear)

    const list = []
    for (const r of (rows || [])) {
      if (!r.subjects || r.subjects.active === false) continue
      list.push({ className: r.class_name, subject: r.subjects.name })
    }

    list.sort((a, b) =>
      a.className.localeCompare(b.className, undefined, { numeric: true }) ||
      a.subject.localeCompare(b.subject)
    )
    setPairs(list)
    setLoading(false)
  }

  if (!teacher) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; }
        .ms-card { transition: transform 0.14s ease, box-shadow 0.14s ease; -webkit-tap-highlight-color: transparent; }
        .ms-card:active { transform: scale(0.98) !important; }
        @media (hover: hover) { .ms-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.1) !important; } }
      `}</style>

      {/* Header */}
      <header style={{ background: '#1C1C1E', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 14px', height: 54, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/dashboard', { state: { teacher } })}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
              <ArrowLeftIcon /> Dashboard
            </button>
            <div>
              <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 700 }}>Marks Entry</div>
              <div style={{ color: '#636366', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>{teacher.name?.trim()}</div>
            </div>
          </div>
          <span style={{ color: '#48484A', fontSize: 10, fontFamily: 'monospace' }}>{schoolYearLabel}</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '18px 14px' }}>

        <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>Select what to mark</div>
          <div style={{ color: '#F2F2F7', fontSize: 17, fontWeight: 700 }}>Your Classes &amp; Subjects</div>
          <div style={{ color: '#8E8E93', fontSize: 12, marginTop: 4 }}>Only the classes and subjects assigned to you appear here.</div>
        </div>

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Loading…</div>
        ) : pairs.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>No classes assigned</div>
            <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
              You don't have any subjects in the timetable yet, so there's nothing to mark. If this is wrong, ask the admin to check your timetable.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {pairs.map(({ className, subject }) => (
              <button
                key={`${className}||${subject}`}
                className="ms-card"
                onClick={() => navigate('/marks/sheet', { state: { teacher, className, subject } })}
                style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ minWidth: 52, height: 46, padding: '0 10px', borderRadius: 12, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#4F46E5', whiteSpace: 'nowrap', textAlign: 'center', lineHeight: 1.1 }}>{className}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E' }}>{subject}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Class {className}</div>
                </div>
                <div style={{ color: '#C7C7CC', flexShrink: 0 }}><ChevronRightIcon /></div>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: '#C7C7CC', textAlign: 'center' }}>
          {pairs.length > 0 && `${pairs.length} class-subject${pairs.length !== 1 ? 's' : ''} you teach`}
        </div>
      </div>
    </div>
  )
}