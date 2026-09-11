import { supabase, getSchoolYear } from './supabase'

// ── Timetable versions ──────────────────────────────────────────
// Several timetables can live side by side. Every timetable_entries
// row carries a version_id. Exactly one version is "active" — the
// one the Subjects page and prints look at.

export async function listVersions() {
  const { data } = await supabase.from('timetable_versions').select('*')
    .eq('school_year', getSchoolYear()).order('created_at')
  return data || []
}

export async function getActiveVersionId() {
  const { data } = await supabase.from('timetable_versions').select('id')
    .eq('school_year', getSchoolYear()).eq('is_active', true).limit(1)
  return data?.[0]?.id || null
}

export async function setActiveVersion(id) {
  await supabase.from('timetable_versions').update({ is_active: false }).eq('school_year', getSchoolYear())
  await supabase.from('timetable_versions').update({ is_active: true }).eq('id', id)
}

// Create a version; copyFromId copies that version's entries into the new one.
export async function createVersion(name, copyFromId = null) {
  const { data: v, error } = await supabase.from('timetable_versions')
    .insert({ name, school_year: getSchoolYear() }).select().single()
  if (error) throw error
  if (copyFromId) {
    const { data: rows } = await supabase.from('timetable_entries')
      .select('period_id, subject, teacher_name, is_class_teacher').eq('version_id', copyFromId)
    if (rows?.length) {
      await supabase.from('timetable_entries').insert(rows.map(r => ({ ...r, version_id: v.id })))
    }
  }
  return v
}

export async function renameVersion(id, name) {
  await supabase.from('timetable_versions').update({ name }).eq('id', id)
}

// Deleting a version deletes its entries (cascade).
export async function deleteVersion(id) {
  await supabase.from('timetable_versions').delete().eq('id', id)
}