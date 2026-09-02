import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Join() {
  const { code } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading') // 'loading' | 'joining' | 'error'

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate(`/login?next=/join/${code}`)
      return
    }
    join()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  async function join() {
    setStatus('joining')

    const { data, error } = await supabase.rpc('join_stock_league_by_invite_code', { p_code: code })

    if (error || !data || data.length === 0) {
      setStatus('error')
      return
    }

    // Reload so LeagueContext fetches the newly-created membership.
    window.location.replace('/market')
  }

  if (status === 'error') {
    return (
      <div className="page-container" style={{ paddingTop: 60, textAlign: 'center' }}>
        <p style={{ fontSize: 32, marginBottom: 16 }}>⚠️</p>
        <p style={{ fontWeight: 700, color: '#fff', marginBottom: 8 }}>Invalid or Expired Invite</p>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
          This invite link doesn't work. Ask your league admin for a new one.
        </p>
        <Link to="/" style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>← Back to homepage</Link>
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
