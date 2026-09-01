import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLeague } from '../context/LeagueContext'

export default function NavBar() {
  const { isPlatformAdmin } = useAuth()
  const { allLeagues, league, selectLeague } = useLeague()
  const multiLeague = allLeagues.length > 1

  const linkStyle = (isActive) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 700, textDecoration: 'none', padding: '8px 16px',
    color: isActive ? '#F59E0B' : 'var(--muted)', transition: 'color 0.15s',
  })

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', zIndex: 40, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {multiLeague && (
        <div style={{ borderBottom: '1px solid var(--line)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--faint)', flexShrink: 0 }}>League</span>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {allLeagues.map(({ league: l }) => (
              <button
                key={l.id}
                onClick={() => selectLeague(l.id)}
                style={{
                  flex: 1, padding: '4px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.15s',
                  background: league?.id === l.id ? '#F59E0B' : 'var(--bg)',
                  color: league?.id === l.id ? '#000' : 'var(--muted)',
                }}
              >
                {l.name}
              </button>
            ))}
          </div>
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
        {isPlatformAdmin && (
          <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
            <span style={{ fontSize: 18 }}>⚙️</span>
            Admin
          </NavLink>
        )}
      </div>
    </nav>
  )
}
