import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

    const { error } = await supabase.rpc('join_stock_league_by_invite_code', { p_code: code })

    if (error) {
      setError('Invalid invite link. Ask your commissioner for the correct URL.')
      setStatus('error')
      return
    }

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
