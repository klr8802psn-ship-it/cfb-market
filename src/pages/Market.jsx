import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useLeague } from '../context/LeagueContext'
import TeamMark from '../components/TeamMark'
import PortfolioBar from '../components/PortfolioBar'
import TradeModal from '../components/TradeModal'
import ProfileSetup from '../components/ProfileSetup'
import AppBar from '../components/AppBar'
import TeamSheet from '../components/TeamSheet'
import { STOCK_START_CASH, holdingsValue, portfolioValue } from '../lib/stocks'
import { buildCostBasis, positionPL } from '../lib/costBasis'
import { nextClose, nextOpen, formatCountdown, formatShortDate } from '../lib/schedule'
import { avatarColor, initials } from '../lib/avatar'
import { parseInviteCode } from '../lib/invite'

function fmt(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toFixed(2)
}
function fmtSignedMoney(n) {
  const v = Number(n) || 0
  return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) {
  const v = Number(n) || 0
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%'
}
function toneColor(v) {
  return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--muted)'
}

// ── "How pricing works" info tooltip ──────────────────────────────────────────
function InfoTooltip() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label="How team pricing works"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'none',
          color: 'var(--faint)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit',
        }}
      >
        <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--line-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, lineHeight: 1 }}>?</span>
        How pricing works
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div
            style={{
              position: 'absolute', top: '140%', right: 0, width: 270, zIndex: 50,
              background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)',
              padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <p style={{ fontWeight: 900, color: '#fff', fontSize: 12, margin: '0 0 6px' }}>How pricing works</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, margin: '0 0 6px' }}>
              Each team's price tracks real performance data (ESPN FPI blended with SP+). Stronger teams cost more, weaker teams cost less.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, margin: '0 0 6px' }}>
              Prices also nudge up or down slightly based on how much traders are buying or selling a team.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, margin: '0 0 6px' }}>
              Prices settle every Monday after that week's games. No team ever drops below a $25 floor.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              You can't put more than 40% of your portfolio into a single team.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ prices, width = 44, height = 18 }) {
  if (!prices || prices.length < 2) return <span style={{ display: 'block', width, height }} aria-hidden />
  const vals = prices.map(p => typeof p === 'number' ? p : Number(p.price))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const step = width / (vals.length - 1)
  const points = vals.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 2) - 1).toFixed(1)}`).join(' ')
  const isUp = vals[vals.length - 1] >= vals[0]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ flexShrink: 0, display: 'block' }}>
      <polyline points={points} fill="none" stroke={isUp ? 'var(--positive)' : 'var(--negative)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Market table row ──────────────────────────────────────────────────────────
function TableRow({ team, rank, price, prevPrice, history, held, onOpen }) {
  const hasPrice = price != null
  const delta = hasPrice && prevPrice != null ? price - prevPrice : null
  const pct = delta != null && prevPrice ? (delta / prevPrice) * 100 : null
  return (
    <button type="button" className={`trow ${held > 0 ? 'trow--held' : ''}`} onClick={() => onOpen(team)} aria-label={`${team.name}, ${hasPrice ? fmtPrice(price) : 'not priced'}`}>
      <span className={`rank ${rank && rank <= 25 ? 'rank--top' : ''}`}>{rank ?? '–'}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <TeamMark color={team.primary_color} color2={team.secondary_color} abbr={team.abbreviation} size="md" />
        <span style={{ minWidth: 0 }}>
          <span className="ellip" style={{ display: 'block', fontWeight: 700, color: '#fff', fontSize: 13.5 }}>{team.name}</span>
          <span className="ellip" style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', fontWeight: 600, marginTop: 1 }}>
            {team.conference}
            {held > 0 && <span className="num" style={{ color: 'var(--accent)', fontWeight: 900 }}> · {held} sh</span>}
          </span>
        </span>
      </span>
      <Sparkline prices={history} />
      <span className="text-right">
        <span className="num" style={{ display: 'block', fontWeight: 900, fontSize: 14, color: '#fff' }}>{hasPrice ? fmtPrice(price) : '—'}</span>
        {delta != null && delta !== 0 ? (
          <span className="num" style={{ display: 'block', fontSize: 10.5, fontWeight: 900, color: toneColor(delta) }}>{delta > 0 ? '▲' : '▼'} {fmtPct(Math.abs(pct))}</span>
        ) : (
          <span className="num" style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)' }}>{hasPrice ? (delta === 0 ? 'unch' : '—') : ''}</span>
        )}
      </span>
    </button>
  )
}

// ── My Stocks row ─────────────────────────────────────────────────────────────
function PositionRow({ team, rank, price, prevPrice, held, basis, onOpen }) {
  const pl = price != null && basis ? positionPL({ shares: held, avgCost: basis.avgCost, price }) : null
  const delta = price != null && prevPrice != null ? price - prevPrice : null
  const pct = delta != null && prevPrice ? (delta / prevPrice) * 100 : null
  return (
    <button type="button" className="trow" onClick={() => onOpen(team)} style={{ gridTemplateColumns: 'minmax(0, 1fr) 96px 96px' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <TeamMark color={team.primary_color} color2={team.secondary_color} abbr={team.abbreviation} size="md" />
        <span style={{ minWidth: 0 }}>
          <span className="ellip" style={{ display: 'block', fontWeight: 700, color: '#fff', fontSize: 13.5 }}>
            {rank && <span className={`rank ${rank <= 25 ? 'rank--top' : ''}`} style={{ marginRight: 6 }}>#{rank}</span>}{team.name}
          </span>
          <span className="num ellip" style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>
            {held} sh · avg {basis ? fmtPrice(basis.avgCost) : '—'}
          </span>
        </span>
      </span>
      <span className="text-right">
        <span className="num" style={{ display: 'block', fontWeight: 900, fontSize: 13, color: '#fff' }}>{fmt(pl?.value ?? held * (price ?? 0))}</span>
        <span className="num" style={{ display: 'block', fontSize: 10.5, color: delta != null && delta !== 0 ? toneColor(delta) : 'var(--faint)' }}>
          {fmtPrice(price)}{delta != null && delta !== 0 ? ` ${delta > 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(1)}%` : ''}
        </span>
      </span>
      <span className="text-right">
        <span className="num" style={{ display: 'block', fontWeight: 900, fontSize: 13, color: pl ? toneColor(pl.pl) : 'var(--muted)' }}>{pl ? fmtSignedMoney(pl.pl) : '—'}</span>
        <span className="num" style={{ display: 'block', fontSize: 10.5, color: pl ? toneColor(pl.pl) : 'var(--faint)' }}>{pl ? fmtPct(pl.plPct) : ''}</span>
      </span>
    </button>
  )
}

// ── Search + filter chips ─────────────────────────────────────────────────────
function MarketFilters({ search, onSearch, filter, onFilter, chips }) {
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)', fontSize: 14 }}>⌕</span>
        <input
          type="search"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search teams or conferences"
          aria-label="Search teams"
          autoComplete="off"
          style={{ width: '100%', padding: '9px 36px 9px 32px', borderRadius: 'var(--r-sm)', background: 'var(--surface)', border: '1px solid var(--line)', color: '#fff', fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
        {search && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '6px 8px' }}>✕</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {chips.map(c => {
          const active = filter === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onFilter(c.key)}
              disabled={c.disabled}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--r-pill)', fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
                cursor: c.disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#160D02' : c.disabled ? '#475569' : 'var(--muted)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                opacity: c.disabled ? 0.6 : 1,
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.36 }} aria-hidden>
      {initials(name)}
    </span>
  )
}

function LeaderboardTab({ accounts, allHoldings, priceByTeam, prevPriceByTeam, hasAnyDelta, members, teamsById, currentUserId, startCash }) {
  const ranked = useMemo(() => {
    const rows = members.map(m => {
      const acct = accounts.find(a => a.user_id === m.user_id)
      const cash = acct ? Number(acct.cash) : startCash
      const holdings = allHoldings.filter(h => h.user_id === m.user_id).map(h => ({ team_id: h.team_id, shares: h.shares }))
      const total = portfolioValue({ cash, holdings, priceByTeam })
      // Value at last week's prices (current holdings), for rank movement
      const prevPrices = Object.fromEntries(Object.keys(priceByTeam).map(id => [id, prevPriceByTeam[id] ?? priceByTeam[id]]))
      const prevTotal = portfolioValue({ cash, holdings, priceByTeam: prevPrices })
      const top = [...holdings].sort((a, b) => (b.shares * (priceByTeam[b.team_id] ?? 0)) - (a.shares * (priceByTeam[a.team_id] ?? 0))).slice(0, 3)
      return { ...m, cash, total, prevTotal, pl: total - startCash, top }
    })
    const byPrev = [...rows].sort((a, b) => b.prevTotal - a.prevTotal).map(r => r.user_id)
    return rows.sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1, prevRank: byPrev.indexOf(r.user_id) + 1 }))
  }, [accounts, allHoldings, priceByTeam, prevPriceByTeam, members, startCash])

  if (!ranked.length) {
    return <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>No members yet.</p>
  }

  return (
    <div className="table">
      <div className="table__head" style={{ gridTemplateColumns: '26px minmax(0, 1fr) 96px' }}>
        <span>#</span><span>Player</span><span className="text-right">Portfolio</span>
      </div>
      {ranked.map(m => {
        const isMe = m.user_id === currentUserId
        const move = m.rank - m.prevRank   // negative = moved up
        return (
          <div key={m.user_id} className="trow" style={{ gridTemplateColumns: '26px minmax(0, 1fr) 96px', cursor: 'default', ...(isMe ? { background: 'rgba(245,158,11,0.05)' } : {}) }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <span className={`rank ${m.rank <= 3 ? 'rank--top' : ''}`} style={{ fontSize: 12 }}>{m.rank}</span>
              {hasAnyDelta && move !== 0 && (
                <span className="num" style={{ fontSize: 9, fontWeight: 900, color: move < 0 ? 'var(--positive)' : 'var(--negative)' }}>{move < 0 ? '▲' : '▼'}{Math.abs(move)}</span>
              )}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <Avatar name={m.display_name} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="ellip" style={{ display: 'block', fontWeight: 700, color: '#fff', fontSize: 13.5 }}>
                  {m.display_name ?? 'Unknown'}{isMe && <span style={{ color: 'var(--accent)', marginLeft: 6, fontSize: 10, fontWeight: 900 }}>YOU</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minHeight: 16 }}>
                  {m.top.length > 0 ? (
                    <span style={{ display: 'inline-flex', gap: 3 }}>
                      {m.top.map(h => {
                        const t = teamsById[h.team_id]
                        return t ? <TeamMark key={h.team_id} color={t.primary_color} color2={t.secondary_color} abbr={t.abbreviation} size="xs" title={`${t.name} · ${h.shares} sh`} /> : null
                      })}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--faint)' }}>all cash</span>
                  )}
                  {m.ob_handle && (
                    <span className="num ellip" style={{ fontSize: 10, color: 'var(--faint)' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>OB</span> · {m.ob_handle}
                    </span>
                  )}
                </span>
              </span>
            </span>
            <span className="text-right">
              <span className="num" style={{ display: 'block', fontWeight: 900, fontSize: 14, color: '#fff' }}>{fmt(m.total)}</span>
              <span className="num" style={{ display: 'block', fontSize: 10.5, fontWeight: 900, color: toneColor(m.pl) }}>{fmtSignedMoney(m.pl)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── League activity feed ──────────────────────────────────────────────────────
function relativeTime(iso, now) {
  const ms = now - new Date(iso)
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ActivityFeed({ transactions, teamsById, members, currentUserId, now, onOpen }) {
  const nameById = useMemo(() => Object.fromEntries(members.map(m => [m.user_id, m.display_name])), [members])
  if (!transactions.length) return null

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 8 }}>
        Recent trades
      </p>
      <div className="table">
        {transactions.map((tx, i) => {
          const team = teamsById[tx.team_id]
          const isBuy = tx.side === 'buy'
          const isMe = tx.user_id === currentUserId
          const who = isMe ? 'You' : (nameById[tx.user_id] ?? 'Someone')
          return (
            <button key={`${tx.created_at}-${tx.user_id}-${tx.team_id}-${i}`} type="button" className="trow" style={{ gridTemplateColumns: '28px minmax(0, 1fr) auto', minHeight: 48, padding: '8px 12px' }} onClick={() => team && onOpen(team)}>
              {team ? <TeamMark color={team.primary_color} color2={team.secondary_color} abbr={team.abbreviation} size="md" /> : <span />}
              <span style={{ minWidth: 0 }}>
                <span className="ellip" style={{ display: 'block', fontSize: 13, color: '#fff' }}>
                  <span style={{ fontWeight: 800, color: isMe ? 'var(--accent)' : '#fff' }}>{who}</span>
                  {' '}<span style={{ color: isBuy ? 'var(--positive)' : 'var(--negative)', fontWeight: 800 }}>{isBuy ? 'bought' : 'sold'}</span>
                  {' '}{tx.shares} {team?.abbreviation ?? 'sh'}
                </span>
                <span className="num" style={{ display: 'block', fontSize: 10, color: 'var(--faint)' }}>
                  @ {fmtPrice(tx.price)} · {fmt(Number(tx.shares) * Number(tx.price))}
                </span>
              </span>
              <span className="num" style={{ fontSize: 10, color: 'var(--faint)', whiteSpace: 'nowrap' }}>{relativeTime(tx.created_at, now)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function MarketSkeleton() {
  return (
    <>
      <div className="appbar"><div className="appbar__inner"><div className="skeleton" style={{ height: 18, width: 120 }} /><div className="skeleton" style={{ height: 24, width: 96, borderRadius: 100 }} /></div></div>
      <div className="page-container" aria-busy="true" aria-label="Loading market">
        <div className="card card--raised" style={{ padding: 20, marginBottom: 16, marginTop: 4 }}>
          <div className="skeleton" style={{ height: 10, width: 90, marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><div className="skeleton" style={{ height: 9, width: 40, marginBottom: 6 }} /><div className="skeleton" style={{ height: 20, width: 100 }} /></div>
            <div><div className="skeleton" style={{ height: 9, width: 50, marginBottom: 6 }} /><div className="skeleton" style={{ height: 20, width: 100 }} /></div>
          </div>
        </div>
        <div className="skeleton" style={{ height: 38, marginBottom: 12, borderRadius: 'var(--r-sm)' }} />
        <div className="table">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="trow" style={{ cursor: 'default' }}>
              <div className="skeleton" style={{ height: 10, width: 14, margin: '0 auto' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 11, width: `${45 + (i % 3) * 14}%`, marginBottom: 5 }} />
                  <div className="skeleton" style={{ height: 8, width: '22%' }} />
                </div>
              </div>
              <div />
              <div className="skeleton" style={{ height: 13, width: 60, marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Main Market page ──────────────────────────────────────────────────────────
const TAB_KEYS = ['market', 'portfolio', 'leaderboard']

export default function Market() {
  const { user, signOut, profile, profileLoaded, setProfile } = useAuth()
  const { league, config, memberLoading, memberError } = useLeague()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState(TAB_KEYS.includes(requestedTab) ? requestedTab : 'market')
  const [joinCode, setJoinCode] = useState('')
  const [cash, setCash] = useState(STOCK_START_CASH)
  const [holdings, setHoldings] = useState([])
  const [transactions, setTransactions] = useState([])
  const [teams, setTeams] = useState([])
  const [priceByTeam, setPriceByTeam] = useState({})
  const [prevPriceByTeam, setPrevPriceByTeam] = useState({})
  const [fpiByTeam, setFpiByTeam] = useState({})
  const [historyByTeam, setHistoryByTeam] = useState({})  // { price, date }[]
  const [lastSettledAt, setLastSettledAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState(null)
  const [leaderAccounts, setLeaderAccounts] = useState([])
  const [leaderHoldings, setLeaderHoldings] = useState([])
  const [members, setMembers] = useState([])
  const [leagueTx, setLeagueTx] = useState([])

  // Search / filter
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  // Clock for countdowns — ticks once a minute
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setTab(TAB_KEYS.includes(requestedTab) ? requestedTab : 'market')
  }, [requestedTab])

  // Team sheet + trade modal
  const [sheetTeam, setSheetTeam] = useState(null)
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
    setLoadErr(null)

    Promise.all([
      supabase.from('stock_accounts').select('cash').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id).maybeSingle(),
      supabase.from('stock_holdings').select('team_id, shares').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id),
      supabase.from('teams').select('id, name, abbreviation, primary_color, secondary_color, conference').eq('sport', 'CFB').order('name'),
      supabase.from('stock_prices').select('team_id, price, fpi, settled_at').eq('season_id', seasonId).order('settled_at', { ascending: false }),
      supabase.from('stock_accounts').select('user_id, cash').eq('league_id', league.id).eq('season_id', seasonId),
      supabase.from('stock_holdings').select('user_id, team_id, shares').eq('league_id', league.id).eq('season_id', seasonId),
      supabase.from('league_members').select('user_id, user:users(display_name, ob_handle)').eq('league_id', league.id),
      supabase.from('stock_transactions').select('team_id, side, shares, price, created_at').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id),
      supabase.from('stock_transactions').select('user_id, team_id, side, shares, price, created_at').eq('league_id', league.id).eq('season_id', seasonId).order('created_at', { ascending: false }).limit(30),
    ]).then(results => {
      const failed = results.find(result => result.error)
      if (failed) throw failed.error
      const [
        { data: acct }, { data: myHoldings }, { data: teamRows }, { data: allPrices },
        { data: leagueAccts }, { data: leagueHoldings }, { data: leagueMembers }, { data: myTx }, { data: recentTx },
      ] = results
      setCash(acct?.cash != null ? Number(acct.cash) : startCash)
      setHoldings((myHoldings ?? []).filter(h => h.shares > 0))
      setTransactions(myTx ?? [])
      setLeagueTx(recentTx ?? [])
      setTeams(teamRows ?? [])

      const prices = allPrices ?? []
      const byTeam = {}
      let newest = null
      for (const p of prices) {
        if (!byTeam[p.team_id]) byTeam[p.team_id] = []
        byTeam[p.team_id].push(p)
        if (p.settled_at && (!newest || new Date(p.settled_at) > newest)) newest = new Date(p.settled_at)
      }
      const latest = {}
      const prev = {}
      const hist = {}
      const fpi = {}
      for (const [teamId, records] of Object.entries(byTeam)) {
        const sorted = [...records].sort((a, b) => new Date(b.settled_at) - new Date(a.settled_at))
        latest[teamId] = Number(sorted[0].price)
        if (sorted[0].fpi != null) fpi[teamId] = Number(sorted[0].fpi)
        if (sorted[1]) prev[teamId] = Number(sorted[1].price)
        hist[teamId] = sorted.slice().reverse().map(r => ({ price: Number(r.price), date: r.settled_at }))
      }
      setPriceByTeam(latest)
      setPrevPriceByTeam(prev)
      setFpiByTeam(fpi)
      setHistoryByTeam(hist)
      setLastSettledAt(newest)
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
      supabase.from('stock_transactions').select('team_id, side, shares, price, created_at').eq('league_id', league.id).eq('season_id', seasonId).eq('user_id', user.id),
      supabase.from('stock_accounts').select('user_id, cash').eq('league_id', league.id).eq('season_id', seasonId),
      supabase.from('stock_holdings').select('user_id, team_id, shares').eq('league_id', league.id).eq('season_id', seasonId),
      supabase.from('stock_transactions').select('user_id, team_id, side, shares, price, created_at').eq('league_id', league.id).eq('season_id', seasonId).order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data: acct }, { data: myHoldings }, { data: myTx }, { data: leagueAccts }, { data: leagueHoldings }, { data: recentTx }]) => {
      setCash(acct?.cash != null ? Number(acct.cash) : startCash)
      setHoldings((myHoldings ?? []).filter(h => h.shares > 0))
      setTransactions(myTx ?? [])
      if (leagueAccts) setLeaderAccounts(leagueAccts)
      if (leagueHoldings) setLeaderHoldings(leagueHoldings.filter(h => h.shares > 0))
      if (recentTx) setLeagueTx(recentTx)
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
  const costBasis = useMemo(() => buildCostBasis(transactions), [transactions])
  const startCash = config?.start_cash ?? STOCK_START_CASH
  const tradingOpen = config?.trading_open !== false
  const hasAnyPrice = Object.keys(priceByTeam).length > 0
  const hasAnyDelta = Object.keys(prevPriceByTeam).length > 0
  const heldById = useMemo(() => Object.fromEntries(holdings.map(h => [h.team_id, h.shares])), [holdings])
  const teamsById = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams])

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => (priceByTeam[b.id] ?? -1) - (priceByTeam[a.id] ?? -1))
  }, [teams, priceByTeam])

  const rankById = useMemo(() => {
    const r = {}
    let i = 0
    for (const t of sortedTeams) if (priceByTeam[t.id] != null) r[t.id] = ++i
    return r
  }, [sortedTeams, priceByTeam])

  const visibleTeams = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = sortedTeams
    if (q) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.abbreviation ?? '').toLowerCase().includes(q) ||
        (t.conference ?? '').toLowerCase().includes(q)
      )
    }
    if (filter === 'top25') {
      list = list.filter(t => priceByTeam[t.id] != null).slice(0, 25)
    } else if (filter === 'movers') {
      list = list
        .filter(t => priceByTeam[t.id] != null && prevPriceByTeam[t.id] != null && priceByTeam[t.id] !== prevPriceByTeam[t.id])
        .sort((a, b) => {
          const pa = Math.abs((priceByTeam[a.id] - prevPriceByTeam[a.id]) / prevPriceByTeam[a.id])
          const pb = Math.abs((priceByTeam[b.id] - prevPriceByTeam[b.id]) / prevPriceByTeam[b.id])
          return pb - pa
        })
        .slice(0, 25)
    }
    return list
  }, [sortedTeams, search, filter, priceByTeam, prevPriceByTeam])

  const tickerItems = useMemo(() => {
    if (!hasAnyPrice) return []
    if (hasAnyDelta) {
      return sortedTeams
        .filter(t => prevPriceByTeam[t.id] != null && priceByTeam[t.id] !== prevPriceByTeam[t.id])
        .map(t => ({ team: t, price: priceByTeam[t.id], pct: ((priceByTeam[t.id] - prevPriceByTeam[t.id]) / prevPriceByTeam[t.id]) * 100 }))
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
        .slice(0, 14)
    }
    return sortedTeams.filter(t => priceByTeam[t.id] != null).slice(0, 14).map(t => ({ team: t, price: priceByTeam[t.id], pct: null }))
  }, [sortedTeams, priceByTeam, prevPriceByTeam, hasAnyPrice, hasAnyDelta])

  const chips = [
    { key: 'all', label: 'All' },
    { key: 'top25', label: 'Top 25' },
    { key: 'movers', label: 'Movers', disabled: !hasAnyDelta },
  ]

  const closeAt = nextClose(now)
  const openAt = nextOpen(now)

  if (memberLoading || loading) {
    return <MarketSkeleton />
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
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Paste the invite link or code from your commissioner to get started.</p>
        <form onSubmit={e => { e.preventDefault(); const code = parseInviteCode(joinCode); if (code) navigate(`/join/${encodeURIComponent(code)}`) }} className="card" style={{ padding: 16, textAlign: 'left', marginBottom: 16 }}>
          <label htmlFor="join-code" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Invite link or code</label>
          <input id="join-code" value={joinCode} onChange={e => setJoinCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="cfb-market.vercel.app/join/… or the code" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--line-2)', color: '#fff', fontFamily: 'inherit', fontSize: 15, marginBottom: 12 }} />
          {parseInviteCode(joinCode) && parseInviteCode(joinCode) !== joinCode.trim() && (
            <p className="num" style={{ fontSize: 11, color: 'var(--faint)', margin: '-4px 0 12px' }}>Code: {parseInviteCode(joinCode)}</p>
          )}
          <button type="submit" className="btn btn--accent" disabled={!parseInviteCode(joinCode)} style={{ width: '100%' }}>Join league</button>
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

  function openSheet(team) { setSheetTeam(team) }
  function openTrade(team, side) {
    setSheetTeam(null)
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

  const lastSettledLabel = lastSettledAt
    ? lastSettledAt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  const hasTicker = tickerItems.length > 0
  const stickTop = hasTicker ? '83px' : '53px'

  const myHeld = sortedTeams.filter(t => heldById[t.id] > 0)
    .sort((a, b) => (heldById[b.id] * (priceByTeam[b.id] ?? 0)) - (heldById[a.id] * (priceByTeam[a.id] ?? 0)))
  const totalCost = myHeld.reduce((s, t) => s + heldById[t.id] * (costBasis[t.id]?.avgCost ?? 0), 0)
  const unrealized = holdingsVal - totalCost
  const unrealizedPct = totalCost > 0 ? (unrealized / totalCost) * 100 : 0

  return (
    <>
    {profileLoaded && !profile?.display_name && (
      <ProfileSetup initial={profile} onComplete={p => setProfile(p)} onDismiss={null} />
    )}

    <AppBar
      leagueName={league.name}
      tradingOpen={tradingOpen}
      closeAt={closeAt}
      openAt={openAt}
      now={now}
      tickerItems={tickerItems}
      tickerLabel={hasAnyDelta ? 'Biggest movers since last settle' : 'Top teams by price'}
      onTickerSelect={openSheet}
    />

    <div className="page-container" style={{ '--stick-top': stickTop, paddingTop: 12 }}>
      {!tradingOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, color: 'var(--accent)', fontSize: 13, margin: 0 }}>Market closed for gameday</p>
            <p style={{ color: 'var(--muted)', fontSize: 11.5, margin: 0 }}>
              Reopens {formatShortDate(openAt)} at {openAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} after prices settle · in {formatCountdown(openAt, now)}
            </p>
          </div>
        </div>
      )}

      {tradeSuccess && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'var(--positive-soft)', color: 'var(--positive)', border: '1px solid var(--positive-line)', fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          {tradeSuccess}
          <button onClick={() => setTradeSuccess(null)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <PortfolioBar cash={cash} holdingsVal={holdingsVal} startCash={startCash} />

      {!hasAnyPrice && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)' }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, marginBottom: 4 }}>Preseason — prices not yet set</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Prices settle each Monday once the season starts.</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '-6px 0 6px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)' }}>
        <span>{lastSettledLabel ? `Prices as of ${lastSettledLabel}` : 'Prices not set yet'}</span>
        <InfoTooltip />
      </div>

      <div className="sticky-tabs">
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 4, borderRadius: 'var(--r-sm)', marginBottom: tab === 'market' ? 8 : 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => changeTab(t.key)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', background: tab === t.key ? 'var(--surface-3)' : 'transparent', color: tab === t.key ? '#fff' : 'var(--muted)', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'market' && (
          <MarketFilters search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} chips={chips} />
        )}
      </div>

      {tab === 'market' && (
        <div style={{ marginTop: 4 }}>
          {sortedTeams.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>No teams yet.</p>}
          {sortedTeams.length > 0 && visibleTeams.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
                {search ? `No teams match “${search.trim()}”.` : filter === 'movers' ? 'No price moves yet — check back after the next settle.' : 'Nothing here yet.'}
              </p>
              {(search || filter !== 'all') && (
                <button type="button" className="btn btn--ghost" style={{ marginTop: 12, fontSize: 12, padding: '8px 14px' }} onClick={() => { setSearch(''); setFilter('all') }}>Clear filters</button>
              )}
            </div>
          )}
          {visibleTeams.length > 0 && (
            <div className="table">
              <div className="table__head">
                <span>#</span><span>Team</span><span style={{ textAlign: 'center' }}>Trend</span><span className="text-right">Price · Chg</span>
              </div>
              {visibleTeams.map(team => (
                <TableRow key={team.id} team={team}
                  rank={rankById[team.id]}
                  price={priceByTeam[team.id] ?? null}
                  prevPrice={prevPriceByTeam[team.id] ?? null}
                  history={historyByTeam[team.id] ?? []}
                  held={heldById[team.id] ?? 0}
                  onOpen={openSheet} />
              ))}
            </div>
          )}
          {visibleTeams.length > 0 && visibleTeams.length < sortedTeams.length && (
            <p className="num" style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', margin: '10px 0 0' }}>
              Showing {visibleTeams.length} of {sortedTeams.length} teams
            </p>
          )}
          <p style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'center', margin: '14px 0 0' }}>Tap a team to see its chart and trade.</p>
        </div>
      )}

      {tab === 'portfolio' && (
        <div style={{ marginTop: 4 }}>
          {myHeld.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ fontSize: 28, marginBottom: 12 }}>📊</p>
              <p style={{ fontWeight: 900, color: '#fff', marginBottom: 6 }}>No positions yet</p>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>Head to Market and tap a team to buy your first shares.</p>
              <button type="button" className="btn btn--accent" onClick={() => changeTab('market')}>Browse teams</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', border: '1px solid var(--line)', marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', margin: 0 }}>Unrealized gain / loss</p>
                  <p className="num" style={{ fontSize: 11, color: 'var(--faint)', margin: 0 }}>cost {fmt(totalCost)} · now {fmt(holdingsVal)}</p>
                </div>
                <p className="num" style={{ fontWeight: 900, fontSize: 16, margin: 0, color: toneColor(unrealized) }}>
                  {fmtSignedMoney(unrealized)} <span style={{ fontSize: 11 }}>({fmtPct(unrealizedPct)})</span>
                </p>
              </div>
              <div className="table">
                <div className="table__head" style={{ gridTemplateColumns: 'minmax(0, 1fr) 96px 96px' }}>
                  <span>Position</span><span className="text-right">Value · Price</span><span className="text-right">Gain / loss</span>
                </div>
                {myHeld.map(team => (
                  <PositionRow key={team.id} team={team}
                    rank={rankById[team.id]}
                    price={priceByTeam[team.id] ?? null}
                    prevPrice={prevPriceByTeam[team.id] ?? null}
                    held={heldById[team.id]}
                    basis={costBasis[team.id]}
                    onOpen={openSheet} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div style={{ marginTop: 4 }}>
          <LeaderboardTab
            accounts={leaderAccounts}
            allHoldings={leaderHoldings}
            priceByTeam={priceByTeam}
            prevPriceByTeam={prevPriceByTeam}
            hasAnyDelta={hasAnyDelta}
            members={members}
            teamsById={teamsById}
            currentUserId={user?.id}
            startCash={startCash}
          />
          <ActivityFeed transactions={leagueTx} teamsById={teamsById} members={members} currentUserId={user?.id} now={now} onOpen={openSheet} />
        </div>
      )}
    </div>

    {sheetTeam && (
      <TeamSheet
        team={sheetTeam}
        rank={rankById[sheetTeam.id]}
        price={priceByTeam[sheetTeam.id] ?? null}
        prevPrice={prevPriceByTeam[sheetTeam.id] ?? null}
        fpi={fpiByTeam[sheetTeam.id] ?? null}
        history={historyByTeam[sheetTeam.id] ?? []}
        held={heldById[sheetTeam.id] ?? 0}
        basis={costBasis[sheetTeam.id]}
        cash={cash}
        holdings={holdings}
        priceByTeam={priceByTeam}
        tradingOpen={tradingOpen}
        onBuy={t => openTrade(t, 'buy')}
        onSell={t => openTrade(t, 'sell')}
        onClose={() => setSheetTeam(null)}
      />
    )}

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
