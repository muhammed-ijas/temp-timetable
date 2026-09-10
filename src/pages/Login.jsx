import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import { TEACHERS } from '../lib/supabase'


const SESSION_KEY = 'pgs_teacher_session'

function saveSession(teacher) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    name: teacher.name,
    savedAt: Date.now()
  }))
}

const ShieldIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ── Initials avatar ───────────────────────────────────────────────
function Avatar({ name, size = 32, dark = false }) {
  const initials = name.trim().split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: dark ? '#1C1C1E' : '#F2F2F7',
      color: dark ? '#fff' : '#636366',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, letterSpacing: 0.5,
    }}>
      {initials}
    </div>
  )
}

// ── Highlight matching text ───────────────────────────────────────
function HighlightText({ text, query }) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ fontWeight: 700, background: '#FEF9C3', borderRadius: 3, padding: '0 2px', color: '#92400E' }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  )
}

// ── Searchable Name Picker ────────────────────────────────────────
function NamePicker({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const containerRef = useRef(null)

  const filtered = TEACHERS.filter(t =>
    t.name.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    if (listRef.current && open) {
      const item = listRef.current.children[highlighted]
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted, open])

  function handleSelect(teacher) {
    onChange(teacher)
    setQuery('')
    setOpen(false)
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleInputClick() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e) {
    if (!open) { setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) handleSelect(filtered[highlighted]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* Trigger box */}
      <div onClick={handleInputClick} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: open ? '#fff' : '#F8F9FB',
        border: `2px solid ${open ? '#1C1C1E' : '#E5E5EA'}`,
        borderRadius: open ? '12px 12px 0 0' : 12,
        padding: '12px 14px',
        cursor: 'text',
        transition: 'border-color 0.15s, border-radius 0.15s',
      }}>

        {/* Left icon: avatar if selected, search icon if not */}
        {value && !open
          ? <Avatar name={value.name} size={30} dark />
          : <div style={{ color: '#AEAEB2', flexShrink: 0, display: 'flex' }}><SearchIcon /></div>
        }

        {/* Input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {value && !open ? (
            // Show selected name as static text when closed
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{value.name}</div>
              <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>Tap to change</div>
            </div>
          ) : (
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              placeholder={value ? value.name : 'Type your name to search...'}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: '#1C1C1E', width: '100%', fontFamily: 'inherit',
              }}
            />
          )}
        </div>

        {/* Right: clear + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {value && (
            <button onClick={handleClear} style={{
              width: 22, height: 22, borderRadius: '50%', background: '#F2F2F7',
              border: 'none', cursor: 'pointer', color: '#636366',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <XIcon />
            </button>
          )}
          <div style={{ color: '#AEAEB2', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'flex' }}>
            <ChevronDown />
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: '#fff',
          border: '2px solid #1C1C1E',
          borderTop: '1px solid #EFEFEF',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 20px 48px rgba(0,0,0,0.14)',
          overflow: 'hidden',
        }}>

          {/* Result count bar */}
          <div style={{
            padding: '6px 14px',
            background: '#FAFAFA',
            borderBottom: '1px solid #F2F2F7',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#AEAEB2' }}>
              {query
                ? filtered.length === 0 ? 'No results' : `${filtered.length} match${filtered.length !== 1 ? 'es' : ''}`
                : `${TEACHERS.length} staff members`
              }
            </span>
            <span style={{ fontSize: 10, color: '#C7C7CC' }}>↑↓ navigate · Enter select</span>
          </div>

          {/* List */}
          <div ref={listRef} style={{ maxHeight: 280, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13, color: '#636366', fontWeight: 500 }}>No teacher named "{query}"</div>
                <div style={{ fontSize: 12, color: '#AEAEB2', marginTop: 4 }}>Try a different spelling</div>
              </div>
            ) : (
              filtered.map((teacher, idx) => {
                const isHighlighted = idx === highlighted
                const isSelected = value?.name === teacher.name
                return (
                  <div
                    key={teacher.name}
                    onMouseEnter={() => setHighlighted(idx)}
                    onMouseDown={e => { e.preventDefault(); handleSelect(teacher) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      background: isHighlighted ? '#F5F5F7' : '#fff',
                      cursor: 'pointer',
                      borderBottom: idx < filtered.length - 1 ? '1px solid #F9F9F9' : 'none',
                      transition: 'background 0.08s',
                    }}
                  >
                    <Avatar name={teacher.name} size={34} dark={isSelected} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#1C1C1E', fontWeight: isSelected ? 700 : 500 }}>
                        <HighlightText text={teacher.name} query={query} />
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ color: '#1C1C1E', flexShrink: 0, display: 'flex' }}><CheckIcon /></div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Login ────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState('select')
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinAttempts, setPinAttempts] = useState(0)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState('hr')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const ADMIN_PASSWORD = '12345'
  const VP_PASSWORD = '67890'
  const PIN_LOCKOUT = 5
  const locked = pinAttempts >= PIN_LOCKOUT

  function handleTeacherSelect(teacher) {
    setSelectedTeacher(teacher)
    setPinInput('')
    setPinError('')
    setPinAttempts(0)
    if (teacher) setStep('pin')
  }

  function handlePinSubmit() {
    if (pinAttempts >= PIN_LOCKOUT) return
    if (pinInput === selectedTeacher?.pin) {
      saveSession(selectedTeacher)
      navigate('/dashboard', { replace: true })
    } else {
      const next = pinAttempts + 1
      setPinAttempts(next)
      setPinInput('')
      setPinError(next >= PIN_LOCKOUT
        ? 'Too many wrong attempts. Please contact HR to reset your PIN.'
        : `Incorrect PIN. ${PIN_LOCKOUT - next} attempt${PIN_LOCKOUT - next !== 1 ? 's' : ''} remaining.`)
    }
  }

  function handlePasswordSubmit() {
    if (passwordTarget === 'hr' && password === ADMIN_PASSWORD) {
      sessionStorage.setItem('pgs_admin', ADMIN_PASSWORD)
      navigate('/admin')
    } else if (passwordTarget === 'vp' && password === VP_PASSWORD) {
      sessionStorage.setItem('pgs_vp', VP_PASSWORD)
      navigate('/vp')
    } else {
      setPasswordError('Incorrect password.')
      setPassword('')
      toast.error('Incorrect password')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FB', fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
    
      <Toaster position="top-center" toastOptions={{ style: { fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, borderRadius: 8 } }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, button { font-family: inherit; }
        input::placeholder { color: #AEAEB2; }
        .pin-box:focus { outline: none !important; border-color: #1C1C1E !important; box-shadow: 0 0 0 3px rgba(28,28,30,0.1) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E5E5EA; border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header style={{ background: '#1C1C1E', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '11px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="PGS" style={{ height: 30, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ color: '#636366', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase' }}>Premier Global School</div>
              <div style={{ color: '#F2F2F7', fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2 }}>Staff Login
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => { setPasswordTarget('vp'); setShowPasswordModal(true); setPassword(''); setPasswordError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#A78BFA', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              <ShieldIcon /> Admin
            </button> 
            {/* <button onClick={() => { setPasswordTarget('hr'); setShowPasswordModal(true); setPassword(''); setPasswordError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8E8E93', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
              <ShieldIcon /> HR
            </button> */}
          </div>
        </div>
      </header>

      {/* Body */}
      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', padding: '32px 16px', flex: 1 }}>

        {/* Welcome card */}
        <div style={{ background: '#1C1C1E', borderRadius: 16, padding: '24px 20px', marginBottom: 20, textAlign: 'center' }}>
          <div style={{ color: '#636366', fontSize: 10, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase', marginBottom: 8 }}>Welcome to</div>
          <div style={{ color: '#F2F2F7', fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>PGS Staff Portal</div>
          <div style={{ color: '#48484A', fontSize: 13 }}>Sign in to access your leave &amp; timetable</div>
        </div>

        {/* SELECT */}
        {step === 'select' && (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 16, padding: '20px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#636366', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Select Your Name</div>
            <NamePicker value={selectedTeacher} onChange={handleTeacherSelect} />
            <div style={{ marginTop: 10, fontSize: 11, color: '#C7C7CC', textAlign: 'center' }}>
              Start typing to filter · ↑↓ navigate · Enter to select
            </div>
          </div>
        )}

        {/* PIN */}
        {step === 'pin' && selectedTeacher && (
          <div style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 16, padding: '24px 16px' }}>
            {/* Selected teacher chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '10px 12px', background: '#F8F9FB', borderRadius: 10, border: '1px solid #F2F2F7' }}>
              <Avatar name={selectedTeacher.name} size={36} dark />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1C1E' }}>{selectedTeacher.name.trim()}</div>
                <div style={{ fontSize: 11, color: '#8E8E93', marginTop: 1 }}>Enter your 4-digit PIN</div>
              </div>
              <button onClick={() => { setStep('select'); setPinInput(''); setPinError(''); setPinAttempts(0) }}
                style={{ fontSize: 11, background: 'transparent', border: '1px solid #E5E5EA', color: '#636366', padding: '5px 11px', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
                Change
              </button>
            </div>

            {locked ? (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px', color: '#991B1B', fontSize: 13, fontWeight: 500 }}>
                🔒 Account locked. Please contact HR to reset your PIN.
              </div>
            ) : (
              <>
                {/* PIN boxes */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'center' }}>
                  {[0,1,2,3].map(i => (
                    <input
                      key={i} id={`pin-${i}`} className="pin-box"
                      type="password" inputMode="numeric" maxLength={1}
                      value={pinInput[i] || ''} autoFocus={i === 0}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '')
                        const arr = pinInput.split(''); arr[i] = val
                        const next = arr.join('').slice(0, 4)
                        setPinInput(next); setPinError('')
                        if (val && i < 3) document.getElementById(`pin-${i+1}`)?.focus()
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !pinInput[i] && i > 0) document.getElementById(`pin-${i-1}`)?.focus()
                        if (e.key === 'Enter' && pinInput.length === 4) handlePinSubmit()
                      }}
                      style={{
                        width: 64, height: 70, textAlign: 'center', fontSize: 28, fontWeight: 700,
                        borderRadius: 12, border: `2px solid ${pinError ? '#FCA5A5' : pinInput[i] ? '#1C1C1E' : '#E5E5EA'}`,
                        background: pinInput[i] ? '#F8F9FB' : '#FAFAFA', color: '#1C1C1E',
                        transition: 'border-color 0.15s',
                      }}
                    />
                  ))}
                </div>
                {pinError && (
                  <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 14, fontWeight: 500, textAlign: 'center' }}>⚠ {pinError}</div>
                )}
                <button onClick={handlePinSubmit} disabled={pinInput.length < 4}
                  style={{
                    width: '100%', border: 'none', padding: '14px', borderRadius: 12,
                    fontSize: 14, fontWeight: 700, cursor: pinInput.length < 4 ? 'not-allowed' : 'pointer',
                    background: pinInput.length === 4 ? '#1C1C1E' : '#F2F2F7',
                    color: pinInput.length === 4 ? '#fff' : '#AEAEB2',
                    transition: 'all 0.2s ease',
                  }}>
                  Sign In →
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Password modal */}
      {showPasswordModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowPasswordModal(false) }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 22px 40px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, background: '#E5E5EA', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: passwordTarget === 'vp' ? '#5B21B6' : '#1C1C1E', marginBottom: 4 }}>
              {passwordTarget === 'vp' ? 'VP Access' : 'HR Access'}
            </div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 18 }}>
              Enter the {passwordTarget === 'vp' ? 'VP' : 'HR'} password to continue.
            </div>
            <input
              type="password" value={password}
              onChange={e => { setPassword(e.target.value); setPasswordError('') }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password" autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${passwordError ? '#FCA5A5' : '#E5E5EA'}`, fontSize: 15, color: '#1C1C1E', marginBottom: 8, background: '#F8F9FB', outline: 'none', fontFamily: 'inherit' }}
            />
            {passwordError && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{passwordError}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => setShowPasswordModal(false)}
                style={{ flex: 1, background: '#F2F2F7', border: 'none', padding: '13px', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#3A3A3C', fontWeight: 500 }}>Cancel</button>
              <button onClick={handlePasswordSubmit}
                style={{ flex: 1, background: passwordTarget === 'vp' ? '#5B21B6' : '#1C1C1E', border: 'none', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>Enter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}