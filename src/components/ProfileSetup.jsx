import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ProfileSetup({ onComplete, onDismiss, initial }) {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '')
  const [obHandle, setObHandle] = useState(initial?.ob_handle ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!displayName.trim()) return
    setBusy(true)
    setErr(null)

    const [authResult, dbResult] = await Promise.all([
      supabase.auth.updateUser({ data: { display_name: displayName.trim(), ob_handle: obHandle.trim() || null } }),
      supabase.from('users').update({ display_name: displayName.trim(), ob_handle: obHandle.trim() || null }).eq('id', user.id),
    ])

    setBusy(false)
    if (authResult.error || dbResult.error) {
      setErr(authResult.error?.message ?? dbResult.error?.message)
      return
    }
    onComplete({ display_name: displayName.trim(), ob_handle: obHandle.trim() || null })
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg)', color: '#fff',
    border: '1px solid var(--line)', borderRadius: 10, fontSize: 15,
    padding: '12px 14px', fontFamily: 'inherit', boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 28, margin: 0 }}>{onDismiss ? '👤' : '👋'}</p>
          {onDismiss && (
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: '#fff', textAlign: 'center', margin: '0 0 6px' }}>
          {onDismiss ? 'Edit Profile' : 'Welcome to CFB Market'}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
          {onDismiss ? 'Update your display name and OB handle.' : 'Set your name so the leaderboard knows who you are.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Display Name <span style={{ color: '#F59E0B' }}>*</span>
            </label>
            <input
              style={inputStyle}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="What should we call you?"
              required
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Orangebloods Username <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input
              style={inputStyle}
              value={obHandle}
              onChange={e => setObHandle(e.target.value)}
              placeholder="Your OB forum handle"
            />
          </div>

          {err && <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{err}</p>}

          <button type="submit" className="btn btn--accent" disabled={busy || !displayName.trim()} style={{ width: '100%', marginTop: 4 }}>
            {busy ? 'Saving…' : "Let's Go"}
          </button>
        </form>
      </div>
    </div>
  )
}
