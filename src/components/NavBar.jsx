import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user } = useAuth()
  const isAdmin = user?.user_metadata?.is_admin_platform === true

  const linkStyle = (isActive) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 700, textDecoration: 'none', padding: '8px 16px',
    color: isActive ? '#F59E0B' : 'var(--muted)', transition: 'color 0.15s',
  })

  return (
    <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center', gap: 8, zIndex: 40, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <NavLink to="/market" style={({ isActive }) => linkStyle(isActive)}>
        <span style={{ fontSize: 18 }}>📈</span>
        Market
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          Admin
        </NavLink>
      )}
    </nav>
  )
}
