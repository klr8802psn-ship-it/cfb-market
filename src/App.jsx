import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LeagueProvider } from './context/LeagueContext'
import NavBar from './components/NavBar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Join from './pages/Join'
import Market from './pages/Market'
import Leaderboard from './pages/Leaderboard'
import Admin from './pages/Admin'
import AdminLeague from './pages/AdminLeague'

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

function AppShell() {
  const { user } = useAuth()
  return (
    <>
      <Routes>
        <Route path="/" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
        <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/market" element={<RequireAuth><Market /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/admin/league/:id" element={<RequireAuth><AdminLeague /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {user && <NavBar />}
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <LeagueProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </LeagueProvider>
    </AuthProvider>
  )
}
