import { useState, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  )
}

export default function AdminLeague() {
  const { id: leagueId } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.user_metadata?.is_admin_platform === true
  if (!isAdmin) return <Navigate to="/market" replace />

  const [cfg, setCfg] = useState(null)
  const [league, setLeague] = useState(null)
  const [members, setMembers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [settleBusy, setSettleBusy] = useState(false)
  const [settleResult, setSettleResult] = useState(null)
  const [kickoffDate, setKickoffDate] = useState('')   // "YYYY-MM-DDTHH:MM"
  const [kickoffBusy, setKickoffBusy] = useState(false)
  const [kickoffResult, setKickoffResult] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('stock_config').select('season_id, start_cash, trading_open, enabled, is_public').eq('league_id', leagueId).eq('enabled', true).maybeSingle(),
      supabase.from('leagues').select('id, name, invite_code').eq('id', leagueId).maybeSingle(),
      supabase.from('league_members').select('user_id, role, user:users(display_name, email)').eq('league_id', leagueId),
      supabase.from('stock_accounts').select('user_id, cash').eq('league_id', leagueId),
    ]).then(([{ data: cfgData }, { data: leagueData }, { data: memberData }, { data: acctData }]) => {
      setCfg(cfgData)
      setLeague(leagueData)
      setMembers(memberData ?? [])
      setAccounts(acctData ?? [])
      setLoading(false)
    })
  }, [leagueId])

  async function togglePublic() {
    if (!cfg) return
    setToggleBusy(true)
    const newVal = !cfg.is_public
    await supabase.from('stock_config').update({ is_public: newVal }).eq('league_id', leagueId)
    setCfg(prev => ({ ...prev, is_public: newVal }))
    setToggleBusy(false)
  }

  async function toggleTrading() {
    if (!cfg) return
    setToggleBusy(true)
    const newVal = !cfg.trading_open
    await supabase.from('stock_config').update({ trading_open: newVal }).eq('league_id', leagueId)
    setCfg(prev => ({ ...prev, trading_open: newVal }))
    setToggleBusy(false)
  }

  async function runSettle() {
    if (!cfg) return
    setSettleBusy(true)
    setSettleResult(null)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/stock-settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ season_id: cfg.season_id, league_id: leagueId }),
      })
      const json = await res.json()
      setSettleResult(json.updated != null ? `Updated ${json.updated} team prices.` : JSON.stringify(json))
    } catch (e) {
      setSettleResult(`Error: ${e.message}`)
    }
    setSettleBusy(false)
  }

  async function addKickoff() {
    if (!kickoffDate || !cfg) return
    setKickoffBusy(true)
    setKickoffResult(null)

    // Find or create a published week for this season
    // Use week_number 1 for simplicity (the cron only needs ≥1 published week with games)
    // In practice, create a new week per game-wave so admins can see them separately
    const lockTime = new Date(kickoffDate).toISOString()
    const weekLabel = `Kickoff ${kickoffDate.split('T')[0]}`

    // Check if a week already exists for this label to avoid duplicates
    const { data: existingWeek } = await supabase
      .from('weeks')
      .select('id')
      .eq('season_id', cfg.season_id)
      .eq('league_id', leagueId)
      .eq('label', weekLabel)
      .maybeSingle()

    let weekId = existingWeek?.id
    if (!weekId) {
      // Count existing weeks to assign week_number
      const { count } = await supabase.from('weeks').select('id', { count: 'exact', head: true }).eq('season_id', cfg.season_id).eq('league_id', leagueId)
      const { data: newWeek, error: weekErr } = await supabase
        .from('weeks')
        .insert({ season_id: cfg.season_id, league_id: leagueId, week_number: (count ?? 0) + 1, label: weekLabel, status: 'published' })
        .select('id')
        .maybeSingle()
      if (weekErr) { setKickoffResult(`Failed to create week: ${weekErr.message}`); setKickoffBusy(false); return }
      weekId = newWeek.id
    }

    // Insert a stub game with the lock_time
    const { error: gameErr } = await supabase.from('games').insert({
      week_id: weekId,
      home_team: 'CFB Kickoff Wave',
      away_team: 'CFB Kickoff Wave',
      lock_time: lockTime,
    })

    if (gameErr) { setKickoffResult(`Failed to create kickoff: ${gameErr.message}`); setKickoffBusy(false); return }
    setKickoffResult(`Kickoff wave scheduled for ${new Date(lockTime).toLocaleString()}.`)
    setKickoffDate('')
    setKickoffBusy(false)
  }

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--muted)' }}>Loading…</div>
  }

  const joinUrl = league?.invite_code ? `${window.location.origin}/join/${league.invite_code}` : null

  return (
    <div className="page-container" style={{ paddingTop: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: '#fff', marginBottom: 4 }}>{league?.name ?? 'League'}</h1>
      <p style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 28 }}>League admin</p>

      <Section title="Season Info">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Season ID</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>{cfg?.season_id?.slice(0, 8)}…</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Start cash</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#fff', fontWeight: 700 }}>${cfg?.start_cash?.toLocaleString() ?? '2,000'}</span>
            </div>
            {joinUrl && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Invite link</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={joinUrl} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none' }} />
                  <button onClick={() => navigator.clipboard.writeText(joinUrl)} className="btn btn--ghost" style={{ fontSize: 12, padding: '8px 12px', flexShrink: 0 }}>Copy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Trading Window">
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }}>
              Trading is {cfg?.trading_open ? 'open' : 'closed'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
              {cfg?.trading_open ? 'Players can buy and sell.' : 'Trading paused until next settle.'}
            </p>
          </div>
          <button onClick={toggleTrading} disabled={toggleBusy} className="btn" style={{ padding: '8px 16px', background: cfg?.trading_open ? 'rgba(255,107,122,0.12)' : 'rgba(56,217,130,0.12)', color: cfg?.trading_open ? '#ff6b7a' : '#38D982', border: `1px solid ${cfg?.trading_open ? 'rgba(255,107,122,0.3)' : 'rgba(56,217,130,0.3)'}`, fontSize: 12 }}>
            {cfg?.trading_open ? 'Close' : 'Open'}
          </button>
        </div>
      </Section>

      <Section title="Public Leaderboard">
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }}>
              {cfg?.is_public ? 'Visible to anyone' : 'Private league'}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>
              {cfg?.is_public ? 'Shows on the public leaderboard page.' : 'Hidden from the public leaderboard.'}
            </p>
          </div>
          <button onClick={togglePublic} disabled={toggleBusy} className="btn" style={{ padding: '8px 16px', background: cfg?.is_public ? 'rgba(255,107,122,0.12)' : 'rgba(56,217,130,0.12)', color: cfg?.is_public ? '#ff6b7a' : '#38D982', border: `1px solid ${cfg?.is_public ? 'rgba(255,107,122,0.3)' : 'rgba(56,217,130,0.3)'}`, fontSize: 12 }}>
            {cfg?.is_public ? 'Make Private' : 'Make Public'}
          </button>
        </div>
      </Section>

      <Section title="Kickoff Setter">
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Set a kickoff time — the auto-lock cron will close trading when this time arrives.
        </p>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="datetime-local" value={kickoffDate} onChange={e => setKickoffDate(e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-3)', border: '1px solid var(--line-2)', color: '#fff', fontSize: 14, outline: 'none' }} />
            <button onClick={addKickoff} disabled={kickoffBusy || !kickoffDate} className="btn btn--accent" style={{ flexShrink: 0, padding: '10px 16px', fontSize: 13 }}>
              {kickoffBusy ? '…' : 'Add'}
            </button>
          </div>
          {kickoffResult && <p style={{ fontSize: 13, color: 'var(--positive)', margin: 0 }}>{kickoffResult}</p>}
        </div>
      </Section>

      <Section title="Settle Prices">
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Pulls latest ESPN FPI, updates all team prices, and opens trading.
        </p>
        <div className="card" style={{ padding: 16 }}>
          <button onClick={runSettle} disabled={settleBusy} className="btn btn--accent" style={{ width: '100%' }}>
            {settleBusy ? 'Running settle…' : 'Run Settle'}
          </button>
          {settleResult && <p style={{ fontSize: 13, color: 'var(--positive)', marginTop: 12, margin: 0 }}>{settleResult}</p>}
        </div>
      </Section>

      <Section title={`Members (${members.length})`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map(m => {
            const acct = accounts.find(a => a.user_id === m.user_id)
            const cash = acct ? Number(acct.cash) : (cfg?.start_cash ?? 2000)
            return (
              <div key={m.user_id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, color: '#fff', fontSize: 13, margin: 0 }}>{m.user?.display_name ?? 'Unknown'}</p>
                  <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0 }}>{m.user?.email ?? ''}</p>
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)', margin: 0 }}>${cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cash</p>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
