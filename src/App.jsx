import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Treino from './pages/Treino'
import { Nutricao, Evolucao, Perfil } from './pages/Placeholders'
import BottomNav from './components/BottomNav'

function PrivateLayout({ children }) {
  return (
    <div style={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}>
      <div style={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
        {children}
      </div>
      <BottomNav />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{
      height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 24, height: 24, border: '2px solid var(--border)',
        borderTopColor: 'var(--green)', borderRadius: '50%',
        animation: 'spin .7s linear infinite',
      }}/>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return null
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <PrivateLayout><Dashboard /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/treino" element={
        <PrivateRoute>
          <PrivateLayout><Treino /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/nutricao" element={
        <PrivateRoute>
          <PrivateLayout><Nutricao /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/evolucao" element={
        <PrivateRoute>
          <PrivateLayout><Evolucao /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="/perfil" element={
        <PrivateRoute>
          <PrivateLayout><Perfil /></PrivateLayout>
        </PrivateRoute>
      }/>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
