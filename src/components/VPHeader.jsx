import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LogOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

export default function VPHeader({ title, rightExtra = null }) {
  const navigate = useNavigate()
  const [showConfirm, setShowConfirm] = useState(false)

  function handleSignOut() {
    sessionStorage.removeItem('pgs_vp')
    navigate('/', { replace: true })
  }

  return (
    <>
      <header style={{
        background: 'linear-gradient(135deg, #1e003e 0%, #3B0764 50%, #2e0657 100%)',
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
      }}>
        <div style={{ maxWidth: 960 , margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0
            }}>
              <img src="/logo.png" alt="PGS" style={{ height: 24, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            </div>
            <div>
              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2 }}>{title}</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 1 }}>Premier Global School · VP</div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rightExtra && (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 10px' }}>
                {rightExtra}
              </div>
            )}
            <button onClick={() => setShowConfirm(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)',
              padding: '7px 12px', borderRadius: 8,
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            >
              <LogOutIcon />
            </button>
          </div>

        </div>
      </header>

      {showConfirm && (
        <div onClick={() => setShowConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 22px 40px', width: '100%', maxWidth: 480 }}>
            <div style={{ width: 36, height: 4, background: '#E5E5EA', borderRadius: 2, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1C1C1E', marginBottom: 6 }}>Exit VP Dashboard?</div>
            <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 24 }}>You'll need to enter the VP password again to access this area.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)}
                style={{ flex: 1, background: '#F2F2F7', border: 'none', padding: '13px', borderRadius: 10, fontSize: 14, cursor: 'pointer', color: '#3A3A3C', fontWeight: 500 }}>
                Cancel
              </button>
              <button onClick={handleSignOut}
                style={{ flex: 1, background: '#3B0764', border: 'none', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' }}>
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}