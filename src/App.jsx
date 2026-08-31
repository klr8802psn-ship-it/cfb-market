import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div style={{ color: '#fff', padding: 32 }}>CFB Market — coming soon</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
