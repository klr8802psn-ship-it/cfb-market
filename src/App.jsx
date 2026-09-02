import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LeagueProvider } from './context/LeagueContext'
import NavBar from './components/NavBar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Join from './pages/Join'
import Market from './pages/Market'
import Leaderboard from './pages/Leaderboard'

// Admin pages are platform-admin only — keep them out of the main bundle.
const Admin = lazy(() => import('./pages/Admin'))
const AdminLeague = lazy(() => import('./pages/AdminLeague'))

function Loading() {
  return <div style={{ color: 'var(--muted)', padding: 32 }}>Loading…</div>
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  const requestedPath = new URLSearchParams(location.search).get('next')
  const safeNextPath = requestedPath?.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/market'
  if (user) return <Navigate to={safeNextPath} replace />
  return children
}

function AppShell() {
  const { user } = useAuth()
  return (
    <>
      <Suspense fallback={<Loading />}>
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
      </Suspense>
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
