import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabaseConfigured } from './lib/supabase'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { SettingsProvider } from './hooks/useSettings'
import { AppLayout } from './components/AppLayout'
import { Contacts } from './pages/Contacts'
import { Dashboard } from './pages/Dashboard'
import { Diagram } from './pages/Diagram'
import { Groups } from './pages/Groups'
import { ImportCsv } from './pages/ImportCsv'
import { Inbox } from './pages/Inbox'
import { Login } from './pages/Login'
import { NameSuggestions } from './pages/NameSuggestions'
import { PersonProfile } from './pages/PersonProfile'
import { Reminders } from './pages/Reminders'
import { Settings } from './pages/Settings'

const GiaPha = lazy(() => import('./pages/GiaPha'))
const ImportGiaPha = lazy(() => import('./pages/ImportGiaPha'))

function SuspenseFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
    </div>
  )
}

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

// Trang Cai dat chi danh cho admin — editor/viewer go thang URL se bi day ve
// trang chu (RLS backend da chan ghi san, day la lop bao ve UI).
function RequireAdmin({ children }: { children: ReactNode }) {
  const { role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
    )
  }

  if (role !== 'admin') {
    return <Navigate to="/" replace />
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
        <Route path="/nhap-danh-ba" element={<ImportCsv />} />
        <Route path="/goi-y-ten" element={<NameSuggestions />} />
        <Route path="/so-do" element={<Diagram />} />
        <Route
          path="/gia-pha"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <GiaPha />
            </Suspense>
          }
        />
        <Route
          path="/nhap-gia-pha"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <ImportGiaPha />
            </Suspense>
          }
        />
        <Route path="/nhac-nho" element={<Reminders />} />
        <Route path="/nhom" element={<Groups />} />
        <Route path="/hop-thu" element={<Inbox />} />
        <Route
          path="/cai-dat"
          element={
            <RequireAdmin>
              <Settings />
            </RequireAdmin>
          }
        />
        <Route path="/nguoi/:id" element={<PersonProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  // Lỗi cấu hình hạ tầng — không thể lấy nhãn từ DB vì chưa kết nối được DB.
  if (!supabaseConfigured) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-6 text-center">
        <div className="max-w-md rounded-card border border-rose/30 bg-card p-6">
          <div className="mb-2 font-heading text-lg font-bold text-rose">Chưa cấu hình Supabase</div>
          <p className="text-sm leading-relaxed text-muted">
            Thiếu biến môi trường VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY lúc build. Tạo file
            .env theo .env.example (hoặc khai báo trong Netlify env vars) rồi build lại.
          </p>
        </div>
      </div>
    )
  }

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
