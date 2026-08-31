import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LeagueProvider } from './context/LeagueContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Join from './pages/Join'
import Market from './pages/Market'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ color: 'var(--muted)', padding: 32 }}>Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/market" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <LeagueProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/market" element={<RequireAuth><Market /></RequireAuth>} />
            <Route path="/leaderboard" element={<RequireAuth><div style={{ color: '#fff', padding: 32 }}>Leaderboard — coming soon</div></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth><div style={{ color: '#fff', padding: 32 }}>Admin — coming soon</div></RequireAuth>} />
            <Route path="/admin/league/:id" element={<RequireAuth><div style={{ color: '#fff', padding: 32 }}>AdminLeague — coming soon</div></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LeagueProvider>
    </AuthProvider>
  )
}
