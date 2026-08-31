import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Admin() {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.user_metadata?.is_admin_platform === true
  if (!isAdmin) return <Navigate to="/market" replace />

  useEffect(() => {
    supabase
      .from('stock_config')
      .select('league_id, season_id, enabled, trading_open, leagues(id, name, invite_code)')
      .eq('enabled', true)
      .then(({ data }) => { setLeagues(data ?? []); setLoading(false) })
  }, [])

  return (
    <div className="page-container" style={{ paddingTop: 24 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, color: '#fff', marginBottom: 4 }}>Admin</h1>
      <p style={{ color: 'var(--faint)', fontSize: 13, marginBottom: 24 }}>Platform admin — all stock leagues</p>

      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
      ) : leagues.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No active stock leagues found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leagues.map(cfg => (
            <Link key={cfg.league_id} to={`/admin/league/${cfg.league_id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: 0 }}>{cfg.leagues?.name ?? cfg.league_id}</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--faint)', margin: 0 }}>
                    {cfg.trading_open ? '🟢 Trading open' : '🔴 Trading closed'}
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
