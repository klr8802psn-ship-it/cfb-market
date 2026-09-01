import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLeague } from '../context/LeagueContext'
import { supabase } from '../lib/supabase'

export default function NavBar() {
  const { user } = useAuth()
  const { allLeagues, league, selectLeague } = useLeague()
  const isAdmin = user?.user_metadata?.is_admin_platform === true
  const multiLeague = allLeagues.length > 1

  const linkStyle = (isActive) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 700, textDecoration: 'none', padding: '8px 16px',
    color: isActive ? '#F59E0B' : 'var(--muted)', transition: 'color 0.15s',
  })

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', zIndex: 40, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {multiLeague && (
        <div style={{ borderBottom: '1px solid var(--line)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>League</span>
          <select
            value={league?.id ?? ''}
            onChange={e => selectLeague(e.target.value)}
            style={{
              flex: 1, background: 'var(--bg)', color: '#fff', border: '1px solid var(--line)',
              borderRadius: 6, fontSize: 12, fontWeight: 700, padding: '3px 8px',
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            {allLeagues.map(({ league: l }) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        <NavLink to="/market" style={({ isActive }) => linkStyle(isActive)}>
          <span style={{ fontSize: 18 }}>📈</span>
          Market
        </NavLink>
        <NavLink to="/leaderboard" style={({ isActive }) => linkStyle(isActive)}>
          <span style={{ fontSize: 18 }}>🏆</span>
          Board
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            Admin
          </NavLink>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '8px 16px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: 18 }}>🚪</span>
          Sign Out
        </button>
      </div>
    </nav>
  )
}
