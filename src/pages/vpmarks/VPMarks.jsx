import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import { isMarksClass, mergedSubject } from '../../lib/examConfig'

const PURPLE_DARK = '#3B0764'
const PURPLE_MID  = '#5B21B6'

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
)
const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
)

export default function VPMarks() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel   = getSchoolYearLabel(currentSchoolYear)

  const [classes, setClasses]   = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [subLoading, setSubLoading] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
    fetchClasses()
  }, [])

  useEffect(() => {
    if (selectedClass) fetchSubjects(selectedClass)
  }, [selectedClass])

  async function fetchClasses() {
    setLoading(true)
    const { data } = await supabase
      .from('timetable_classes')
      .select('*')
      .eq('school_year', currentSchoolYear)
      .order('sort_order').order('name')
    setClasses(data || [])
    setLoading(false)
  }

  // Subjects actually taught in this class (from the timetable)
  async function fetchSubjects(cls) {
    setSubLoading(true)
    const { data: periods } = await supabase
      .from('timetable_periods')
      .select('id')
      .eq('class_id', cls.id)

    const periodIds = (periods || []).map(p => p.id)
    if (periodIds.length === 0) { setSubjects([]); setSubLoading(false); return }

    const { data: entries } = await supabase
      .from('timetable_entries')
      .select('subject, teacher_name')
      .in('period_id', periodIds)

    // unique subjects, with the teacher(s) who teach them.
    // Physics/Chemistry/Biology merge into "Science" for Classes 6-8.
    const map = {}
    for (const e of (entries || [])) {
      if (!e.subject) continue
      const subject = mergedSubject(cls.name, e.subject)
      if (!map[subject]) map[subject] = new Set()
      if (e.teacher_name) map[subject].add(e.teacher_name)
    }
    const list = Object.keys(map).sort().map(subject => ({
      subject,
      teachers: [...map[subject]],
    }))
    setSubjects(list)
    setSubLoading(false)
  }

  function openSheet(subject) {
    navigate('/vp/marks/sheet', {
      state: { vp: true, className: selectedClass.name, subject },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3FF', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; }
        .vpm-card { transition: transform 0.14s ease, box-shadow 0.14s ease; }
        .vpm-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.1) !important; }
        @media (max-width: 900px) { .vpm-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* Header */}
      <header style={{ background: PURPLE_DARK, position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '9px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="PGS" style={{ height: 32, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>Premier Global School</div>
              <div style={{ color: '#F9FAFB', fontSize: 14, fontWeight: 700 }}>VP — Marks</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#C4B5FD', fontSize: 11 }}>AY {schoolYearLabel}</span>
            <button onClick={() => navigate('/vp')}
              style={{ background: 'transparent', border: '1px solid #6D28D9', color: '#C4B5FD', padding: '6px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
              ← VP Dashboard
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px' }}>

        <div className="vpm-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14 }}>

          {/* Class list */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #F3F4F6', fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' }}>
              Select Class
            </div>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>Loading…</div>
            ) : classes.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No classes found</div>
            ) : (
              classes.map(cls => {
                const active = selectedClass?.id === cls.id
                const hasMarks = isMarksClass(cls.name)
                return (
                  <button key={cls.id} onClick={() => setSelectedClass(cls)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '11px 12px', border: 'none',
                      borderBottom: '1px solid #F9FAFB', cursor: 'pointer',
                      background: active ? PURPLE_DARK : 'transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
                    }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#F9FAFB' : '#111827' }}>
                      Class {cls.name}
                    </span>
                    {!hasMarks && (
                      <span style={{ fontSize: 9, background: active ? '#4C1D95' : '#F3F4F6', color: active ? '#C4B5FD' : '#9CA3AF', padding: '2px 6px', borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>
                        NO SETUP
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Subjects */}
          <div style={{ minWidth: 0 }}>
            {!selectedClass ? (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Select a class to see its subjects
              </div>
            ) : !isMarksClass(selectedClass.name) ? (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                  Marks not set up for Class {selectedClass.name}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                  This class has no marks components configured yet. It will be added later.
                </div>
              </div>
            ) : (
              <>
                <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Class {selectedClass.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    Pick a subject to view and edit its marks
                  </div>
                </div>

                {subLoading ? (
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    Loading subjects…
                  </div>
                ) : subjects.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    No subjects in the timetable for this class yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {subjects.map(({ subject, teachers }) => (
                      <button key={subject} className="vpm-card" onClick={() => openSheet(subject)}
                        style={{
                          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
                          padding: '13px 16px', cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', gap: 12,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{subject}</div>
                          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                            {teachers.length > 0 ? teachers.join(', ') : 'No teacher assigned'}
                          </div>
                        </div>
                        <div style={{ color: '#C4B5FD', flexShrink: 0 }}><ChevronRightIcon /></div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}