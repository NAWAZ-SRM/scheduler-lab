import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { SignupPage } from './pages/SignupPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { WorkbenchPage } from './pages/WorkbenchPage'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuthStore } from './stores/authStore'

// Placeholder pages - to be created
const SharedRunPage = () => <div className="min-h-screen flex items-center justify-center">Shared Run - Coming Soon</div>

const App: React.FC = () => {
  const loadFromToken = useAuthStore((state) => state.loadFromToken)

  useEffect(() => {
    loadFromToken()
  }, [loadFromToken])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/workbench" element={<ProtectedRoute><WorkbenchPage /></ProtectedRoute>} />
      <Route path="/workbench/:runId" element={<ProtectedRoute><WorkbenchPage /></ProtectedRoute>} />
      <Route path="/shared/:token" element={<SharedRunPage />} />
    </Routes>
  )
}

export default App