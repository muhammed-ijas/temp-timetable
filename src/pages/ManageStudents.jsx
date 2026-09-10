import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { supabase, getSchoolYear, getSchoolYearLabel } from '../lib/supabase'
import { getClassOfTeacher } from '../lib/classTeachers'

// ── Icons ──
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
)
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
)
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
)

export default function ManageStudents() {
  const navigate = useNavigate()
  const location = useLocation()
  const teacher = location.state?.teacher

  const currentSchoolYear = getSchoolYear()
  const schoolYearLabel = getSchoolYearLabel(currentSchoolYear)

  const myClass = teacher ? getClassOfTeacher(teacher.name) : null

  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRoll, setEditRoll] = useState('')

  useEffect(() => {
    if (!teacher) { navigate('/login', { replace: true }); return }
    if (myClass) fetchStudents()
    else setLoading(false)
  }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('class_name', myClass)
      .eq('school_year', currentSchoolYear)
      .order('roll_number', { ascending: true })
    setStudents(data || [])
    setLoading(false)
  }

  async function addStudent() {
    if (!name.trim() || roll === '') { toast.error('Enter name and roll number'); return }
    setSaving(true)
    const t = toast.loading('Adding student…')
    const { error } = await supabase.from('students').insert({
      class_name: myClass,
      roll_number: Number(roll),
      name: name.trim(),
      school_year: currentSchoolYear,
      created_by: teacher.name,
    })
    if (error) {
      if (error.code === '23505') toast.error('Roll number already exists in this class', { id: t })
      else toast.error('Failed: ' + error.message, { id: t })
    } else {
      toast.success('Student added ✓', { id: t, duration: 2500 })
      setName(''); setRoll('')
      await fetchStudents()
    }
    setSaving(false)
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditName(s.name)
    setEditRoll(String(s.roll_number))
  }

  async function saveEdit(id) {
    if (!editName.trim() || editRoll === '') { toast.error('Enter name and roll number'); return }
    const t = toast.loading('Saving…')
    const { error } = await supabase.from('students')
      .update({ name: editName.trim(), roll_number: Number(editRoll) })
      .eq('id', id)
    if (error) {
      if (error.code === '23505') toast.error('Roll number already exists', { id: t })
      else toast.error('Failed: ' + error.message, { id: t })
    } else {
      toast.success('Saved ✓', { id: t, duration: 2000 })
      setEditingId(null)
      await fetchStudents()
    }
  }

  async function deleteStudent(s) {
    if (!window.confirm(`Delete ${s.name} (Roll ${s.roll_number})?\n\nThis cannot be undone.`)) return
    const t = toast.loading('Deleting…')
    const { error } = await supabase.from('students').delete().eq('id', s.id)
    if (error) toast.error('Failed: ' + error.message, { id: t })
    else { toast.success('Deleted', { id: t, duration: 2000 }); await fetchStudents() }
  }

  if (!teacher) return null

  // ── Not a class teacher ──
  if (!myClass) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        <header style={{ background: '#1C1C1E', padding: '0 14px', height: 54, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/dashboard', { state: { teacher } })}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
            <ArrowLeftIcon /> Dashboard
          </button>
          <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 700 }}>My Students</div>
        </header>
        <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 16px' }}>
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1C1E', marginBottom: 8 }}>Only class teachers can manage students</div>
            <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.6 }}>
              You are not set as a class teacher, so there's no student list for you to manage. If this is a mistake, contact the admin.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 600, borderRadius: 10 } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, button { font-family: inherit; }
        input:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #E5E5EA; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header style={{ background: '#1C1C1E', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 14px', height: 54, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => navigate('/dashboard', { state: { teacher } })}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
              <ArrowLeftIcon /> Dashboard
            </button>
            <div>
              <div style={{ color: '#F2F2F7', fontSize: 14, fontWeight: 700 }}>My Students</div>
              <div style={{ color: '#636366', fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>Class {myClass} · {teacher.name?.trim()}</div>
            </div>
          </div>
          <span style={{ color: '#48484A', fontSize: 10, fontFamily: 'monospace' }}>{schoolYearLabel}</span>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 14px' }}>

        {/* Class banner */}
        <div style={{ background: '#1C1C1E', borderRadius: 14, padding: '16px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>Your Class</div>
            <div style={{ color: '#F2F2F7', fontSize: 20, fontWeight: 700 }}>Class {myClass}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#F2F2F7', fontSize: 24, fontWeight: 800 }}>{students.length}</div>
            <div style={{ color: '#636366', fontSize: 11 }}>student{students.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Add student */}
        <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#636366', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Add Student</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ width: 90 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Roll No.</label>
              <input type="number" min={1} value={roll} onChange={e => setRoll(e.target.value)} placeholder="1"
                onKeyDown={e => e.key === 'Enter' && addStudent()}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 14, color: '#1C1C1E', background: '#FAFAFA' }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>Student Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                onKeyDown={e => e.key === 'Enter' && addStudent()}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E5EA', fontSize: 14, color: '#1C1C1E', background: '#FAFAFA' }} />
            </div>
            <button onClick={addStudent} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1C1C1E', color: '#fff', border: 'none', padding: '11px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              <PlusIcon /> Add
            </button>
          </div>
        </div>

        {/* Student list */}
        <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', fontSize: 12, fontWeight: 700, color: '#1C1C1E' }}>
            Class {myClass} — Student List
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Loading…</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>No students yet. Add your first student above.</div>
          ) : (
            students.map((s, idx) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: idx < students.length - 1 ? '1px solid #F9F9F9' : 'none', background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                {editingId === s.id ? (
                  <>
                    <input type="number" value={editRoll} onChange={e => setEditRoll(e.target.value)}
                      style={{ width: 70, padding: '7px 9px', borderRadius: 6, border: '1px solid #1C1C1E', fontSize: 13, background: '#fff' }} />
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ flex: 1, padding: '7px 9px', borderRadius: 6, border: '1px solid #1C1C1E', fontSize: 13, background: '#fff' }} />
                    <button onClick={() => saveEdit(s.id)} style={{ background: '#1C1C1E', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: '#F2F2F7', color: '#636366', border: 'none', padding: '7px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#1C1C1E', flexShrink: 0 }}>
                      {s.roll_number}
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1C1C1E' }}>{s.name}</div>
                    <button onClick={() => startEdit(s)} style={{ background: '#F2F2F7', color: '#636366', border: 'none', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex' }}><EditIcon /></button>
                    <button onClick={() => deleteStudent(s)} style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex' }}><TrashIcon /></button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: '#C7C7CC', textAlign: 'center' }}>
          Only you (the class teacher of Class {myClass}) can manage this list.
        </div>
      </div>
    </div>
  )
}