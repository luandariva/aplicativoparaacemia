import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { PortalProvider } from './portal/PortalContext'
import { PortalShell } from './portal/PortalShell'
import { LoginPage } from './pages/LoginPage'
import { SemAcessoPage } from './pages/SemAcessoPage'
import { DashboardPage } from './pages/DashboardPage'
import { AlunosPage } from './pages/AlunosPage'
import { AlunoDetailPage } from './pages/AlunoDetailPage'
import { PrescreverTreinoPage } from './pages/PrescreverTreinoPage'
import { TreinosAcademiaPage } from './pages/TreinosAcademiaPage'
import { ConvitesPage } from './pages/ConvitesPage'

export default function App() {
  return (
    <BrowserRouter>
      <PortalProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sem-acesso" element={<SemAcessoPage />} />

          <Route element={<PortalShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/alunos" element={<AlunosPage />} />
            <Route path="/alunos/:usuarioId" element={<AlunoDetailPage />} />
            <Route
              path="/alunos/:usuarioId/prescrever"
              element={<PrescreverTreinoPage />}
            />
            <Route path="/treinos-academia" element={<TreinosAcademiaPage />} />
            <Route path="/treinos-academia/novo" element={<PrescreverTreinoPage catalogo />} />
            <Route path="/convites" element={<ConvitesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </PortalProvider>
    </BrowserRouter>
  )
}

