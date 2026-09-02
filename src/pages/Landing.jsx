import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TeamMark from '../components/TeamMark'

function fmtPrice(n) { return '$' + Number(n).toFixed(2) }
function fmtPct(n) { const v = Number(n) || 0; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%' }
function tone(v) { return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--faint)' }

const HOW = [
  ['Play money', 'No real cash, just bragging rights. Everyone starts with the same bankroll.'],
  ['Prices follow the rankings', 'Each team is priced off ESPN FPI and SP+. Climb the power rankings, the stock goes up.'],
  ['Settles every Monday', 'Trading locks Thursday night for gameday and reopens Monday morning with fresh prices.'],
  ['40% cap per team', 'No more than 40% of your portfolio in one team. Spread your bets.'],
  ['Best portfolio wins', 'Standings at the end of the season decide the champion.'],
]

function SnapshotCard({ rows, loading }) {
  if (!loading && !rows.length) return null
  const asOf = rows[0]?.settled_at ? new Date(rows[0].settled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null
  return (
    <div className="table" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--faint)', margin: 0 }}>
          Live market · top by price
        </p>
        {asOf && <p className="num" style={{ fontSize: 10, color: 'var(--faint)', margin: 0 }}>as of {asOf}</p>}
      </div>
      {loading
        ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="trow" style={{ cursor: 'default', minHeight: 48 }} aria-hidden>
              <div className="skeleton" style={{ height: 10, width: 16 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 11, width: `${40 + (i % 3) * 15}%` }} />
              </div>
              <div />
              <div className="skeleton" style={{ height: 12, width: 56, marginLeft: 'auto' }} />
            </div>
          ))
        : rows.map((r, i) => {
            const pct = r.prev_price ? ((r.price - r.prev_price) / r.prev_price) * 100 : null
            return (
              <div key={r.team_id} className="trow" style={{ cursor: 'default', minHeight: 48 }}>
                <span className={`rank ${i < 25 ? 'rank--top' : ''}`}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <TeamMark color={r.primary_color} color2={r.secondary_color} abbr={r.abbreviation} size="md" />
                  <div style={{ minWidth: 0 }}>
                    <p className="ellip" style={{ fontWeight: 700, color: '#fff', fontSize: 13, margin: 0 }}>{r.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--faint)', margin: 0, fontWeight: 600 }}>{r.conference}</p>
                  </div>
                </div>
                <div />
                <div className="text-right">
                  <p className="num" style={{ fontWeight: 900, fontSize: 13, color: '#fff', margin: 0 }}>{fmtPrice(r.price)}</p>
                  {pct != null && pct !== 0 && <p className="num" style={{ fontSize: 10, fontWeight: 900, color: tone(pct), margin: 0 }}>{fmtPct(pct)}</p>}
                </div>
              </div>
            )
          })}
    </div>
  )
}

export default function Landing() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_public_market_snapshot', { p_limit: 8 })
      .then(({ data, error }) => { setRows(error ? [] : (data ?? [])); setLoading(false) })
      .catch(() => { setRows([]); setLoading(false) })
  }, [])

  return (
    <div className="landing-container">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 4px' }}>
        <div className="wordmark">
          <svg width="24" height="24" viewBox="0 0 64 64" aria-hidden><rect width="64" height="64" rx="14" fill="#1E2C24" /><polyline points="10,46 22,36 30,40 42,24 54,16" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><polyline points="42,16 54,16 54,28" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          CFB Market
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Link to="/leaderboard" style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>Leaderboard</Link>
          <Link to="/login" style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
        </div>
      </header>

      <div className="landing-grid">
        <div className="landing-hero">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 14, fontWeight: 700 }}>
            CFB Season 2026 · Live
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(40px, 7vw, 64px)', lineHeight: 0.98, letterSpacing: '-0.035em', color: '#fff', marginBottom: 18 }}>
            Trade college<br />football teams.
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.55, marginBottom: 28, maxWidth: 440 }}>
            A play-money stock market for all 131 FBS teams. Prices move with ESPN FPI and SP+ power ratings
            and settle every Monday. Biggest portfolio at season's end wins.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/login" className="btn btn--accent" style={{ padding: '14px 24px', fontSize: 15 }}>Get started</Link>
            <Link to="/leaderboard" className="btn btn--ghost" style={{ padding: '14px 20px', fontSize: 15 }}>See standings</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: 24, marginTop: 36, justifyContent: 'start' }}>
            {[['131', 'FBS teams'], ['Mon', 'weekly settle'], ['40%', 'cap per team']].map(([v, l]) => (
              <div key={l}>
                <p className="num" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{v}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-preview">
          <SnapshotCard rows={rows} loading={loading} />
        </div>
      </div>

      <section style={{ margin: '48px 0 24px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 14 }}>How it works</p>
        <div className="landing-how-grid">
          {HOW.map(([title, desc], i) => (
            <div key={title} className="card" style={{ padding: 16 }}>
              <p className="num" style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, margin: '0 0 6px' }}>0{i + 1}</p>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: '0 0 4px' }}>{title}</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', paddingTop: 16, paddingBottom: 32 }}>
        CFB Market uses virtual play money. No real money is wagered or won. Team marks are color-only and not affiliated with any school.
      </p>
    </div>
  )
}
