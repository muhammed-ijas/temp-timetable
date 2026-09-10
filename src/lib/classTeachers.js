// ══════════════════════════════════════════════════════════════════
//  classTeachers.js  —  SINGLE SOURCE OF TRUTH for class teachers.
//
//  Whenever a class teacher changes, edit ONLY this file.
//  Every page that needs class-teacher info imports from here,
//  so one change updates the whole app.
//
//  Names must match EXACTLY the names in supabase.js TEACHERS list.
// ══════════════════════════════════════════════════════════════════

// class name  ->  class teacher's exact name
export const CLASS_TEACHERS = {
  '8': 'Gulfishan Nikhat',
  '7': 'Sabiha Yasmin',
  '6': 'Megha Barui',
  '5': 'Samprikta Chakraborty',
  '4': 'Shavian Affrin',
  '3': 'Nilakshi Khatoon',
  '2': 'Afreen Sultana',
  '1': 'Munazza Tabrez',
  'UKG': 'Kainat Hossain',
  'LKG': 'Nayab khan',
  'Nursery': 'Saima Bux Siddiqui',
}

// Reverse lookup: teacher name -> the class they are class teacher of.
// Returns the class string (e.g. '4', 'UKG') or null if not a class teacher.
export function getClassOfTeacher(teacherName) {
  if (!teacherName) return null
  const name = teacherName.trim()
  for (const cls in CLASS_TEACHERS) {
    if (CLASS_TEACHERS[cls] === name) return cls
  }
  return null
}

// Quick check: is this teacher a class teacher of any class?
export function isClassTeacher(teacherName) {
  return getClassOfTeacher(teacherName) !== null
}

// Array of all class-teacher names (handy for lists/filters).
export const CLASS_TEACHER_NAMES = Object.values(CLASS_TEACHERS)