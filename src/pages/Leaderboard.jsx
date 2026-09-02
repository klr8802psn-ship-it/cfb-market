import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function SkeletonRows({ count = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="skeleton" style={{ width: 32, height: 32 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 9, width: '30%' }} />
          </div>
          <div className="skeleton" style={{ height: 14, width: 64 }} />
        </div>
      ))}
    </div>
  )
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const leagueParam = searchParams.get('league')
  const [leagues, setLeagues] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [board, setBoard] = useState([])
  const [leagueName, setLeagueName] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setError(null)
    setLoading(true)
    supabase.rpc('get_public_stock_leagues').then(({ data, error: leagueError }) => {
      const list = leagueError ? [] : (data ?? [])
      setLeagues(list)
      if (!list.length) { setLoading(false); return }
      const matched = leagueParam ? list.find(l => l.invite_code === leagueParam) : null
      const pick = matched ?? list[0]
      setLeagueName(pick.name)
      // If the selection didn't change, the board effect won't re-run — force it via reloadKey.
      setSelectedId(prev => {
        if (prev === pick.id) setReloadKey(k => k + 1)
        return pick.id
      })
    }).catch(() => {
      setLeagues([])
      setLoading(false)
    })
  }, [leagueParam])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    supabase.rpc('get_stock_leaderboard', { p_league_id: selectedId }).then(({ data, error: boardError }) => {
      if (boardError) {
        setError('We could not load these standings. Check your connection and try again.')
        setLoading(false)
        return
      }
      setBoard(data ?? [])
      setLastUpdated(new Date())
      setLoading(false)
    })
  }, [selectedId, reloadKey])

  function handleLeagueChange(id) {
    const l = leagues.find(x => x.id === id)
    setSelectedId(id)
    setLeagueName(l?.name ?? '')
  }

  const medal = ['🥇', '🥈', '🥉']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 2px' }}>CFB Market</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: '#fff', margin: 0 }}>Leaderboard</h1>
        </div>
        {user ? (
          <Link to="/market" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>Market →</Link>
        ) : (
          <Link to="/login" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>Sign In →</Link>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
        {leagues.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', margin: '0 0 6px' }}>League</p>
            <div role="tablist" aria-label="League" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {leagues.map(l => {
                const active = l.id === selectedId
                return (
                  <button key={l.id} type="button" role="tab" aria-selected={active} onClick={() => handleLeagueChange(l.id)}
                    style={{
                      flexShrink: 0, padding: '8px 14px', borderRadius: 'var(--r-pill)', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#160D02' : 'var(--muted)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`, transition: 'all 0.15s',
                    }}>
                    {l.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {leagues.length === 1 && (
          <p style={{ fontWeight: 900, color: '#fff', fontSize: 16, marginBottom: 16 }}>{leagueName}</p>
        )}

        {lastUpdated && !loading && (
          <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {error ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 28, margin: '0 0 12px' }}>⚠️</p>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>{error}</p>
            <button className="btn btn--accent" onClick={() => setReloadKey(key => key + 1)}>Try again</button>
          </div>
        ) : loading ? (
          <SkeletonRows />
        ) : leagues.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 12px' }}>🏈</p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No public leagues yet. Join a league with an invite link to get started.</p>
          </div>
        ) : board.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 32, margin: '0 0 12px' }}>⏳</p>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No standings yet — check back after the first settle.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {board.map((row, idx) => {
              const isMe = user && row.user_id === user.id
              return (
                <div key={row.user_id ?? idx} className="card row-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, ...(isMe ? { borderColor: 'var(--accent-line)', background: 'rgba(245,158,11,0.04)' } : {}) }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: idx < 3 ? 18 : 12, flexShrink: 0, background: idx === 0 ? 'var(--accent-soft)' : 'rgba(255,255,255,0.05)', color: idx === 0 ? 'var(--accent)' : '#94a3b8', border: idx === 0 ? '1px solid var(--accent-line)' : '1px solid rgba(255,255,255,0.06)' }}>
                    {idx < 3 ? medal[idx] : idx + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.display_name}
                      </p>
                      {isMe && <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--accent)', flexShrink: 0 }}>You</span>}
                    </div>
                    {row.ob_handle && (
                      <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>OB</span> · {row.ob_handle}
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 15, color: '#fff', margin: 0 }}>{fmt(row.total_value)}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', margin: 0 }}>
                      {fmt(row.cash)} cash · {fmt(row.holdings_value)} stocks
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', marginTop: 32 }}>
          CFB Market uses virtual play money. No real money is wagered or won.
        </p>
      </div>
    </div>
  )
}
