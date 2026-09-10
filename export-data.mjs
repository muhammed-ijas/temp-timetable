// ══════════════════════════════════════════════════════════════════
//  export-data.mjs  —  ONE-OFF DATA EXPORT (temporary file)
//
//  Dumps every table from Supabase into JSON files, ready to be
//  transformed and imported into the ERP's MongoDB.
//
//  ── HOW TO USE ──
//  1. Put this file in your project ROOT
//     (C:\Users\DELL\Projects\PGS-Leave-Application-Form\)
//  2. In the terminal, run:      node export-data.mjs
//  3. A folder called  export/  is created with one .json per table,
//     plus  _ALL_DATA.json  containing everything in one file.
//  4. Open the files in VS Code and copy what you need.
//  5. DELETE this file when the migration is done.
// ══════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// ── Your Supabase credentials (same as src/lib/supabase.js) ──
const SUPABASE_URL = 'https://jrspuqjznhmdgfwiefbz.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyc3B1cWp6bmhtZGdmd2llZmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTQ3NDYsImV4cCI6MjA5MzI5MDc0Nn0.dQYai7rLv1N9Y_XjrYwpIpEgIdc2cqKUbv5AQzoZh-U'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Tables to export ──
const TABLES = [
  'students',
  'marks',
  'teacher_diary',
  'timetable_classes',
  'timetable_periods',
  'timetable_entries',
  'substitutions',
  'leave_requests',
  'leave_balances',
  'special_leaves',
  'holidays',
]

// ── Staff list (lives in code, not the database) ──
const TEACHERS = [
  { name: 'Abshar khatoon', phone: '8336936540', pin: '6104' },
  { name: 'Afreen Sultana', phone: '9382281994', pin: '7415' },
  { name: 'Anirban Dutta', phone: '9932635565', pin: '0495' },
  { name: 'Gulfiishan Nikhat', phone: '9883040767', pin: '2467' },
  { name: 'Kainat Hossain', phone: '7596905870', pin: '3094' },
  { name: 'Kazi Sadiqur Rahaman', phone: '9681153603', pin: '8536' },
  { name: 'Megha Barui', phone: '8017054621', pin: '2758' },
  { name: 'Mohamed Lukhman A', phone: '9605611076', pin: '5047' },
  { name: 'Mohd Ashique Raza', phone: '7070312177', pin: '5819' },
  { name: 'Mohd Fasihul Qamar', phone: '7504752690', pin: '7283' },
  { name: 'Muhammed Arif P A', phone: '9995389526', pin: '8361' },
  { name: 'Muhammed Ijas T', phone: '8777604239', pin: '3518' },
  { name: 'Munazza Tabrez', phone: '9123323282', pin: '6381' },
  { name: 'Nafisa Hossain', phone: '9903488135', pin: '1692' },
  { name: 'Nayab khan', phone: '6290400755', pin: '9153' },
  { name: 'Nilakshi Khatoon', phone: '8777218646', pin: '5247' },
  { name: 'Rupali Sekh', phone: '8961002132', pin: '7342' },
  { name: 'Sabiha Yasmin', phone: '8013504747', pin: '9032' },
  { name: 'Saima Bux Siddiqui', phone: '8337083439', pin: '4720' },
  { name: 'Samprikta Chakraborty', phone: '9875637877', pin: '1678' },
  { name: 'Shavian Affrin', phone: '9057267373', pin: '4775' },
  { name: 'Tahera Khatoon', phone: '9831779496', pin: '4923' },
  { name: 'Zohra Anwar', phone: '8420618610', pin: '3869' },
]

// ── Class teachers (also lives in code) ──
const CLASS_TEACHERS = {
  '8': 'Gulfiishan Nikhat',
  '7': 'Sabiha Yasmin',
  '6': 'Megha Barui',
  '5': 'Samprikta Chakraborty',
  '4': 'Shavian Affrin',
  '3': 'Nilakshi Khatoon',
  '2': 'Tahera Khatoon',
  '1': 'Munazza Tabrez',
  'UKG': 'Kainat Hossain',
  'LKG': 'Nayab khan',
  'Nursery': 'Saima Bux Siddiqui',
}

const OUT_DIR = 'export'

// Supabase returns max 1000 rows per request, so page through everything.
async function fetchAll(table) {
  const PAGE = 1000
  let from = 0
  let all = []
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) {
      console.log(`   ✗ ${table}: ${error.message}`)
      return { rows: [], error: error.message }
    }
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }
  return { rows: all, error: null }
}

async function main() {
  console.log('')
  console.log('═══════════════════════════════════════')
  console.log('  PGS — Exporting all data to JSON')
  console.log('═══════════════════════════════════════')
  console.log('')

  mkdirSync(OUT_DIR, { recursive: true })

  const everything = {
    exported_at: new Date().toISOString(),
    source: 'PGS temporary staff portal (Supabase)',
    teachers: TEACHERS,
    class_teachers: CLASS_TEACHERS,
  }

  const summary = []

  for (const table of TABLES) {
    process.stdout.write(`   Exporting ${table} ... `)
    const { rows, error } = await fetchAll(table)

    if (error) {
      summary.push({ table, count: 0, status: 'FAILED — ' + error })
      continue
    }

    everything[table] = rows
    writeFileSync(
      join(OUT_DIR, `${table}.json`),
      JSON.stringify(rows, null, 2),
      'utf8'
    )
    console.log(`${rows.length} rows ✓`)
    summary.push({ table, count: rows.length, status: 'ok' })
  }

  // Staff + class teachers as their own files too
  writeFileSync(join(OUT_DIR, 'teachers.json'), JSON.stringify(TEACHERS, null, 2), 'utf8')
  writeFileSync(join(OUT_DIR, 'class_teachers.json'), JSON.stringify(CLASS_TEACHERS, null, 2), 'utf8')

  // One combined file with everything
  writeFileSync(join(OUT_DIR, '_ALL_DATA.json'), JSON.stringify(everything, null, 2), 'utf8')

  console.log('')
  console.log('───────────────────────────────────────')
  console.log('  SUMMARY')
  console.log('───────────────────────────────────────')
  for (const s of summary) {
    console.log(`   ${s.table.padEnd(22)} ${String(s.count).padStart(6)}   ${s.status}`)
  }
  console.log(`   ${'teachers (from code)'.padEnd(22)} ${String(TEACHERS.length).padStart(6)}   ok`)
  console.log('')
  console.log(`  ✓ Files written to the "${OUT_DIR}" folder`)
  console.log(`  ✓ Combined file: ${OUT_DIR}/_ALL_DATA.json`)
  console.log('')
  console.log('  Open them in VS Code and copy what you need.')
  console.log('  Delete this script when the migration is done.')
  console.log('')
}

main().catch(err => {
  console.error('')
  console.error('  ✗ Export failed:', err.message)
  console.error('')
})
