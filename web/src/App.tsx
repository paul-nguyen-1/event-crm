import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/components/protected-route'
import { AppShell } from '@/components/app-shell'
import { SignupPage } from '@/pages/signup-page'
import { LoginPage } from '@/pages/login-page'
import { GoogleCallbackPage } from '@/pages/google-callback-page'
import { ContactsListPage } from '@/pages/contacts-list-page'
import { ContactDetailPage } from '@/pages/contact-detail-page'

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/contacts' : '/login'} replace />}
      />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
