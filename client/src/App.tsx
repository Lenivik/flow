import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProjectsPage from './pages/ProjectsPage'
import CanvasPage from './pages/CanvasPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-400">Loading...</div>
  return token ? <>{children}</> : <Navigate to="/login" />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-400">Loading...</div>
  return token ? <Navigate to="/projects" /> : <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/projects" element={<PrivateRoute><ProjectsPage /></PrivateRoute>} />
      <Route path="/projects/:id" element={<PrivateRoute><CanvasPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/projects" />} />
    </Routes>
  )
}
