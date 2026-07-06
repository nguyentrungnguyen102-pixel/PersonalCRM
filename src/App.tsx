import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { SettingsProvider } from './hooks/useSettings'
import { AppLayout } from './components/AppLayout'
import { Login } from './pages/Login'
import { Placeholder } from './pages/Placeholder'

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
        <Route path="/" element={<Placeholder titleKey="nav.dashboard" />} />
        <Route path="/danh-ba" element={<Placeholder titleKey="nav.contacts" />} />
        <Route path="/so-do" element={<Placeholder titleKey="nav.map" />} />
        <Route path="/nhac-nho" element={<Placeholder titleKey="nav.reminders" />} />
        <Route path="/nhom" element={<Placeholder titleKey="nav.groups" />} />
        <Route path="/cai-dat" element={<Placeholder titleKey="nav.settings" />} />
        <Route path="/nguoi/:id" element={<Placeholder titleKey="person.profile" />} />
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
