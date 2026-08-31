import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLeague } from '../context/LeagueContext'
import TeamMark from '../components/TeamMark'
import PortfolioBar from '../components/PortfolioBar'
import TradeModal from '../components/TradeModal'
import { STOCK_START_CASH, holdingsValue, validateBuy, validateSell } from '../lib/stocks'

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

function Sparkline({ prices, width = 44, height = 18 }) {
  if (!prices || prices.length < 2) return null
  const vals = prices.map(Number)
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

function MarketRow({ team, price, prevPrice, history, holdings, cash, priceByTeam, tradingOpen, onTrade, showPosition }) {
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
      <Sparkline prices={history} />
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

export default function Market() {
  const { user } = useAuth()
  const { league, config, memberLoading } = useLeague()
  const [tab, setTab] = useState('market')
  const [cash, setCash] = useState(STOCK_START_CASH)
  const [holdings, setHoldings] = useState([])
  const [teams, setTeams] = useState([])
  const [priceByTeam, setPriceByTeam] = useState({})
  const [prevPriceByTeam, setPrevPriceByTeam] = useState({})
  const [historyByTeam, setHistoryByTeam] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)

  // Trade modal state
  const [tradeTeam, setTradeTeam] = useState(null)
  const [tradeSide, setTradeSide] = useState('buy')
  const [tradeSuccess, setTradeSuccess] = useState(null)
  const [tradeBusy, setTradeBusy] = useState(false)
  const [tradeError, setTradeError] = useState(null)

  useEffect(() => {
    if (!config || !user || !league) { setLoading(false); return }
    const seasonId = config.season_id
    const startCash = config.start_cash ?? STOCK_START_CASH
    setLoading(true)

    Promise.all([
      supabase.from('stock_accounts').select('cash').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id).maybeSingle(),
      supabase.from('stock_holdings').select('team_id, shares').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id),
      supabase.from('teams').select('id, name, abbreviation, primary_color').eq('sport', 'CFB').order('name'),
      supabase.from('stock_prices').select('team_id, price, settled_at').eq('season_id', seasonId).order('settled_at', { ascending: false }),
    ]).then(([{ data: acct }, { data: myHoldings }, { data: teamRows }, { data: allPrices }]) => {
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
        hist[teamId] = sorted.slice().reverse().map(r => Number(r.price))
      }
      setPriceByTeam(latest)
      setPrevPriceByTeam(prev)
      setHistoryByTeam(hist)
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

  // Gate renders
  if (memberLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(245,158,11,0.5)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!league || !config) {
    return (
      <div className="page-container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🏈</p>
        <p style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>You're not in a league</p>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ask your commissioner for an invite link.</p>
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

  // Segmented tabs
  const TABS = [{ key: 'market', label: 'Market' }, { key: 'portfolio', label: 'My Stocks' }, { key: 'leaderboard', label: 'Leaderboard' }]

  return (
    <>
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0 }}>CFB Market</h1>
          <p style={{ color: 'var(--faint)', fontSize: 12, margin: 0 }}>{league.name}</p>
        </div>
      </div>

      {/* Trading closed banner */}
      {!tradingOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <p style={{ fontWeight: 900, color: '#F59E0B', fontSize: 14, margin: 0 }}>Market Closed</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Trading pauses at kickoff and reopens Monday after prices settle.</p>
          </div>
        </div>
      )}

      {/* Trade success toast */}
      {tradeSuccess && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(56,217,130,0.1)', color: '#38D982', border: '1px solid rgba(56,217,130,0.25)', fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          {tradeSuccess}
          <button onClick={() => setTradeSuccess(null)} style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <PortfolioBar cash={cash} holdingsVal={holdingsVal} startCash={startCash} />

      {/* Preseason notice */}
      {!hasAnyPrice && (
        <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 4 }}>Preseason — Prices Not Yet Set</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Prices settle each Monday once the season starts.</p>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--r-sm)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, background: tab === t.key ? 'var(--surface-3)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--muted)', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Market tab */}
      {tab === 'market' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedTeams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>No teams yet.</p>}
          {sortedTeams.map(team => (
            <MarketRow key={team.id} team={team}
              price={priceByTeam[team.id] ?? null}
              prevPrice={prevPriceByTeam[team.id] ?? null}
              history={historyByTeam[team.id] ?? []}
              holdings={holdings} cash={cash} priceByTeam={priceByTeam}
              tradingOpen={tradingOpen} onTrade={openTrade} showPosition={false} />
          ))}
        </div>
      )}

      {/* My Stocks tab */}
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
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Head to Market to buy your first shares.</p>
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
                tradingOpen={tradingOpen} onTrade={openTrade} showPosition={true} />
            ))}
          </div>
        )
      })()}

      {/* Leaderboard tab stub — filled in Task 6 */}
      {tab === 'leaderboard' && (
        <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>Leaderboard coming soon.</p>
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
