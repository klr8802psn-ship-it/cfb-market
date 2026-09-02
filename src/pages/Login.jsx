import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%', padding: '12px 16px', borderRadius: 10,
  background: 'var(--surface)', border: '1px solid var(--line)',
  color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export default function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const [tab, setTab] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [notice, setNotice] = useState(null)

  const requestedPath = new URLSearchParams(location.search).get('next')
  const nextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/market'

  function switchTab(t) { setTab(t); setErr(null); setNotice(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setNotice(null)

    if (tab === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/login`,
      })
      setBusy(false)
      if (error) { setErr(error.message); return }
      setNotice('Check your email — we sent a password reset link.')
      return
    }

    if (tab === 'signup') {
      if (password !== confirm) { setErr('Passwords do not match.'); setBusy(false); return }
      if (password.length < 6) { setErr('Password must be at least 6 characters.'); setBusy(false); return }
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: `${window.location.origin}${nextPath}` },
      })
      setBusy(false)
      if (error) { setErr(error.message); return }
      setNotice('Almost there — check your email to confirm your account, then sign in.')
      return
    }

    // sign in
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    navigate(nextPath, { replace: true })
  }

  return (
    <div className="page-container" style={{ maxWidth: 380, paddingTop: 60 }}>
      <Link to="/" style={{ display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px', textDecoration: 'none' }}>← CFB Market</Link>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color: '#fff', marginBottom: 28 }}>
        {tab === 'forgot' ? 'Reset password' : 'Sign in'}
      </h1>

      {/* Sign in / Sign up tabs */}
      {tab !== 'forgot' && (
        <div role="tablist" aria-label="Account action" style={{ display: 'flex', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line)', padding: 3, marginBottom: 20 }}>
          {['signin', 'signup'].map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => switchTab(t)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#000' : 'var(--muted)',
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div className="card" style={{ padding: 16, marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--positive)', margin: 0 }}>{notice}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
          Email address
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" style={{ ...inputStyle, marginTop: 6 }} />
        </label>

        {tab !== 'forgot' && (
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} style={{ ...inputStyle, marginTop: 6 }} />
          </label>
        )}

        {tab === 'signup' && (
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
            Confirm password
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm password" required autoComplete="new-password" style={{ ...inputStyle, marginTop: 6 }} />
          </label>
        )}

        {err && <p style={{ fontSize: 13, color: 'var(--negative)', margin: 0 }}>{err}</p>}

        <button type="submit" className="btn btn--accent" disabled={busy} style={{ width: '100%', marginTop: 4 }}>
          {busy ? '…' : tab === 'forgot' ? 'Send reset link' : tab === 'signup' ? 'Create account' : 'Sign in'}
        </button>

        {tab === 'signin' && (
          <button
            type="button"
            onClick={() => switchTab('forgot')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '10px 8px', textAlign: 'center', fontFamily: 'inherit', minHeight: 44 }}
          >
            Forgot password?
          </button>
        )}

        {tab === 'forgot' && (
          <button
            type="button"
            onClick={() => switchTab('signin')}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: '10px 8px', textAlign: 'center', fontFamily: 'inherit', minHeight: 44 }}
          >
            ← Back to sign in
          </button>
        )}
      </form>
    </div>
  )
}
