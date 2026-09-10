import { useState } from 'react'

export default function PinEntry({ teacher, onSuccess, onBack }) {
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinAttempts, setPinAttempts] = useState(0)
  const PIN_LOCKOUT = 5
  const locked = pinAttempts >= PIN_LOCKOUT

  function handlePinSubmit() {
    if (pinAttempts >= PIN_LOCKOUT) return
    if (pinInput === teacher?.pin) {
      onSuccess()
    } else {
      const next = pinAttempts + 1
      setPinAttempts(next)
      setPinInput('')
      setPinError(next >= PIN_LOCKOUT
        ? 'Too many wrong attempts. Please contact HR to reset your PIN.'
        : `Incorrect PIN. ${PIN_LOCKOUT - next} attempt${PIN_LOCKOUT - next !== 1 ? 's' : ''} remaining.`)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '20px 14px', marginBottom: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Hello, {teacher?.name?.trim()} 👋</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 20 }}>Enter your 4-digit PIN to continue.</div>
      {locked ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '12px 14px', color: '#991B1B', fontSize: 13, fontWeight: 500 }}>
          🔒 Account locked. Please contact HR.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            {[0,1,2,3].map(i => (
              <input key={i} id={`pin-${i}`} className="pin-box" type="password" inputMode="numeric" maxLength={1}
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
                style={{ width: 56, height: 60, textAlign: 'center', fontSize: 24, fontWeight: 700, borderRadius: 8, border: `2px solid ${pinError ? '#FCA5A5' : '#D1D5DB'}`, background: '#FAFAFA', color: '#111827' }} />
            ))}
          </div>
          {pinError && <div style={{ color: '#DC2626', fontSize: 12, marginBottom: 12, fontWeight: 500 }}>⚠ {pinError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onBack} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', padding: '9px 16px', borderRadius: 5, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Back</button>
            <button onClick={handlePinSubmit} disabled={pinInput.length < 4}
              style={{ background: '#111827', color: '#fff', border: 'none', padding: '9px 28px', borderRadius: 5, fontSize: 13, fontWeight: 600, cursor: pinInput.length < 4 ? 'not-allowed' : 'pointer', opacity: pinInput.length < 4 ? 0.45 : 1 }}>
              Verify PIN
            </button>
          </div>
        </>
      )}
    </div>
  )
}