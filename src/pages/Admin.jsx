import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function CreateLeagueForm({ onCreated }) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [seasonName, setSeasonName] = useState('CFB 2026')
  const [seasonYear, setSeasonYear] = useState(2026)
  const [startCash, setStartCash] = useState(5000)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  function handleNameChange(val) {
    setName(val)
    setInviteCode(slugify(val))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !inviteCode.trim()) return
    setBusy(true)
    setErr(null)

    // 1. Create league
    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .insert({ name: name.trim(), invite_code: inviteCode.trim(), commissioner_id: user.id, season_year: seasonYear })
      .select()
      .single()
    if (leagueErr) { setErr(leagueErr.message); setBusy(false); return }

    // 2. Add creator as commissioner member (required before seasons insert)
    const { error: memberErr } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: user.id, role: 'commissioner' })
    if (memberErr) { setErr(memberErr.message); setBusy(false); return }

    // 3. Create season
    const { data: season, error: seasonErr } = await supabase
      .from('seasons')
      .insert({ league_id: league.id, name: seasonName.trim() })
      .select()
      .single()
    if (seasonErr) { setErr(seasonErr.message); setBusy(false); return }

    // 4. Create stock_config
    const { error: configErr } = await supabase
      .from('stock_config')
      .insert({ league_id: league.id, season_id: season.id, enabled: true, trading_open: true, start_cash: startCash })
    if (configErr) { setErr(configErr.message); setBusy(false); return }

    setBusy(false)
    setName('')
    setInviteCode('')
    setSeasonName('CFB 2026')
    setStartCash(5000)
    onCreated()
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg)', color: '#fff', border: '1px solid var(--line)',
    borderRadius: 8, fontSize: 14, padding: '10px 12px', fontFamily: 'inherit', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 11, color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }

  return (
    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={labelStyle}>League Name</label>
        <input style={inputStyle} value={name} onChange={e => handleNameChange(e.target.value)} placeholder="Orangebloods 2026" required />
      </div>
      <div>
        <label style={labelStyle}>Invite Code</label>
        <input style={inputStyle} value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="orangebloods-2026" required />
        {inviteCode && (
          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>
            Join link: cfb-market.vercel.app/join/{inviteCode}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Season Name</label>
          <input style={inputStyle} value={seasonName} onChange={e => setSeasonName(e.target.value)} placeholder="CFB 2026" required />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Year</label>
          <input style={inputStyle} type="number" value={seasonYear} onChange={e => setSeasonYear(Number(e.target.value))} min={2024} max={2030} required />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Starting Cash ($)</label>
        <input style={inputStyle} type="number" value={startCash} onChange={e => setStartCash(Number(e.target.value))} min={500} max={100000} step={500} required />
      </div>
      {err && <p style={{ fontSize: 13, color: '#f87171', margin: 0 }}>{err}</p>}
      <button type="submit" className="btn btn--accent" disabled={busy} style={{ width: '100%' }}>
        {busy ? 'Creating…' : 'Create League'}
      </button>
    </form>
  )
}

export default function Admin() {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const isAdmin = user?.user_metadata?.is_admin_platform === true
  if (!isAdmin) return <Navigate to="/market" replace />

  function loadLeagues() {
    setLoading(true)
    supabase
      .from('stock_config')
      .select('league_id, season_id, enabled, trading_open, start_cash, leagues(id, name, invite_code)')
      .eq('enabled', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLeagues(data ?? []); setLoading(false) })
  }

  useEffect(() => { loadLeagues() }, [])

  return (
    <div className="page-container" style={{ paddingTop: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0 }}>Admin</h1>
        <button
          className="btn btn--accent"
          style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => setShowCreate(v => !v)}
        >
          {showCreate ? 'Cancel' : '+ New League'}
        </button>
      </div>
      <p style={{ color: 'var(--faint)', fontSize: 13, marginBottom: 24 }}>Platform admin — all stock leagues</p>

      {showCreate && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '0 0 16px' }}>Create League</p>
          <CreateLeagueForm onCreated={() => { setShowCreate(false); loadLeagues() }} />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
      ) : leagues.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No active stock leagues. Create one above.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leagues.map(cfg => (
            <Link key={cfg.league_id} to={`/admin/league/${cfg.league_id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }}>{cfg.leagues?.name ?? cfg.league_id}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)', margin: '2px 0 0' }}>
                    {cfg.trading_open ? '🟢 Trading open' : '🔴 Trading closed'} · ${cfg.start_cash?.toLocaleString()} start · /join/{cfg.leagues?.invite_code}
                  </p>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
