import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setErr(null)
    const nextPath = new URLSearchParams(window.location.search).get('next') ?? '/'
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}${nextPath}` },
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setSent(true)
  }

  return (
    <div className="page-container" style={{ maxWidth: 380, paddingTop: 60 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color: '#fff', marginBottom: 8 }}>
        Sign in
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
        We'll email you a magic link — no password needed.
      </p>

      {sent ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 24, marginBottom: 12 }}>📬</p>
          <p style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>Check your email</p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={{
              padding: '12px 16px', borderRadius: 'var(--r-sm)',
              background: 'var(--surface-2)', border: '1px solid var(--line-2)',
              color: '#fff', fontSize: 16, outline: 'none', width: '100%',
            }}
          />
          {err && <p style={{ color: 'var(--negative)', fontSize: 13 }}>{err}</p>}
          <button type="submit" className="btn btn--accent" disabled={busy || !email.trim()}>
            {busy ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  )
}
