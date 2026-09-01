import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLeague } from '../context/LeagueContext'
import TeamMark from '../components/TeamMark'
import PortfolioBar from '../components/PortfolioBar'
import TradeModal from '../components/TradeModal'
import ProfileSetup from '../components/ProfileSetup'
import { STOCK_START_CASH, holdingsValue, portfolioValue, validateBuy } from '../lib/stocks'

function fmt(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toFixed(2)
}
function fmtDelta(delta) {
  if (delta == null) return null
  const v = Number(delta)
  if (v === 0) return null
  return (v > 0 ? '+' : '') + v.toFixed(2)
}

// ── Sparkline (handles { price, date } objects or plain numbers) ──────────────
function Sparkline({ prices, width = 44, height = 18 }) {
  if (!prices || prices.length < 2) return null
  const vals = prices.map(p => typeof p === 'number' ? p : Number(p.price))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const step = width / (vals.length - 1)
  const points = vals.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const isUp = vals[vals.length - 1] >= vals[0]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ flexShrink: 0, display: 'block' }}>
      <polyline points={points} fill="none" stroke={isUp ? '#38D982' : '#ff4466'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Full price chart modal ────────────────────────────────────────────────────
function PriceChartModal({ team, history, onClose }) {
  if (!history || history.length === 0) return null
  const vals = history.map(p => Number(p.price))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 280, H = 100, PAD = { t: 10, b: 28, l: 8, r: 8 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b
  const n = vals.length

  const pts = vals.map((v, i) => {
    const x = PAD.l + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
    const y = PAD.t + chartH - ((v - min) / range) * chartH
    return { x, y, v, date: history[i].date }
  })

  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const isUp = vals[vals.length - 1] >= vals[0]
  const color = isUp ? '#38D982' : '#ff4466'
  const change = vals[vals.length - 1] - vals[0]
  const changePct = vals[0] ? (change / vals[0]) * 100 : 0

  function fmtDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 340, padding: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <TeamMark color={team.primary_color} abbr={team.abbreviation} size="md" />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 900, color: '#fff', fontSize: 15, margin: 0 }}>{team.name}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--faint)', margin: 0 }}>
              {fmtPrice(vals[vals.length - 1])}
              <span style={{ color, marginLeft: 6 }}>
                {change > 0 ? '+' : ''}{change.toFixed(2)} ({changePct > 0 ? '+' : ''}{changePct.toFixed(1)}%)
              </span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Chart */}
        {vals.length < 2 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Not enough history yet.</p>
        ) : (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginBottom: 4 }}>
            {/* Area fill */}
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`${pts[0].x},${PAD.t + chartH} ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} ${pts[pts.length - 1].x},${PAD.t + chartH}`}
              fill="url(#chartFill)"
            />
            {/* Line */}
            <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Data points */}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill={i === pts.length - 1 ? color : 'var(--bg)'} stroke={color} strokeWidth="1.5" />
            ))}
            {/* X axis date labels — first and last */}
            {pts.length >= 2 && (
              <>
                <text x={pts[0].x} y={H - 4} textAnchor="start" fontSize="9" fill="var(--faint)" fontFamily="var(--font-mono)">{fmtDate(pts[0].date)}</text>
                <text x={pts[pts.length - 1].x} y={H - 4} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--font-mono)">{fmtDate(pts[pts.length - 1].date)}</text>
              </>
            )}
          </svg>
        )}

        <p style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', margin: 0 }}>
          {vals.length} settle{vals.length !== 1 ? 's' : ''} · Tap anywhere to close
        </p>
      </div>
    </div>
  )
}

// ── Market row ────────────────────────────────────────────────────────────────
function MarketRow({ team, price, prevPrice, history, holdings, cash, priceByTeam, tradingOpen, onTrade, onChart, showPosition }) {
  const held = holdings.find(h => h.team_id === team.id)?.shares ?? 0
  const hasPrice = price != null
  const delta = hasPrice && prevPrice != null ? price - prevPrice : null
  const deltaStr = fmtDelta(delta)
  const deltaPos = delta != null && delta > 0
  const deltaNeg = delta != null && delta < 0
  const positionValue = hasPrice && held > 0 ? held * price : null
  const canBuy = tradingOpen && hasPrice && validateBuy({ cash, holdings, priceByTeam, teamId: team.id, shares: 1 }).ok
  const canSell = tradingOpen && held > 0

  return (
    <div className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, minHeight: 60 }}>
      <TeamMark color={team.primary_color} abbr={team.abbreviation} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {held > 0 && (
            <span style={{ fontSize: 10, fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
              {showPosition && positionValue != null ? `${held} sh · ${fmtPrice(positionValue)}` : `${held} share${held !== 1 ? 's' : ''}`}
            </span>
          )}
          {deltaStr && (
            <span style={{ fontSize: 10, fontWeight: 900, fontFamily: 'var(--font-mono)', color: deltaPos ? '#38D982' : deltaNeg ? '#ff4466' : '#94a3b8' }}>
              {deltaPos ? '+' : ''}{deltaStr}
            </span>
          )}
        </div>
      </div>
      {hasPrice && (
        <button type="button" onClick={() => onChart(team)} aria-label={`View ${team.name} price chart`} style={{ display: 'flex', alignItems: 'center', minWidth: 44, minHeight: 44, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <Sparkline prices={history} />
        </button>
      )}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 14, color: '#fff', margin: 0 }}>{hasPrice ? fmtPrice(price) : '—'}</p>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={() => hasPrice && onTrade(team, 'buy')} disabled={!canBuy}
          style={{ fontSize: 11, fontWeight: 900, padding: '6px 10px', borderRadius: 8, background: canBuy ? 'rgba(56,217,130,0.12)' : 'rgba(255,255,255,0.04)', color: canBuy ? '#38D982' : '#475569', border: `1px solid ${canBuy ? 'rgba(56,217,130,0.3)' : 'rgba(255,255,255,0.06)'}`, cursor: canBuy ? 'pointer' : 'not-allowed' }}>
          Buy
        </button>
        <button type="button" onClick={() => canSell && onTrade(team, 'sell')} disabled={!canSell}
          style={{ fontSize: 11, fontWeight: 900, padding: '6px 10px', borderRadius: 8, background: canSell ? 'rgba(255,107,122,0.10)' : 'rgba(255,255,255,0.04)', color: canSell ? '#ff6b7a' : '#475569', border: `1px solid ${canSell ? 'rgba(255,107,122,0.25)' : 'rgba(255,255,255,0.06)'}`, cursor: canSell ? 'pointer' : 'not-allowed' }}>
          Sell
        </button>
      </div>
    </div>
  )
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────
function LeaderboardTab({ accounts, allHoldings, priceByTeam, members, currentUserId, startCash }) {
  const ranked = useMemo(() => {
    return members.map(m => {
      const acct = accounts.find(a => a.user_id === m.user_id)
      const cash = acct ? Number(acct.cash) : startCash
      const holdings = allHoldings.filter(h => h.user_id === m.user_id).map(h => ({ team_id: h.team_id, shares: h.shares }))
      const total = portfolioValue({ cash, holdings, priceByTeam })
      const pl = total - startCash
      return { ...m, cash, total, pl }
    }).sort((a, b) => b.total - a.total)
  }, [accounts, allHoldings, priceByTeam, members, startCash])

  if (!ranked.length) {
    return <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>No members yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ranked.map((m, idx) => {
        const isMe = m.user_id === currentUserId
        const plPos = m.pl > 0
        const plNeg = m.pl < 0
        const fmtPl = (pl) => (pl > 0 ? '+' : '') + '$' + Math.abs(pl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return (
          <div key={m.user_id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, ...(isMe ? { borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.04)' } : {}) }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 12, flexShrink: 0, background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: idx === 0 ? '#F59E0B' : '#94a3b8', border: idx === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
              {idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.display_name ?? 'Unknown'}{isMe && <span style={{ color: '#F59E0B', marginLeft: 6, fontSize: 10, fontWeight: 900 }}>You</span>}
              </p>
              {m.ob_handle && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', margin: 0 }}>
                  <span style={{ color: '#F59E0B', fontWeight: 700 }}>OB</span> · {m.ob_handle}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 14, color: '#fff', margin: 0 }}>{fmt(m.total)}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 900, margin: 0, color: plPos ? 'var(--positive)' : plNeg ? 'var(--negative)' : 'var(--muted)' }}>{fmtPl(m.pl)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Market page ──────────────────────────────────────────────────────────
export default function Market() {
  const { user, signOut } = useAuth()
  const { league, config, memberLoading, memberError } = useLeague()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState(['market', 'portfolio', 'leaderboard'].includes(requestedTab) ? requestedTab : 'market')
  const [joinCode, setJoinCode] = useState('')
  const [cash, setCash] = useState(STOCK_START_CASH)
  const [holdings, setHoldings] = useState([])
  const [teams, setTeams] = useState([])
  const [priceByTeam, setPriceByTeam] = useState({})
  const [prevPriceByTeam, setPrevPriceByTeam] = useState({})
  const [historyByTeam, setHistoryByTeam] = useState({})  // { price, date }[]
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [leaderAccounts, setLeaderAccounts] = useState([])
  const [leaderHoldings, setLeaderHoldings] = useState([])
  const [members, setMembers] = useState([])

  useEffect(() => {
    setTab(['market', 'portfolio', 'leaderboard'].includes(requestedTab) ? requestedTab : 'market')
  }, [requestedTab])

  // Profile setup
  const [profile, setProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)

  // Trade modal
  const [tradeTeam, setTradeTeam] = useState(null)
  const [tradeSide, setTradeSide] = useState('buy')
  const [tradeSuccess, setTradeSuccess] = useState(null)
  const [tradeBusy, setTradeBusy] = useState(false)
  const [tradeError, setTradeError] = useState(null)

  // Price chart modal
  const [chartTeam, setChartTeam] = useState(null)

  // Profile edit modal + dropdown
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  // Fetch profile separately (fast, needed for setup check)
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('display_name, ob_handle').eq('id', user.id).maybeSingle()
      .then(({ data }) => { setProfile(data); setProfileLoaded(true) })
  }, [user?.id])

  useEffect(() => {
    if (!config || !user || !league) { setLoading(false); return }
    const seasonId = config.season_id
    const startCash = config.start_cash ?? STOCK_START_CASH
    setLoading(true)
    setLoadErr(null)

    Promise.all([
      supabase.from('stock_accounts').select('cash').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id).maybeSingle(),
      supabase.from('stock_holdings').select('team_id, shares').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id),
      supabase.from('teams').select('id, name, abbreviation, primary_color').eq('sport', 'CFB').order('name'),
      supabase.from('stock_prices').select('team_id, price, settled_at').eq('season_id', seasonId).order('settled_at', { ascending: false }),
      supabase.from('stock_accounts').select('user_id, cash').eq('league_id', league.id).eq('season_id', seasonId),
      supabase.from('stock_holdings').select('user_id, team_id, shares').eq('league_id', league.id).eq('season_id', seasonId),
      supabase.from('league_members').select('user_id, user:users(display_name, ob_handle)').eq('league_id', league.id),
    ]).then(results => {
      const failed = results.find(result => result.error)
      if (failed) throw failed.error
      const [
        { data: acct }, { data: myHoldings }, { data: teamRows }, { data: allPrices },
        { data: leagueAccts }, { data: leagueHoldings }, { data: leagueMembers },
      ] = results
      setCash(acct?.cash != null ? Number(acct.cash) : startCash)
      setHoldings((myHoldings ?? []).filter(h => h.shares > 0))
      setTeams(teamRows ?? [])

      const prices = allPrices ?? []
      const byTeam = {}
      for (const p of prices) {
        if (!byTeam[p.team_id]) byTeam[p.team_id] = []
        byTeam[p.team_id].push(p)
      }
      const latest = {}
      const prev = {}
      const hist = {}
      for (const [teamId, records] of Object.entries(byTeam)) {
        const sorted = [...records].sort((a, b) => new Date(b.settled_at) - new Date(a.settled_at))
        latest[teamId] = Number(sorted[0].price)
        if (sorted[1]) prev[teamId] = Number(sorted[1].price)
        hist[teamId] = sorted.slice().reverse().map(r => ({ price: Number(r.price), date: r.settled_at }))
      }
      setPriceByTeam(latest)
      setPrevPriceByTeam(prev)
      setHistoryByTeam(hist)
      setLeaderAccounts(leagueAccts ?? [])
      setLeaderHoldings((leagueHoldings ?? []).filter(h => h.shares > 0))
      setMembers((leagueMembers ?? []).map(m => ({
        user_id: m.user_id,
        display_name: m.user?.display_name ?? null,
        ob_handle: m.user?.ob_handle ?? null,
      })))
      setLoading(false)
    }).catch(err => { setLoadErr(err.message); setLoading(false) })
  }, [config?.season_id, user?.id, league?.id])

  function refreshAccount() {
    if (!config || !user || !league) return
    const seasonId = config.season_id
    const startCash = config.start_cash ?? STOCK_START_CASH
    Promise.all([
      supabase.from('stock_accounts').select('cash').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id).maybeSingle(),
      supabase.from('stock_holdings').select('team_id, shares').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id),
    ]).then(([{ data: acct }, { data: myHoldings }]) => {
      setCash(acct?.cash != null ? Number(acct.cash) : startCash)
      setHoldings((myHoldings ?? []).filter(h => h.shares > 0))
    })
  }

  async function handleTradeConfirm(shares) {
    if (!tradeTeam || !config || !league) return
    setTradeBusy(true)
    setTradeError(null)
    const { data, error: rpcError } = await supabase.rpc('stock_trade', {
      p_league_id: league.id,
      p_season_id: config.season_id,
      p_team_id: tradeTeam.id,
      p_side: tradeSide,
      p_shares: shares,
    })
    setTradeBusy(false)
    if (rpcError) { setTradeError(rpcError.message); return }
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.ok) { setTradeError(result?.reason ?? 'Trade failed'); return }
    setTradeSuccess(`${tradeSide === 'buy' ? 'Bought' : 'Sold'} ${shares} share${shares !== 1 ? 's' : ''} of ${tradeTeam.name}`)
    setTradeTeam(null)
    refreshAccount()
  }

  const holdingsVal = useMemo(() => holdingsValue(holdings, priceByTeam), [holdings, priceByTeam])
  const startCash = config?.start_cash ?? STOCK_START_CASH
  const tradingOpen = config?.trading_open !== false
  const hasAnyPrice = Object.keys(priceByTeam).length > 0

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (priceByTeam[b.id] ?? -1) - (priceByTeam[a.id] ?? -1))
  }, [teams, priceByTeam])

  if (memberLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(245,158,11,0.5)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (memberError) {
    return (
      <div className="page-container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>⚠️</p>
        <p style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>Leagues unavailable</p>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>{memberError}</p>
        <button className="btn btn--accent" onClick={() => window.location.reload()}>Try again</button>
      </div>
    )
  }

  if (!league || !config) {
    return (
      <div className="page-container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🏈</p>
        <p style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>You're not in a league</p>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Paste the invite code from your commissioner to get started.</p>
        <form onSubmit={e => { e.preventDefault(); if (joinCode.trim()) navigate(`/join/${encodeURIComponent(joinCode.trim())}`) }} className="card" style={{ padding: 16, textAlign: 'left', marginBottom: 16 }}>
          <label htmlFor="join-code" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Invite code</label>
          <input id="join-code" value={joinCode} onChange={e => setJoinCode(e.target.value)} autoComplete="off" placeholder="Enter invite code" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line-2)', color: '#fff', fontFamily: 'inherit', fontSize: 15, marginBottom: 12 }} />
          <button type="submit" className="btn btn--accent" disabled={!joinCode.trim()} style={{ width: '100%' }}>Join league</button>
        </form>
        <button type="button" onClick={signOut} className="btn btn--ghost">Sign out</button>
      </div>
    )
  }

  if (loadErr) {
    return (
      <div className="page-container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ color: 'var(--negative)', fontSize: 14 }}>Failed to load: {loadErr}</p>
      </div>
    )
  }

  function openTrade(team, side) {
    setTradeTeam(team)
    setTradeSide(side)
    setTradeError(null)
    setTradeSuccess(null)
  }

  const TABS = [{ key: 'market', label: 'Market' }, { key: 'portfolio', label: 'My Stocks' }, { key: 'leaderboard', label: 'Leaderboard' }]

  function changeTab(nextTab) {
    setTab(nextTab)
    if (nextTab === 'market') setSearchParams({}, { replace: true })
    else setSearchParams({ tab: nextTab }, { replace: true })
  }

  return (
    <>
    {/* Profile setup — shown once on first login, or when editing */}
    {profileLoaded && (!profile?.display_name || editingProfile) && (
      <ProfileSetup initial={profile} onComplete={p => { setProfile(p); setEditingProfile(false) }} onDismiss={profile?.display_name ? () => setEditingProfile(false) : null} />
    )}

    {/* Price chart modal */}
    {chartTeam && (
      <PriceChartModal
        team={chartTeam}
        history={historyByTeam[chartTeam.id] ?? []}
        onClose={() => setChartTeam(null)}
      />
    )}

    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0 }}>CFB Market</h1>
          <p style={{ color: 'var(--faint)', fontSize: 12, margin: 0 }}>{league.name}</p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileMenuOpen(v => !v)}
            style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 12px', color: 'var(--muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {profile?.display_name ?? 'Profile'} ▾
          </button>
          {profileMenuOpen && (
            <>
              <div onClick={() => setProfileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
              <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', minWidth: 140, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                <button onClick={() => { setEditingProfile(true); setProfileMenuOpen(false) }} style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  Edit Profile
                </button>
                <div style={{ height: 1, background: 'var(--line)' }} />
                <button onClick={() => supabase.auth.signOut()} style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!tradingOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <p style={{ fontWeight: 900, color: '#F59E0B', fontSize: 14, margin: 0 }}>Market Closed</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Trading closes Thursday evening and reopens Monday after prices settle.</p>
          </div>
        </div>
      )}

      {tradeSuccess && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(56,217,130,0.1)', color: '#38D982', border: '1px solid rgba(56,217,130,0.25)', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          {tradeSuccess}
          <button onClick={() => setTradeSuccess(null)} style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <PortfolioBar cash={cash} holdingsVal={holdingsVal} startCash={startCash} />

      {!hasAnyPrice && (
        <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 4 }}>Preseason — Prices Not Yet Set</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Prices settle each Monday once the season starts.</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--r-sm)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => changeTab(t.key)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: tab === t.key ? 'var(--surface-3)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--muted)', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'market' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedTeams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>No teams yet.</p>}
          {sortedTeams.map(team => (
            <MarketRow key={team.id} team={team}
              price={priceByTeam[team.id] ?? null}
              prevPrice={prevPriceByTeam[team.id] ?? null}
              history={historyByTeam[team.id] ?? []}
              holdings={holdings} cash={cash} priceByTeam={priceByTeam}
              tradingOpen={tradingOpen} onTrade={openTrade} onChart={setChartTeam} showPosition={false} />
          ))}
        </div>
      )}

      {tab === 'portfolio' && (() => {
        const myHeld = sortedTeams
          .filter(t => holdings.some(h => h.team_id === t.id))
          .sort((a, b) => {
            const av = (holdings.find(h => h.team_id === a.id)?.shares ?? 0) * (priceByTeam[a.id] ?? 0)
            const bv = (holdings.find(h => h.team_id === b.id)?.shares ?? 0) * (priceByTeam[b.id] ?? 0)
            return bv - av
          })
        if (myHeld.length === 0) {
          return (
            <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ fontSize: 28, marginBottom: 12 }}>📊</p>
              <p style={{ fontWeight: 900, color: '#fff', marginBottom: 6 }}>No positions yet</p>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Head to Market to buy your first shares.</p>
              <button type="button" className="btn btn--accent" onClick={() => changeTab('market')}>Browse teams</button>
            </div>
          )
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myHeld.map(team => (
              <MarketRow key={team.id} team={team}
                price={priceByTeam[team.id] ?? null}
                prevPrice={prevPriceByTeam[team.id] ?? null}
                history={historyByTeam[team.id] ?? []}
                holdings={holdings} cash={cash} priceByTeam={priceByTeam}
                tradingOpen={tradingOpen} onTrade={openTrade} onChart={setChartTeam} showPosition={true} />
            ))}
          </div>
        )
      })()}

      {tab === 'leaderboard' && (
        <LeaderboardTab
          accounts={leaderAccounts}
          allHoldings={leaderHoldings}
          priceByTeam={priceByTeam}
          members={members}
          currentUserId={user?.id}
          startCash={startCash}
        />
      )}
    </div>

    {tradeTeam && (
      <TradeModal
        team={tradeTeam}
        side={tradeSide}
        cash={cash}
        holdings={holdings}
        priceByTeam={priceByTeam}
        onConfirm={handleTradeConfirm}
        onCancel={() => { setTradeTeam(null); setTradeError(null) }}
        busy={tradeBusy}
        error={tradeError}
      />
    )}
    </>
  )
}
