import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { STOCK_START_CASH } from '../lib/stocks'

export default function Join() {
  const { code } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'joining' | 'error'
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Not signed in — save code and redirect to login
      sessionStorage.setItem('joinCode', code)
      navigate(`/login?next=/join/${code}`)
      return
    }
    join()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  async function join() {
    setStatus('joining')
    // 1. Find the league by invite_code
    const { data: league, error: leagueErr } = await supabase
      .from('leagues')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()

    if (leagueErr || !league) {
      setError('Invalid invite link. Ask your commissioner for the correct URL.')
      setStatus('error')
      return
    }

    // 2. Get the active stock_config for this league
    const { data: cfg, error: cfgErr } = await supabase
      .from('stock_config')
      .select('season_id, start_cash, enabled')
      .eq('league_id', league.id)
      .eq('enabled', true)
      .maybeSingle()

    if (cfgErr || !cfg) {
      setError("This league doesn't have an active stock season yet.")
      setStatus('error')
      return
    }

    // 3. Insert into league_members (ignore conflict — already a member)
    await supabase
      .from('league_members')
      .upsert({ league_id: league.id, user_id: user.id, role: 'member' }, { onConflict: 'league_id,user_id' })

    // 4. Seed stock_accounts (ignore conflict — account already exists)
    await supabase
      .from('stock_accounts')
      .upsert(
        { league_id: league.id, season_id: cfg.season_id, user_id: user.id, cash: cfg.start_cash ?? STOCK_START_CASH },
        { onConflict: 'league_id,season_id,user_id' }
      )

    navigate('/market', { replace: true })
  }

  if (status === 'error') {
    return (
      <div className="page-container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>⚠️</p>
        <p style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>Couldn't join</p>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ paddingTop: 80, textAlign: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(245,158,11,0.5)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Joining league…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
