import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  useEffect(() => {
    supabase.rpc('get_public_stock_leagues').then(({ data }) => {
      const list = data ?? []
      setLeagues(list)
      if (!list.length) { setLoading(false); return }
      const matched = leagueParam ? list.find(l => l.invite_code === leagueParam) : null
      const pick = matched ?? list[0]
      setSelectedId(pick.id)
      setLeagueName(pick.name)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    supabase.rpc('get_stock_leaderboard', { p_league_id: selectedId }).then(({ data }) => {
      setBoard(data ?? [])
      setLastUpdated(new Date())
      setLoading(false)
    })
  }, [selectedId])

  function handleLeagueChange(id) {
    const l = leagues.find(x => x.id === id)
    setSelectedId(id)
    setLeagueName(l?.name ?? '')
  }

  const medal = ['🥇', '🥈', '🥉']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 2px' }}>CFB Market</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20, color: '#fff', margin: 0 }}>Leaderboard</h1>
        </div>
        {user ? (
          <Link to="/market" style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>Market →</Link>
        ) : (
          <Link to="/login" style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>Sign In →</Link>
        )}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>
        {/* League selector */}
        {leagues.length > 1 && (
          <select
            value={selectedId ?? ''}
            onChange={e => handleLeagueChange(e.target.value)}
            style={{ width: '100%', background: 'var(--surface)', color: '#fff', border: '1px solid var(--line)', borderRadius: 10, fontSize: 14, fontWeight: 700, padding: '10px 14px', fontFamily: 'inherit', marginBottom: 16, cursor: 'pointer' }}
          >
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}

        {leagues.length === 1 && (
          <p style={{ fontWeight: 900, color: '#fff', fontSize: 16, marginBottom: 16 }}>{leagueName}</p>
        )}

        {lastUpdated && (
          <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 16, fontFamily: 'var(--font-mono)' }}>
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(245,158,11,0.5)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
              const pl = Number(row.total_value) - Number(row.cash) - Number(row.holdings_value) + Number(row.holdings_value)
              const startVal = board.reduce((min, r) => Math.min(min, Number(r.total_value)), Number(board[0]?.total_value ?? 0))
              const gainLoss = Number(row.total_value) - (Number(row.cash) + Number(row.holdings_value) - Number(row.holdings_value))
              return (
                <div key={row.user_id ?? idx} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, ...(isMe ? { borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.04)' } : {}) }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: idx < 3 ? 18 : 12, flexShrink: 0, background: idx === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', color: idx === 0 ? '#F59E0B' : '#94a3b8', border: idx === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                    {idx < 3 ? medal[idx] : idx + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.display_name}
                      </p>
                      {isMe && <span style={{ fontSize: 10, fontWeight: 900, color: '#F59E0B', flexShrink: 0 }}>You</span>}
                    </div>
                    {row.ob_handle && (
                      <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0, fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: '#F59E0B', fontWeight: 700 }}>OB</span> · {row.ob_handle}
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
