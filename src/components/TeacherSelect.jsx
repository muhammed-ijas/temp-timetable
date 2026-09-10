import { TEACHERS } from '../lib/supabase'

export default function TeacherSelect({ selectedTeacher, onSelect }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 }}>
        Select Your Name
      </label>
      <select
        value={selectedTeacher?.name || ''}
        onChange={e => onSelect(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 5, border: '1px solid #D1D5DB', fontSize: 14, background: '#FAFAFA', color: '#111827', cursor: 'pointer' }}>
        <option value="">— Choose your name —</option>
        {TEACHERS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>
    </div>
  )
}