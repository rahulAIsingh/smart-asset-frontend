import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useUserRole } from './hooks/useUserRole'
import { AppLayout } from './components/layout/AppLayout'
import { Toaster } from './components/ui/sonner'
import { Spinner } from './components/ui/spinner'

// Pages
import { Dashboard } from './pages/Dashboard'
import { Assets } from './pages/Assets'
import { Issuance } from './pages/Issuance'
import { StockHistory } from './pages/StockHistory'
import { Settings } from './pages/Settings'
import { DataManagement } from './pages/DataManagement'
import { MyAssets } from './pages/MyAssets'
import { Tickets } from './pages/Tickets'
import { Users } from './pages/Users'
import { Login } from './pages/Login' // Assuming Login is imported from somewhere
import { Finance } from './pages/Finance'
import { Approvals } from './pages/Approvals'

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function App() {
  const { user } = useAuth()
  const { role, loading: roleLoading, can } = useUserRole()
  const routerBasename = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

  const defaultLanding = () => {
    if (can('dashboard:view')) return <Dashboard />
    if (can('my_assets:view')) return <Navigate to="/my-assets" replace />
    if (can('approvals:view')) return <Navigate to="/approvals" replace />
    return <Navigate to="/login" replace />
  }

  return (
    <BrowserRouter basename={routerBasename === '' ? '/' : routerBasename}>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

        {/* Protected Routes */}
        <Route path="/*" element={
          <RequireAuth>
            <AppLayout>
              <Routes>
                <Route
                  path="/"
                  element={
                    roleLoading
                      ? <div className="flex h-screen items-center justify-center"><Spinner /></div>
                      : defaultLanding()
                  }
                />
                <Route path="/my-assets" element={can('my_assets:view') ? <MyAssets /> : <Navigate to="/" replace />} />
                <Route
                  path="/my-requests"
                  element={can('my_assets:view') && (role === 'user' || role === 'pm' || role === 'support')
                    ? <MyAssets initialTab="requests" requestOnly />
                    : <Navigate to="/" replace />}
                />
                <Route
                  path="/my-request-history"
                  element={can('my_assets:view') && (role === 'user' || role === 'pm' || role === 'support')
                    ? <MyAssets initialTab="requests" requestOnly historyOnly />
                    : <Navigate to="/" replace />}
                />
                <Route path="/assets" element={can('assets:view') ? <Assets /> : <Navigate to="/" replace />} />
                <Route path="/issuance" element={can('issuance:manage') ? <Issuance /> : <Navigate to="/" replace />} />
                <Route path="/stock" element={can('stock:manage') ? <StockHistory /> : <Navigate to="/" replace />} />
                <Route path="/finance" element={can('finance:view') ? <Finance /> : <Navigate to="/" replace />} />
                <Route path="/data-management" element={can('data:manage') ? <DataManagement /> : <Navigate to="/" replace />} />
                <Route path="/tickets" element={can('tickets:view') ? <Tickets /> : <Navigate to="/" replace />} />
                <Route path="/approvals" element={can('approvals:view') ? <Approvals /> : <Navigate to="/" replace />} />
                <Route path="/users" element={can('users:manage') ? <Users /> : <Navigate to="/" replace />} />
                <Route path="/settings" element={can('settings:view') ? <Settings /> : <Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </RequireAuth>
        } />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  )
}

export default App
