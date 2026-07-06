import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { SettingsProvider } from './hooks/useSettings'
import { AppLayout } from './components/AppLayout'
import { Contacts } from './pages/Contacts'
import { Dashboard } from './pages/Dashboard'
import { Groups } from './pages/Groups'
import { Login } from './pages/Login'
import { Placeholder } from './pages/Placeholder'
import { PersonProfile } from './pages/PersonProfile'
import { Reminders } from './pages/Reminders'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/danh-ba" element={<Contacts />} />
        <Route path="/so-do" element={<Placeholder titleKey="nav.map" />} />
        <Route path="/nhac-nho" element={<Reminders />} />
        <Route path="/nhom" element={<Groups />} />
        <Route path="/cai-dat" element={<Placeholder titleKey="nav.settings" />} />
        <Route path="/nguoi/:id" element={<PersonProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <AppRoutes />
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
