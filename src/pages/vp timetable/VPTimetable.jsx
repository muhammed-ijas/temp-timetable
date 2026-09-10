import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TEACHERS, VP_PASSWORD, getSchoolYear, getSchoolYearLabel } from '../../lib/supabase'
import PrintTimetable from './PrintTimetable'

import { DAYS, DEFAULT_PERIODS, getDefaultPeriods, ordinalPeriod, Icons, PURPLE_DARK, PURPLE_BORDER } from './TimetableUtils'
import TimetableGrid   from './TimetableGrid'
import PeriodManager   from './PeriodManager'
import TeacherLoad     from './TeacherLoad'
import FreeTeachers    from './FreeTeachers'
import SubstitutionTab from './SubstitutionTab'

const SORTED_TEACHERS = [...TEACHERS].sort((a, b) => a.name.trim().localeCompare(b.name.trim()))

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input, select, textarea, button { font-family: inherit; }
  input:focus, select:focus { outline: 2px solid #5B21B6; border-color: #5B21B6 !important; }
  .tt-cell { cursor: pointer; transition: background 0.15s; }
  .tt-cell:hover { background: #EDE9FE !important; }
  .teacher-card { transition: all 0.15s; cursor: pointer; }
  .teacher-card:hover { background: #EDE9FE !important; border-color: #A78BFA !important; }
  .teacher-card.active { background: #3B0764 !important; border-color: #3B0764 !important; }
  .teacher-card.active .tc-name { color: #F9FAFB !important; }
  .teacher-card.active .tc-count { background: #5B21B6 !important; color: #DDD6FE !important; }
@keyframes tt-spin { to { transform: rotate(360deg) } }
  @media (max-width: 900px) { .tt-grid { overflow-x: auto; } .sidebar-grid { grid-template-columns: 1fr !important; } }`

const TABS = [
  ['timetable',    'Class Timetable',  Icons.Timetable],
  ['load',         'Teacher Load',     Icons.Load],
  ['free',         'Free Teachers',    Icons.Free],
  ['substitution', 'Substitution',     Icons.Substitution],
  ['print',        'Print Timetable',  Icons.Print],
]

export default function VPTimetable() {
  const navigate = useNavigate()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel   = getSchoolYearLabel(currentSchoolYear)

  const [tab, setTab]                           = useState('timetable')
  const [classes, setClasses]                   = useState([])
  const [selectedClass, setSelectedClass]       = useState(null)
  const [timetableData, setTimetableData]       = useState({})
  const [allTimetableData, setAllTimetableData] = useState([])
  const [classPeriods, setClassPeriods]         = useState([])
  const [loading, setLoading] = useState(false)
const [timetableLoading, setTimetableLoading] = useState(false)
  const [todaySubstitutions, setTodaySubstitutions] = useState([])

  const [newClassName, setNewClassName] = useState('')
  const [addingClass, setAddingClass]   = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pgs_vp') !== VP_PASSWORD) { navigate('/'); return }
    fetchAll()
  }, [])

  useEffect(() => {
  if (selectedClass) {
    setTimetableLoading(true)
    fetchTimetable(selectedClass.id)
  }
}, [selectedClass])

  // ── Re-fetch substitutions any time VP returns to the timetable tab ────────
  useEffect(() => {
    if (tab === 'timetable') fetchTodaySubs()
  }, [tab])

  // ── Lightweight sub fetch — no loading spinner needed ─────────────────────
  async function fetchTodaySubs() {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: subs } = await supabase
      .from('substitutions')
      .select('*')
      .eq('date', todayStr)
      .eq('school_year', currentSchoolYear)
    setTodaySubstitutions(subs || [])
  }

  async function fetchAll() {
    setLoading(true)
    const { data: cls } = await supabase.from('timetable_classes')
      .select('*').eq('school_year', currentSchoolYear).order('sort_order').order('name')
    setClasses(cls || [])
    if (cls && cls.length > 0 && !selectedClass) setSelectedClass(cls[0])

    const { data: allEntries } = await supabase
      .from('timetable_entries')
      .select('*, timetable_periods(*, timetable_classes(*))')
    setAllTimetableData(allEntries || [])

    await fetchTodaySubs()
    setLoading(false)
  }

  async function fetchTimetable(classId) {
    setLoading(true)
    const { data: periods } = await supabase.from('timetable_periods')
      .select('*').eq('class_id', classId).order('period_number')

    if (!periods || periods.length === 0) {
      setTimetableData({})
      setClassPeriods([])
      setTimetableLoading(false)
setLoading(false)
      setLoading(false)
      return
    }

    

    const periodIds = periods.map(p => p.id)
    const { data: entries } = await supabase.from('timetable_entries').select('*').in('period_id', periodIds)

    const data = {}
    const uniquePeriods = []
    const seenNumbers   = new Set()

    for (const period of periods) {
      if (!data[period.day]) data[period.day] = {}
      const periodEntries = (entries || []).filter(e => e.period_id === period.id)
      data[period.day][period.period_number] = { period, entries: periodEntries }

      if (!seenNumbers.has(period.period_number)) {
        seenNumbers.add(period.period_number)
        uniquePeriods.push({
          period_number: period.period_number,
          start_time:    period.start_time,
          end_time:      period.end_time,
          is_break:      period.is_break,
          break_label:   period.break_label,
        })
      }
    }

    uniquePeriods.sort((a, b) => a.period_number - b.period_number)
    setTimetableData(data)
    setClassPeriods(uniquePeriods)

    const { data: allEntries } = await supabase
      .from('timetable_entries')
      .select('*, timetable_periods(*, timetable_classes(*))')
    setAllTimetableData(allEntries || [])

      await fetchTodaySubs()
    setTimetableLoading(false)
    setLoading(false)
  }

 async function initializeClass(cls) {
    const periods = getDefaultPeriods(cls.name)
    const toInsert = []
    for (const day of DAYS) {
      for (const p of periods) {
        toInsert.push({
          class_id: cls.id, day,
          period_number: p.period_number,
          start_time: p.start_time,
          end_time: p.end_time,
          is_break: p.is_break || false,
          break_label: p.break_label || null,
        })
      }
    }
    await supabase.from('timetable_periods').insert(toInsert)
    await fetchTimetable(cls.id)
  }

  async function addClass() {
    if (!newClassName.trim()) return
    setAddingClass(true)
    const { data, error } = await supabase.from('timetable_classes').insert({
      name: newClassName.trim(), school_year: currentSchoolYear, sort_order: classes.length
    }).select().single()
    if (!error && data) {
      await initializeClass(data)
      await fetchAll()
      setSelectedClass(data)
    }
    setNewClassName('')
    setAddingClass(false)
  }

  async function deleteClass(cls) {
    if (!window.confirm(`Delete timetable for ${cls.name}? This cannot be undone.`)) return
    await supabase.from('timetable_classes').delete().eq('id', cls.id)
    setSelectedClass(null)
    await fetchAll()
  }

  const teacherLoad = useMemo(() => {
    const load = {}
    for (const entry of allTimetableData) {
      const p = entry.timetable_periods
      if (!p || p.timetable_classes?.school_year !== currentSchoolYear) continue
      if (!load[entry.teacher_name]) load[entry.teacher_name] = {}
      if (!load[entry.teacher_name][p.day]) load[entry.teacher_name][p.day] = []
      load[entry.teacher_name][p.day].push({
        className:      p.timetable_classes?.name,
        periodNumber:   p.period_number,
        startTime:      p.start_time,
        endTime:        p.end_time,
        subject:        entry.subject,
        isClassTeacher: entry.is_class_teacher || false,
      })
    }
    for (const teacher of Object.keys(load)) {
      for (const day of Object.keys(load[teacher])) {
        load[teacher][day].sort((a, b) => a.periodNumber - b.periodNumber)
      }
    }
    return load
  }, [allTimetableData])

  const activeRootTab = tab.startsWith('periods_') ? 'timetable' : tab

  return (
   <div style={{ minHeight: '100vh', background: '#F5F3FF', fontFamily: "'Inter', system-ui, sans-serif", overflowX: 'hidden', width: '100%', maxWidth: '100vw' }}>
      <style>{GLOBAL_CSS}</style>

      <header style={{ background: PURPLE_DARK, boxShadow: '0 1px 3px rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 'none', margin: '0 auto', padding: '9px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="PGS" style={{ height: 32, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ color: '#C4B5FD', fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' }}>Premier Global School</div>
              <div style={{ color: '#F9FAFB', fontSize: 14, fontWeight: 700 }}>VP — Timetable Manager</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: '#C4B5FD', fontSize: 11, alignSelf: 'center' }}>AY {schoolYearLabel}</span>
            <button onClick={() => navigate('/vp')}
              style={{ background: 'transparent', border: `1px solid #6D28D9`, color: '#C4B5FD', padding: '6px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
              ← VP Dashboard
            </button>
            <button onClick={() => { sessionStorage.removeItem('pgs_vp'); navigate('/') }}
              style={{ background: 'transparent', border: `1px solid #6D28D9`, color: '#C4B5FD', padding: '6px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
              Exit
            </button>
          </div>
        </div>
      </header>

      <div style={{ background: '#2E0657', borderBottom: `1px solid #4C1D95` }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px', display: 'flex', gap: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                padding: '10px 16px', border: 'none',
                borderBottom: `3px solid ${activeRootTab === key ? '#A78BFA' : 'transparent'}`,
                background: 'transparent',
                color: activeRootTab === key ? '#F9FAFB' : '#C4B5FD',
                fontWeight: activeRootTab === key ? 700 : 400,
                fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '16px 20px' }}>

        {tab === 'timetable' && (
          <TimetableGrid
            classes={classes}
            selectedClass={selectedClass}
            setSelectedClass={setSelectedClass}
            classPeriods={classPeriods}
            timetableData={timetableData}
            allTimetableData={allTimetableData}
            todaySubstitutions={todaySubstitutions}
            currentSchoolYear={currentSchoolYear}
            sortedTeachers={SORTED_TEACHERS}
            onSetTab={setTab}
            onRefresh={fetchTimetable}
            initializeClass={initializeClass}
            addClass={addClass}
            addingClass={addingClass}
            newClassName={newClassName}
            setNewClassName={setNewClassName}
            deleteClass={deleteClass}
            timetableLoading={timetableLoading}
          />
        )}

        {tab.startsWith('periods_') && selectedClass && (
          <PeriodManager
            selectedClass={selectedClass}
            classPeriods={classPeriods}
            timetableData={timetableData}
            onBack={() => setTab('timetable')}
            onRefresh={fetchTimetable}
          />
        )}

        {tab === 'load' && (
          <TeacherLoad sortedTeachers={SORTED_TEACHERS} teacherLoad={teacherLoad} />
        )}

        {tab === 'free' && (
          <FreeTeachers
            sortedTeachers={SORTED_TEACHERS}
            allTimetableData={allTimetableData}
            currentSchoolYear={currentSchoolYear}
          />
        )}
        {tab === 'print' && (
  <PrintTimetable
    sortedTeachers={SORTED_TEACHERS}
    classes={classes}
    allTimetableData={allTimetableData}
    currentSchoolYear={currentSchoolYear}
    schoolYearLabel={schoolYearLabel}
  />
)}

        {tab === 'substitution' && (
          <SubstitutionTab
            allTimetableData={allTimetableData}
            sortedTeachers={SORTED_TEACHERS}
            currentSchoolYear={currentSchoolYear}
          />
        )}
      </div>
    </div>
  )
}