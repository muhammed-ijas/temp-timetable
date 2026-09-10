import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase, TEACHERS, getSchoolYear, getSchoolYearLabel } from '../lib/supabase'
import AppHeader from '../components/AppHeader'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' }

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function todayDayName() {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
}
function fmtDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
// '2026-07-13' -> '2026-07'
function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : ''
}
// '2026-07' -> 'July 2026'
function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
)
const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
)
const ListIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
)
const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
)
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
)
const SwapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
)

const DAY_COLORS = {
  Monday: { bg: '#EFF6FF', text: '#1D4ED8', dot: '#3B82F6' },
  Tuesday: { bg: '#F0FDF4', text: '#15803D', dot: '#22C55E' },
  Wednesday: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' },
  Thursday: { bg: '#FDF4FF', text: '#7E22CE', dot: '#A855F7' },
  Friday: { bg: '#FFF1F2', text: '#BE123C', dot: '#F43F5E' },
}

const SESSION_KEY = 'pgs_teacher_session'

// Every slot is shown, so a teacher can see breaks and free periods too.
const ALL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function sectionOf(className) {
  const n = (className || '').trim().toLowerCase()
  return (n.startsWith('nursery') || n.startsWith('lkg') || n.startsWith('ukg')) ? 'pre' : 'pri'
}

function getTeacherFromSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { name, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > 30 * 24 * 60 * 60 * 1000) return null
    return TEACHERS.find(t => t.name === name) || null
  } catch { return null }
}

export default function TeacherTimetable() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const [teacher] = useState(() => location.state?.teacher || getTeacherFromSession())
  const [schedule, setSchedule] = useState([])
  // slot times + break flags per section, read from the timetable itself
  const [periodMeta, setPeriodMeta] = useState({ pre: {}, pri: {} })
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState('All')
  const [viewMode, setViewMode] = useState('grid')

  // ── Substitutions ──
  const [tab, setTab] = useState('timetable')       // 'timetable' | 'subs'
  const [todaySubs, setTodaySubs] = useState([])    // substitutions dated today
  const [allSubs, setAllSubs] = useState([])        // full history (this school year)
  const [subsLoading, setSubsLoading] = useState(true)
  const [subMonth, setSubMonth] = useState(() => todayStr().slice(0, 7))  // default: current month

  const TODAY = todayStr()
  const TODAY_DAY = todayDayName()

  useEffect(() => {
    if (!teacher) { navigate('/login', { replace: true }); return }
    fetchSchedule()
    fetchSubs()
  }, [teacher])

  async function fetchSchedule() {
    setLoading(true)
    try {
      // Slot times and break flags, per section. Taken from the timetable so
      // it stays correct if VP ever changes the times.
      const { data: allPeriods } = await supabase
        .from('timetable_periods')
        .select('*, timetable_classes(name, school_year)')

      const meta = { pre: {}, pri: {} }
      for (const p of (allPeriods || [])) {
        const cls = p.timetable_classes
        if (!cls || cls.school_year !== currentSchoolYear) continue
        const sec = sectionOf(cls.name)
        if (!meta[sec][p.period_number]) {
          meta[sec][p.period_number] = {
            start_time: p.start_time,
            end_time: p.end_time,
            is_break: !!p.is_break,
          }
        }
      }
      setPeriodMeta(meta)

      const { data: entries } = await supabase.from('timetable_entries')
        .select('*, timetable_periods(*, timetable_classes(*))')
        .eq('teacher_name', teacher.name)

      if (!entries || entries.length === 0) { setSchedule([]); setLoading(false); return }

      const periodIds = [...new Set(entries.map(e => e.timetable_periods?.id).filter(Boolean))]
      const { data: allPeriodEntries } = await supabase.from('timetable_entries')
        .select('*').in('period_id', periodIds)

      const rows = []
      const seen = new Set()
      for (const entry of entries) {
        const period = entry.timetable_periods
        const cls = period?.timetable_classes
        if (!cls || cls.school_year !== currentSchoolYear) continue
        if (seen.has(period.id)) continue
        seen.add(period.id)
        rows.push({
          day: period.day,
          period_number: period.period_number,
          start_time: period.start_time,
          end_time: period.end_time,
          class_name: cls.name,
          period_id: period.id,
          entries: (allPeriodEntries || []).filter(e => e.period_id === period.id),
        })
      }

      const dayOrder = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4 }
      rows.sort((a, b) => dayOrder[a.day] - dayOrder[b.day] || a.period_number - b.period_number)
      setSchedule(rows)
    } catch {
      toast.error('Failed to load timetable')
    }
    setLoading(false)
  }

  // Fetch every substitution involving this teacher — either covering, or being covered for.
  async function fetchSubs() {
    setSubsLoading(true)
    const { data } = await supabase
      .from('substitutions')
      .select('*')
      .eq('school_year', currentSchoolYear)
      .or(`substitute_teacher.eq.${teacher.name},absent_teacher.eq.${teacher.name}`)
      .order('date', { ascending: false })
      .order('period_number', { ascending: true })

    const rows = data || []
    setAllSubs(rows)
    setTodaySubs(rows.filter(s => s.date === TODAY))
    setSubsLoading(false)
  }

  // ── Today's lookups (used by the grid + list) ──
  // A period I must COVER today (I'm the substitute)
  function coveringToday(periodNumber, className) {
    return todaySubs.find(s =>
      s.substitute_teacher === teacher.name &&
      s.period_number === periodNumber &&
      (className == null || s.class_name === className)
    ) || null
  }
  // My own period that someone else is covering today (I'm absent)
  function coveredForMeToday(periodNumber, className) {
    return todaySubs.find(s =>
      s.absent_teacher === teacher.name &&
      s.period_number === periodNumber &&
      s.class_name === className
    ) || null
  }

  // Substitute duties I have today that are NOT part of my regular schedule —
  // these need to be shown as extra rows.
  const extraCoverToday = todaySubs.filter(s => s.substitute_teacher === teacher.name)

  const allPeriodNumbers = [...new Set([
    ...schedule.map(s => s.period_number),
    ...extraCoverToday.map(s => s.period_number),
  ])].sort((a, b) => a - b)

  const gridData = {}
  for (const row of schedule) {
    if (!gridData[row.day]) gridData[row.day] = {}
    gridData[row.day][row.period_number] = row
  }

  const daysWithClasses = DAYS.filter(d =>
    schedule.some(s => s.day === d) || (d === TODAY_DAY && extraCoverToday.length > 0)
  )
  const activeDays = selectedDay === 'All' ? daysWithClasses : [selectedDay]
  const totalPeriods = schedule.length
  const uniqueClasses = [...new Set(schedule.map(s => s.class_name))].length

  const listByDay = daysWithClasses
    .filter(d => selectedDay === 'All' || selectedDay === d)
    .map(day => ({
      day,
      periods: schedule.filter(s => s.day === day).sort((a, b) => a.period_number - b.period_number),
      // extra cover duties only apply to today
      extras: day === TODAY_DAY
        ? extraCoverToday
          .filter(s => !schedule.some(r => r.day === day && r.period_number === s.period_number && r.class_name === s.class_name))
          .sort((a, b) => a.period_number - b.period_number)
        : [],
    }))

  // ── Month filter for the Substitutions tab ──
  // Only months that actually have substitutions, newest first.
  const availableMonths = [...new Set(allSubs.map(s => monthKey(s.date)))].sort().reverse()
  // If the current month has no subs, fall back to the newest month that does.
  const activeMonth = availableMonths.includes(subMonth)
    ? subMonth
    : (availableMonths[0] || subMonth)

  const monthSubs = allSubs.filter(s => monthKey(s.date) === activeMonth)
  const myCovering = monthSubs.filter(s => s.substitute_teacher === teacher?.name)
  const myAbsent = monthSubs.filter(s => s.absent_teacher === teacher?.name)
  // Lifetime count for the tab badge / stat box
  const coveredAllTime = allSubs.filter(s => s.substitute_teacher === teacher?.name).length

  // ── Substitution badges ──
  const CoverBadge = () => (
    <span style={{ fontSize: 9.5, background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: 4, fontWeight: 800, letterSpacing: 0.3 }}>
      SUBSTITUTE DUTY
    </span>
  )
  const AbsentBadge = () => (
    <span style={{ fontSize: 9.5, background: '#FEE2E2', color: '#991B1B', padding: '2px 6px', borderRadius: 4, fontWeight: 800, letterSpacing: 0.3 }}>
      COVERED FOR YOU
    </span>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, borderRadius: 8 } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; cursor: pointer; }
        .tt-table { border-collapse: collapse; width: 100%; }
        .tt-table th, .tt-table td { border: 1px solid #E5E5EA; }
        .day-pill { transition: all 0.15s ease; }
        .day-pill:active { transform: scale(0.95); }
        .period-card { transition: box-shadow 0.15s ease; }
        @media (hover: hover) { .period-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; } }
        @media (max-width: 600px) {
          .hw { padding: 10px 16px !important; }
          .pw { padding: 14px 14px !important; }
          .grid-wrapper { overflow-x: auto; }
        }
      `}</style>

      <AppHeader
        title={teacher?.name?.trim() || 'My Timetable'}
        showSignOut={true}
        rightExtra={
          <span style={{ color: '#48484A', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{schoolYearLabel}</span>
        }
      />

      <div className="pw" style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px' }}>

        <button onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1C1C1E', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
          <ArrowLeft /> Back to Dashboard
        </button>



        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 14, background: '#EFEFEF', borderRadius: 10, padding: 3 }}>
          {[['timetable', 'My Timetable'], ['subs', 'Substitutions']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                flex: 1, padding: '9px', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 700,
                background: tab === key ? '#1C1C1E' : 'transparent',
                color: tab === key ? '#fff' : '#636366',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {label}
              {key === 'subs' && allSubs.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: tab === key ? '#4F46E5' : '#D1D1D6', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>
                  {allSubs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════ TIMETABLE TAB ══════════ */}
        {tab === 'timetable' && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[
                { icon: <BookIcon />, val: totalPeriods, label: 'Periods/wk' },
                { icon: <UsersIcon />, val: uniqueClasses, label: 'Classes' },
                { icon: <SwapIcon />, val: coveredAllTime, label: 'Subs covered' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#1C1C1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ color: '#636366', display: 'flex' }}>{s.icon}</div>
                  <div>
                    <div style={{ color: '#F2F2F7', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ color: '#636366', fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['All', ...daysWithClasses].map(day => {
                  const active = selectedDay === day
                  const color = day !== 'All' ? DAY_COLORS[day] : null
                  return (
                    <button key={day} className="day-pill" onClick={() => setSelectedDay(day)}
                      style={{
                        padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                        border: active ? '1.5px solid transparent' : '1.5px solid #E5E5EA',
                        background: active ? (color ? color.bg : '#1C1C1E') : '#fff',
                        color: active ? (color ? color.text : '#F2F2F7') : '#636366',
                      }}>
                      {day === 'All' ? 'All Days' : DAY_SHORT[day]}
                      {day === TODAY_DAY && todaySubs.length > 0 && ' •'}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', background: '#F2F2F7', borderRadius: 8, padding: 3, gap: 2 }}>
                {[['grid', <GridIcon />], ['list', <ListIcon />]].map(([mode, icon]) => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, borderRadius: 6, border: 'none', background: viewMode === mode ? '#fff' : 'transparent', color: viewMode === mode ? '#1C1C1E' : '#8E8E93', boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>
                Loading your timetable...
              </div>
            )}

            {!loading && schedule.length === 0 && extraCoverToday.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, background: '#F2F2F7', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: '#8E8E93' }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1C1C1E', marginBottom: 6 }}>No timetable assigned</div>
                <div style={{ fontSize: 13, color: '#8E8E93' }}>Please check with the VP to get your schedule set up.</div>
              </div>
            )}

            {/* GRID VIEW */}
            {!loading && (schedule.length > 0 || extraCoverToday.length > 0) && viewMode === 'grid' && (
              <div className="grid-wrapper" style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tt-table" style={{ minWidth: activeDays.length > 1 ? 560 : 320 }}>
                    <thead>
                      <tr style={{ background: '#1C1C1E' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#636366', letterSpacing: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 120, borderRight: '1px solid #2C2C2E' }}>
                          Period
                        </th>
                        {activeDays.map(day => {
                          const c = DAY_COLORS[day]
                          const isToday = day === TODAY_DAY
                          return (
                            <th key={day} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: c.text, letterSpacing: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid #2C2C2E', background: '#1C1C1E' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
                                {day}{isToday ? ' ★' : ''}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_SLOTS.map((pNum, idx) => {
                        // Which sections does this teacher work on a given day?
                        // A teacher's break comes from the section they mostly work in,
                        // taken across the whole week — so it sits at the same slot every day.
                        const sectionsFor = () => {
                          let pre = 0, pri = 0
                          schedule.forEach(r => sectionOf(r.class_name) === 'pre' ? pre++ : pri++)
                          if (pre === 0 && pri === 0) return ['pri']
                          return [pre >= pri ? 'pre' : 'pri']
                        }
                        const allSecs = sectionsFor()
                        const metaRow = periodMeta[allSecs[0]]?.[pNum] || periodMeta.pri?.[pNum] || periodMeta.pre?.[pNum]
                        const startT = metaRow?.start_time
                        const endT = metaRow?.end_time
                        return (
                          <tr key={pNum} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                            <td style={{ padding: '13px 16px', verticalAlign: 'middle', borderRight: '1px solid #E5E5EA', background: idx % 2 === 0 ? '#FAFAFA' : '#F5F5F5' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>{ordinal(pNum)} Period</div>
                              <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'DM Mono', monospace" }}>
                                <ClockIcon /> {startT} – {endT}
                              </div>
                            </td>
                            {activeDays.map(day => {
                              const row = gridData[day]?.[pNum]
                              const c = DAY_COLORS[day]
                              const isToday = day === TODAY_DAY

                              // Extra substitute duty this period (not in my regular schedule)
                              const extraCover = isToday
                                ? extraCoverToday.find(s => s.period_number === pNum &&
                                  !(row && row.class_name === s.class_name))
                                : null

                              if (!row && !extraCover) {
                                // Break comes from the teacher's main section (one answer, same every day)
                                const onBreak = sectionsFor().some(s => periodMeta[s]?.[pNum]?.is_break)
                                // But a slot "exists" if ANY section they teach in has it —
                                // a mixed teacher taking primary classes does have slots 9 and 10.
                                const worked = new Set(schedule.map(r => sectionOf(r.class_name)))
                                const slotExists = worked.size
                                  ? [...worked].some(s => periodMeta[s]?.[pNum])
                                  : !!periodMeta.pri?.[pNum]
                                return (
                                  <td key={day} style={{
                                    padding: '12px 14px', verticalAlign: 'middle', borderRight: '1px solid #E5E5EA',
                                    background: onBreak ? '#F0FDF4' : undefined, textAlign: onBreak ? 'center' : 'left',
                                  }}>
                                    {onBreak ? (
                                      <span style={{ fontSize: 12, color: '#059669', fontWeight: 700, fontStyle: 'italic' }}>Break</span>
                                    ) : !slotExists ? (
                                      <span style={{ fontSize: 12, color: '#E5E5EA' }}>—</span>
                                    ) : (
                                      <span style={{ fontSize: 12, color: '#D1D1D6', fontStyle: 'italic' }}>Free</span>
                                    )}
                                  </td>
                                )
                              }

                              const absentSub = row && isToday ? coveredForMeToday(pNum, row.class_name) : null
                              const coverSub = row && isToday ? coveringToday(pNum, row.class_name) : null

                              return (
                                <td key={day} style={{
                                  padding: '12px 14px', verticalAlign: 'top', borderRight: '1px solid #E5E5EA',
                                  background: extraCover ? '#F0FDF4' : absentSub ? '#FFF5F5' : undefined,
                                  borderLeft: extraCover ? '3px solid #059669' : absentSub ? '3px solid #EF4444' : undefined,
                                }}>
                                  {/* My regular period */}
                                  {row && row.entries.filter(e => e.teacher_name === teacher.name).map((e, j) => (
                                    <div key={j} style={{ marginBottom: 3 }}>
                                      <div style={{
                                        fontSize: 13, fontWeight: 700,
                                        color: absentSub ? '#9CA3AF' : '#1C1C1E',
                                        textDecoration: absentSub ? 'line-through' : 'none',
                                      }}>{e.subject}</div>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, background: c.bg, color: c.text, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                                        Class {row.class_name}
                                      </div>
                                      {absentSub && (
                                        <div style={{ marginTop: 4 }}>
                                          <AbsentBadge />
                                          <div style={{ fontSize: 11, color: '#065F46', fontWeight: 700, marginTop: 3 }}>
                                            → {absentSub.substitute_teacher}
                                          </div>
                                        </div>
                                      )}
                                      {e.is_class_teacher && !absentSub && (
                                        <div style={{ marginTop: 3 }}>
                                          <span style={{ fontSize: 9.5, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 3, fontWeight: 700, letterSpacing: 0.3 }}>CLASS TEACHER</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}

                                  {/* Co-teachers on my period */}
                                  {row && row.entries.filter(e => e.teacher_name !== teacher.name).map((e, j) => (
                                    <div key={j} style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #E5E5EA' }}>
                                      <div style={{ fontSize: 11, color: '#636366' }}>{e.subject}</div>
                                      <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 1 }}>{e.teacher_name}</div>
                                    </div>
                                  ))}

                                  {/* Substitute duty (extra period I must cover today) */}
                                  {extraCover && (
                                    <div style={{ marginTop: row ? 8 : 0, paddingTop: row ? 8 : 0, borderTop: row ? '1px dashed #A7F3D0' : 'none' }}>
                                      <CoverBadge />
                                      <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46', marginTop: 4 }}>{extraCover.subject}</div>
                                      <div style={{ display: 'inline-flex', marginTop: 3, background: '#D1FAE5', color: '#065F46', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                        Class {extraCover.class_name}
                                      </div>
                                      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>
                                        covering {extraCover.absent_teacher}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid #F2F2F7', background: '#FAFAFA', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#636366', fontWeight: 600 }}>Legend</span>
                  <CoverBadge />
                  <span style={{ fontSize: 11, color: '#636366' }}>= you cover today</span>
                  <AbsentBadge />
                  <span style={{ fontSize: 11, color: '#636366' }}>= someone covers for you</span>
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, fontStyle: 'italic' }}>Break</span>
                  <span style={{ fontSize: 11, color: '#636366' }}>= your break</span>
                  <span style={{ fontSize: 11, color: '#D1D1D6', fontStyle: 'italic' }}>Free = no class</span>
                  <span style={{ fontSize: 11, color: '#E5E5EA' }}>—</span>
                  <span style={{ fontSize: 11, color: '#636366' }}>= no period</span>
                </div>
              </div>
            )}

            {/* LIST VIEW */}
            {!loading && (schedule.length > 0 || extraCoverToday.length > 0) && viewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {listByDay.map(({ day, periods, extras }) => {
                  const c = DAY_COLORS[day]
                  const isToday = day === TODAY_DAY
                  const count = periods.length + extras.length
                  return (
                    <div key={day}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.text, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                          {day}{isToday ? ' · Today' : ''}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#E5E5EA' }} />
                        <span style={{ fontSize: 11, color: '#8E8E93' }}>{count} period{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                        {/* Regular periods */}
                        {periods.map((row, idx) => {
                          const myEntries = row.entries.filter(e => e.teacher_name === teacher.name)
                          const coEntries = row.entries.filter(e => e.teacher_name !== teacher.name)
                          const absentSub = isToday ? coveredForMeToday(row.period_number, row.class_name) : null
                          return (
                            <div key={idx} className="period-card" style={{
                              background: '#fff',
                              border: `1px solid ${absentSub ? '#FECACA' : '#E5E5EA'}`,
                              borderLeft: absentSub ? '3px solid #EF4444' : '1px solid #E5E5EA',
                              borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            }}>
                              <div style={{ background: c.bg, borderRadius: 10, padding: '8px 10px', minWidth: 54, textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: 17, fontWeight: 800, color: c.text, lineHeight: 1 }}>{ordinal(row.period_number)}</div>
                                <div style={{ fontSize: 9, color: c.text, opacity: 0.7, fontWeight: 600, letterSpacing: 0.5, marginTop: 2 }}>PERIOD</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {myEntries.map((e, j) => (
                                  <div key={j} style={{ marginBottom: coEntries.length > 0 ? 8 : 0 }}>
                                    <div style={{
                                      fontSize: 15, fontWeight: 700, marginBottom: 4,
                                      color: absentSub ? '#9CA3AF' : '#1C1C1E',
                                      textDecoration: absentSub ? 'line-through' : 'none',
                                    }}>{e.subject}</div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>
                                        Class {row.class_name}
                                      </span>
                                      {e.is_class_teacher && !absentSub && (
                                        <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, letterSpacing: 0.3 }}>CLASS TEACHER</span>
                                      )}
                                      {absentSub && <AbsentBadge />}
                                    </div>
                                    {absentSub && (
                                      <div style={{ fontSize: 12, color: '#065F46', fontWeight: 700, marginTop: 5 }}>
                                        Covered by {absentSub.substitute_teacher}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {coEntries.length > 0 && (
                                  <div style={{ paddingTop: 8, borderTop: '1px dashed #E5E5EA' }}>
                                    <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>Also in this period</div>
                                    {coEntries.map((e, j) => (
                                      <div key={j} style={{ fontSize: 11, color: '#636366' }}>{e.subject} — {e.teacher_name}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: '#8E8E93', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>{row.start_time}</div>
                                <div style={{ fontSize: 9, color: '#C7C7CC', margin: '2px 0' }}>—</div>
                                <div style={{ fontSize: 11, color: '#8E8E93', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>{row.end_time}</div>
                              </div>
                            </div>
                          )
                        })}

                        {/* Extra substitute duties today */}
                        {extras.map(s => (
                          <div key={s.id} className="period-card" style={{
                            background: '#F0FDF4', border: '1px solid #A7F3D0', borderLeft: '3px solid #059669',
                            borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
                          }}>
                            <div style={{ background: '#D1FAE5', borderRadius: 10, padding: '8px 10px', minWidth: 54, textAlign: 'center', flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 800, color: '#065F46', lineHeight: 1 }}>{ordinal(s.period_number)}</div>
                              <div style={{ fontSize: 9, color: '#065F46', opacity: 0.8, fontWeight: 600, letterSpacing: 0.5, marginTop: 2 }}>PERIOD</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <CoverBadge />
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#065F46', margin: '5px 0 4px' }}>{s.subject}</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>
                                  Class {s.class_name}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 5 }}>
                                Covering for <strong style={{ color: '#374151' }}>{s.absent_teacher}</strong>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: 11, color: '#059669', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', fontWeight: 600 }}>{s.start_time}</div>
                              <div style={{ fontSize: 9, color: '#A7F3D0', margin: '2px 0' }}>—</div>
                              <div style={{ fontSize: 11, color: '#059669', fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap', fontWeight: 600 }}>{s.end_time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════ SUBSTITUTIONS TAB ══════════ */}
        {tab === 'subs' && (
          <>
            {subsLoading ? (
              <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>
                Loading substitutions…
              </div>
            ) : allSubs.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>No substitutions yet</div>
                <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
                  When you're assigned to cover a period — or when someone covers for you — it will appear here.
                </div>
              </div>
            ) : (
              <>
                {/* ── Month picker ── */}
                <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                    Select Month
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {availableMonths.map(m => {
                      const active = m === activeMonth
                      const count = allSubs.filter(x => monthKey(x.date) === m).length
                      const isCurrentMonth = m === todayStr().slice(0, 7)
                      return (
                        <button key={m} className="day-pill" onClick={() => setSubMonth(m)}
                          style={{
                            padding: '7px 13px', borderRadius: 20, fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            border: active ? '1.5px solid transparent' : '1.5px solid #E5E5EA',
                            background: active ? '#1C1C1E' : '#fff',
                            color: active ? '#F2F2F7' : '#636366',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                          {monthLabel(m)}{isCurrentMonth ? ' •' : ''}
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
                            background: active ? '#4F46E5' : '#F2F2F7',
                            color: active ? '#fff' : '#8E8E93',
                          }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── Month summary ── */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: '#065F46', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{myCovering.length}</div>
                    <div style={{ color: '#A7F3D0', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 }}>Periods you covered</div>
                  </div>
                  <div style={{ flex: 1, background: '#991B1B', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{myAbsent.length}</div>
                    <div style={{ color: '#FECACA', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 }}>Covered for you</div>
                  </div>
                </div>

                {/* ── The month's substitutions ── */}
                {monthSubs.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>
                      No substitutions in {monthLabel(activeMonth)}
                    </div>
                    <div style={{ fontSize: 13, color: '#8E8E93' }}>Pick another month above.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#636366', marginBottom: 8, paddingLeft: 2 }}>
                      {monthLabel(activeMonth)} · {monthSubs.length} substitution{monthSubs.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {monthSubs.map(s => {
                        const iCover = s.substitute_teacher === teacher.name
                        const isToday = s.date === TODAY
                        return (
                          <div key={s.id} style={{
                            background: '#fff',
                            border: `1px solid ${iCover ? '#A7F3D0' : '#FECACA'}`,
                            borderLeft: `3px solid ${iCover ? '#059669' : '#EF4444'}`,
                            borderRadius: 12, padding: '13px 15px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                {iCover ? <CoverBadge /> : <AbsentBadge />}
                                {isToday && (
                                  <span style={{ fontSize: 9.5, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>TODAY</span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 600 }}>{fmtDate(s.date)}</span>
                            </div>

                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ background: iCover ? '#D1FAE5' : '#FEE2E2', borderRadius: 9, padding: '7px 9px', minWidth: 50, textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: iCover ? '#065F46' : '#991B1B', lineHeight: 1 }}>{ordinal(s.period_number)}</div>
                                <div style={{ fontSize: 8.5, color: iCover ? '#065F46' : '#991B1B', opacity: 0.75, fontWeight: 700, marginTop: 2 }}>PERIOD</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{s.subject}</div>
                                <div style={{ fontSize: 11, color: '#047857', fontWeight: 600, marginTop: 2 }}>Class {s.class_name}</div>
                                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 5 }}>
                                  {iCover
                                    ? <>You covered for <strong style={{ color: '#374151' }}>{s.absent_teacher}</strong></>
                                    : <><strong style={{ color: '#374151' }}>{s.substitute_teacher}</strong> covered for you</>
                                  }
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontSize: 11, color: '#8E8E93', fontFamily: "'DM Mono', monospace" }}>{s.start_time}</div>
                                <div style={{ fontSize: 9, color: '#C7C7CC' }}>—</div>
                                <div style={{ fontSize: 11, color: '#8E8E93', fontFamily: "'DM Mono', monospace" }}>{s.end_time}</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}