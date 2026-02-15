import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'

export function AdminGate({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (user?.role === 'admin' && user?.must_change_password && location.pathname !== '/admin/set-password') {
    return <Navigate to="/admin/set-password" replace />
  }

  return children
}


