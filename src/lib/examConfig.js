// ══════════════════════════════════════════════════════════════════
//  examConfig.js  —  SINGLE SOURCE OF TRUTH for the marks structure.
//
//  If VP ever wants to change components or max marks for a class,
//  edit ONLY this file and re-run. Every marks page reads from here.
//
//  This controls the *structure* (what components exist + their max
//  marks) — NOT the marks students get. VP edits marks in the app;
//  the structure lives here in code.
//
//  ── HOW TO EDIT ──
//  • Change LAT months for everyone → edit LAT_MONTHS below.
//  • Change one class's components → edit that class in CLASS_COMPONENTS.
//    (Each class is independent — editing Class 5 won't touch others.)
//  • Fill in Nursery/LKG/UKG later → replace their [] with components.
// ══════════════════════════════════════════════════════════════════

// ── LAT (Learners Achievement Test) — SHARED across all classes ──
// One entry per month, LAT_MAX marks each.
// A score of LAT_RED_AT or below shows in red.
export const LAT_MONTHS = ['April', 'May', 'June', 'July', 'August']
export const LAT_MAX = 10
export const LAT_RED_AT = 4   // scores <= 4 show red

// ── Half-Yearly exam — one mark per subject, per class ──
//   Classes 1–3 → 30 · Classes 4–5 → 50 · Classes 6–8 → 70
//   3rd Language Hindi override: Classes 5–8 → 40 (Bengali uses the class max)
//   Pre-primary has no half-yearly for now.
const HALFYEARLY_MAX = {
  '1': 30, '2': 30, '3': 30,
  '4': 50, '5': 50,
  '6': 70, '7': 70, '8': 70,
}
// Only 3rd Language HINDI has its own max. 3rd Language Bengali follows the
// normal class max above (Class 5 → 50, Classes 6–8 → 70).
const HALFYEARLY_MAX_THIRD_LANG_HINDI = {
  '5': 40,
  '6': 40, '7': 40, '8': 40,
}

// 3rd Language *Hindi* specifically — e.g. "3 rd L - Hindi".
export function isThirdLanguageHindi(subject) {
  if (!isThirdLanguage(subject)) return false
  return String(subject).toLowerCase().includes('hindi')
}

// Does this subject name mean the Third Language slot?
// Matches "3 rd L - Hindi", "3 rd L - Bengali", "3rd L", etc.
// Does NOT match 2nd L, or core Hindi/Bengali.
export function isThirdLanguage(subject) {
  if (!subject) return false
  const n = String(subject).toLowerCase().replace(/[^a-z0-9]/g, '')
  return n.startsWith('3rdl') || n.startsWith('3l') || n.startsWith('thirdl')
}

// Half-yearly max for a (class, subject). Subject optional — omit it and you
// get the plain class max with no Third-Language exception.
export function getHalfYearlyMax(className, subject) {
  const k = classKey(className)
  if (isThirdLanguageHindi(subject) && HALFYEARLY_MAX_THIRD_LANG_HINDI[k] != null) {
    return HALFYEARLY_MAX_THIRD_LANG_HINDI[k]
  }
  return HALFYEARLY_MAX[k] ?? null
}

// Same shape as formative: array of { key, label, max }.
export function getHalfYearlyComponents(className, subject) {
  const k = classKey(className)
  if (HALFYEARLY_MAX[k] == null) return []   // pre-primary / not configured
  return [{ key: 'halfyearly', label: 'Half-Yearly', max: getHalfYearlyMax(className, subject) }]
}
// ── Formative components PER CLASS ──
// Each component: { key, label, max }.
// key = stable id stored in the database (keep short, don't rename casually).
// Every class has its own list so you can edit one class without affecting others.
export const CLASS_COMPONENTS = {
  // ── Classes 1–3: Unit Test only ──
  '1': [
    { key: 'unit_test', label: 'Unit Test', max: 20 },
  ],
  '2': [
    { key: 'unit_test', label: 'Unit Test', max: 20 },
  ],
  '3': [
    { key: 'unit_test', label: 'Unit Test', max: 20 },
  ],

  // ── Classes 4–5: Unit Test + Class Work + Home Work ──
  '4': [
    { key: 'unit_test',  label: 'Unit Test',  max: 20 },
    { key: 'class_work', label: 'Class Work', max: 5 },
    { key: 'home_work',  label: 'Home Work',  max: 5 },
  ],
  '5': [
    { key: 'unit_test',  label: 'Unit Test',  max: 20 },
    { key: 'class_work', label: 'Class Work', max: 5 },
    { key: 'home_work',  label: 'Home Work',  max: 5 },
  ],

  // ── Classes 6–8: Unit Test + Class Work + Home Work ──
  '6': [
    { key: 'unit_test',  label: 'Unit Test',  max: 20 },
    { key: 'class_work', label: 'Class Work', max: 5 },
    { key: 'home_work',  label: 'Home Work',  max: 5 },
  ],
  '7': [
    { key: 'unit_test',  label: 'Unit Test',  max: 20 },
    { key: 'class_work', label: 'Class Work', max: 5 },
    { key: 'home_work',  label: 'Home Work',  max: 5 },
  ],
  '8': [
    { key: 'unit_test',  label: 'Unit Test',  max: 20 },
    { key: 'class_work', label: 'Class Work', max: 5 },
    { key: 'home_work',  label: 'Home Work',  max: 5 },
  ],

  // ── Pre-primary: to be filled in later ──
  'Nursery': [],
  'LKG': [],
  'UKG': [],
}

// ── Normalise a class name to its config key ──
// Timetable stores names like "4 A", "Nursery A", "8 B". The marks
// structure is per class (not per section), so we strip the section.
//   "4 A"        -> "4"
//   "8"          -> "8"
//   "Nursery A"  -> "Nursery"
//   "LKG"        -> "LKG"
export function classKey(className) {
  if (!className) return ''
  const name = className.trim()

  // Numeric classes: grab the leading number → "4 A" becomes "4"
  const numMatch = name.match(/^(\d+)/)
  if (numMatch) return numMatch[1]

  // Named pre-primary classes: match the known word, ignore the section
  const lower = name.toLowerCase()
  if (lower.startsWith('nursery')) return 'Nursery'
  if (lower.startsWith('lkg')) return 'LKG'
  if (lower.startsWith('ukg')) return 'UKG'

  // Fallback: whole trimmed name
  return name
}

// ── Get the formative components for a given class ──
// Returns the class's component list, or [] if the class isn't configured.
export function getFormativeComponents(className) {
  if (!className) return []
  return CLASS_COMPONENTS[classKey(className)] || []
}

// ── Is this class part of the marks structure (has components set up)? ──
// Nursery/LKG/UKG currently return false because their lists are empty.
export function isMarksClass(className) {
  const comps = getFormativeComponents(className)
  return comps.length > 0
}

// ══════════════════════════════════════════════════════════════════
//  SUBJECT MERGING (marks only — does NOT affect the timetable)
//
//  In some classes, several timetable subjects are examined together
//  as ONE subject. Example: Classes 6–8 teach Physics, Chemistry and
//  Biology as separate periods, but the exam is a single "Science".
//
//  To change this later: edit SUBJECT_MERGES below.
//    • classes  — which classes the rule applies to (by classKey)
//    • from      — the timetable subjects that get merged (case-insensitive)
//    • into      — the single subject name shown for marks
// ══════════════════════════════════════════════════════════════════
export const SUBJECT_MERGES = [
  {
    classes: ['6', '7', '8'],
    from: ['Physics', 'Chemistry', 'Biology'],
    into: 'Science',
  },
]

// Given a class + a timetable subject, return the subject to use for MARKS.
// If the subject is part of a merge for that class, returns the merged name
// (e.g. "Science"); otherwise returns the original subject unchanged.
export function mergedSubject(className, subject) {
  if (!subject) return subject
  const key = classKey(className)
  const sub = subject.trim().toLowerCase()
  for (const rule of SUBJECT_MERGES) {
    if (rule.classes.includes(key) && rule.from.some(f => f.toLowerCase() === sub)) {
      return rule.into
    }
  }
  return subject
}

// Is this (class, subject) a merged subject? (e.g. Class 7 + "Science")
// Used when we need to know a subject represents several timetable subjects.
export function isMergedSubject(className, subject) {
  if (!subject) return false
  const key = classKey(className)
  const sub = subject.trim().toLowerCase()
  return SUBJECT_MERGES.some(r => r.classes.includes(key) && r.into.toLowerCase() === sub)
}

// Get the original timetable subjects that make up a merged subject.
// e.g. mergedSourceSubjects('7', 'Science') -> ['Physics','Chemistry','Biology']
export function mergedSourceSubjects(className, subject) {
  if (!subject) return []
  const key = classKey(className)
  const sub = subject.trim().toLowerCase()
  const rule = SUBJECT_MERGES.find(r => r.classes.includes(key) && r.into.toLowerCase() === sub)
  return rule ? rule.from : []
}