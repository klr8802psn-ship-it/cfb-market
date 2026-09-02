import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLeague } from '../context/LeagueContext'
import ProfileSetup from './ProfileSetup'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function NavBar() {
  const { isPlatformAdmin, profile, setProfile, signOut } = useAuth()
  const { allLeagues, league, selectLeague } = useLeague()
  const location = useLocation()
  const multiLeague = allLeagues.length > 1
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)

  const isLeaderboard = location.pathname === '/market' && location.search.includes('tab=leaderboard')
  const isMarket = location.pathname === '/market' && !isLeaderboard

  const linkStyle = (isActive) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 700, textDecoration: 'none', padding: '8px 14px', minWidth: 64,
    color: isActive ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.15s',
    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <>
      {editing && (
        <ProfileSetup
          initial={profile}
          onComplete={p => { setProfile(p); setEditing(false) }}
          onDismiss={() => setEditing(false)}
        />
      )}

      {menuOpen && <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 41 }} />}

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--line)', zIndex: 42, paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
                    background: league?.id === l.id ? 'var(--accent)' : 'var(--bg)',
                    color: league?.id === l.id ? '#160D02' : 'var(--muted)',
                  }}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 4, position: 'relative' }}>
          <NavLink to="/market" style={() => linkStyle(isMarket)}>
            <span style={{ fontSize: 18 }}>📈</span>
            Market
          </NavLink>
          <NavLink to="/market?tab=leaderboard" style={() => linkStyle(isLeaderboard)}>
            <span style={{ fontSize: 18 }}>🏆</span>
            Leaderboard
          </NavLink>
          {isPlatformAdmin && (
            <NavLink to="/admin" style={({ isActive }) => linkStyle(isActive)}>
              <span style={{ fontSize: 18 }}>⚙️</span>
              Admin
            </NavLink>
          )}
          <button type="button" onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen} style={linkStyle(menuOpen)}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 900, fontFamily: 'var(--font-mono)',
              background: menuOpen ? 'var(--accent)' : 'var(--surface-3)', color: menuOpen ? '#160D02' : '#fff',
              border: '1px solid var(--line-2)',
            }}>
              {initials(profile?.display_name)}
            </span>
            Me
          </button>

          {menuOpen && (
            <div role="menu" style={{ position: 'absolute', right: 12, bottom: 'calc(100% + 8px)', minWidth: 190, background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 43 }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                <p style={{ fontWeight: 800, color: '#fff', fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.display_name ?? 'Your profile'}</p>
                {profile?.ob_handle && (
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--faint)', margin: 0 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>OB</span> · {profile.ob_handle}
                  </p>
                )}
              </div>
              <button role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false) }} style={{ display: 'block', width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                Edit profile
              </button>
              <div style={{ height: 1, background: 'var(--line)' }} />
              <button role="menuitem" onClick={() => { setMenuOpen(false); signOut() }} style={{ display: 'block', width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: 'var(--negative)', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  )

}

