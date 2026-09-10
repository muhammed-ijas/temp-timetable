// ══════════════════════════════════════════════════════════════════
//  bundle-code.mjs  —  dump all source files into ONE text file.
//
//  Makes  project-code.txt  containing every source file with a clear
//  header before each, so you can hand the whole codebase to a chat.
//
//  ── HOW TO USE ──
//  1. Put this file in your project ROOT
//  2. Run:   node bundle-code.mjs
//  3. It creates  project-code.txt  in the root
//  4. Upload/paste that file into the new chat
//  5. Delete this script when done (optional)
//
//  Skips node_modules, build output, images, and secret-bearing files.
// ══════════════════════════════════════════════════════════════════

import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs'
import { join, extname, relative } from 'path'

const ROOT = process.cwd()
const OUT = 'project-code.txt'

// Only include these file types (source code + config)
const INCLUDE_EXT = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json']

// Never walk into these folders
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.git', 'export',
  'export-before-migration', '.vercel', 'coverage', '.next',
])

// Never include these specific files (secrets / noise / this script)
const SKIP_FILES = new Set([
  'package-lock.json', 'bundle-code.mjs', 'export-data.mjs',
  'project-code.txt',
])

const collected = []

function walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }

    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue
      walk(full)
    } else {
      if (SKIP_FILES.has(name)) continue
      if (!INCLUDE_EXT.includes(extname(name))) continue
      // Skip very large files (likely data, not code)
      if (st.size > 400 * 1024) continue
      collected.push(full)
    }
  }
}

walk(ROOT)
collected.sort()

let out = ''
out += '═'.repeat(70) + '\n'
out += '  PGS STAFF PORTAL — FULL SOURCE CODE BUNDLE\n'
out += '  Generated: ' + new Date().toISOString() + '\n'
out += '  Files: ' + collected.length + '\n'
out += '═'.repeat(70) + '\n\n'

// A quick index first
out += 'FILE INDEX:\n'
for (const f of collected) {
  out += '  - ' + relative(ROOT, f).replace(/\\/g, '/') + '\n'
}
out += '\n' + '═'.repeat(70) + '\n\n'

// Then each file with a header
for (const f of collected) {
  const rel = relative(ROOT, f).replace(/\\/g, '/')
  let content = ''
  try { content = readFileSync(f, 'utf8') } catch { content = '[could not read]' }
  out += '\n'
  out += '┌' + '─'.repeat(68) + '\n'
  out += '│ FILE: ' + rel + '\n'
  out += '└' + '─'.repeat(68) + '\n\n'
  out += content
  out += '\n\n'
}

writeFileSync(OUT, out, 'utf8')

console.log('')
console.log('  ✓ Bundled ' + collected.length + ' files into ' + OUT)
console.log('  ✓ Upload that file to the new chat')
console.log('')
console.log('  NOTE: this bundle includes src/lib/supabase.js, which')
console.log('  contains your Supabase key and teacher PINs. Only share')
console.log('  it with the chat — do NOT commit project-code.txt to GitHub.')
console.log('')
