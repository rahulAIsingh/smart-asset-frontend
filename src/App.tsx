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
  const { role, loading: roleLoading } = useUserRole()

  return (
    <BrowserRouter>
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
                      : role === 'user'
                        ? <Navigate to="/my-assets" replace />
                        : (role === 'pm' || role === 'boss')
                          ? <Navigate to="/approvals" replace />
                          : <Dashboard />
                  }
                />
                <Route path="/my-assets" element={<MyAssets />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/issuance" element={<Issuance />} />
                <Route path="/stock" element={<StockHistory />} />
                <Route path="/finance" element={role === 'admin' ? <Finance /> : <Navigate to="/" replace />} />
                <Route path="/data-management" element={<DataManagement />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/approvals" element={<Approvals />} />
                {role === 'admin' && (
                  <Route path="/users" element={<Users />} />
                )}
                <Route path="/settings" element={<Settings />} />
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
