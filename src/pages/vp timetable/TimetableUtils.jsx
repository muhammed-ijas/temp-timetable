// ─── Constants ────────────────────────────────────────────────────────────────

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// ── Period layouts ────────────────────────────────────────────────────────────
// The break is its own numbered slot, so a slot number means the same clock
// time in every class. Pre-primary breaks at slot 4, primary at slot 6.

// Nursery / LKG / UKG — 7 slots (UKG also uses slot 8)
export const PREPRIMARY_PERIODS = [
  { period_number: 1, start_time: '08:00', end_time: '08:15', is_break: true, break_label: 'Welcome Time' },
  { period_number: 2, start_time: '08:15', end_time: '08:50' },
  { period_number: 3, start_time: '08:50', end_time: '09:25' },
  { period_number: 4, start_time: '09:25', end_time: '10:00' },
  { period_number: 5, start_time: '10:00', end_time: '10:35', is_break: true, break_label: 'Break' },
  { period_number: 6, start_time: '10:35', end_time: '11:10' },
  { period_number: 7, start_time: '11:10', end_time: '11:45' },
  { period_number: 8, start_time: '11:45', end_time: '12:20' },
  { period_number: 9, start_time: '12:20', end_time: '12:20', is_break: true, break_label: 'Dispersal' },
]
// Classes 1–8 — 10 slots
export const PRIMARY_PERIODS = [
  { period_number: 1,  start_time: '08:15', end_time: '08:50' },
  { period_number: 2,  start_time: '08:50', end_time: '09:25' },
  { period_number: 3,  start_time: '09:25', end_time: '10:00' },
  { period_number: 4,  start_time: '10:00', end_time: '10:35' },
  { period_number: 5,  start_time: '10:35', end_time: '11:10', is_break: true, break_label: 'Break' },
  { period_number: 6,  start_time: '11:10', end_time: '11:45' },
  { period_number: 7,  start_time: '11:45', end_time: '12:20' },
  { period_number: 8,  start_time: '12:20', end_time: '12:55' },
  { period_number: 9,  start_time: '12:55', end_time: '13:30' },
  { period_number: 10, start_time: '13:30', end_time: '13:30', is_break: true, break_label: 'Dispersal' },
]

export function isPrePrimaryClass(className) {
  const n = (className || '').trim().toLowerCase()
  return n.startsWith('nursery') || n.startsWith('lkg') || n.startsWith('ukg') || n.startsWith('balvatika')
}

// Correct period layout for a class name.
// Nursery/LKG stop at slot 7; UKG also gets slot 8.
export function getDefaultPeriods(className) {
  if (!isPrePrimaryClass(className)) return PRIMARY_PERIODS
  const n = (className || '').trim().toLowerCase()
  return PREPRIMARY_PERIODS
}

// Kept so existing imports don't break
export const DEFAULT_PERIODS = PRIMARY_PERIODS

export const DEFAULT_CLASSES = [
  'Balvatika 1','Balvatika 2','Balvatika 3','1','2','3','4','5','6','7','8',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function ordinalPeriod(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0]) + ' Period'
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

export const Icons = {
  Timetable: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Load: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  Free: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Substitution: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5"/>
      <path d="M21 3L9 15"/>
      <path d="M8 21H3v-5"/>
      <path d="M3 21l12-12"/>
    </svg>
  ),
  Print: () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
),
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

export const PURPLE_DARK  = '#3B0764'
export const PURPLE_MID   = '#5B21B6'
export const PURPLE_LIGHT = '#EDE9FE'
export const PURPLE_BORDER = '#DDD6FE'