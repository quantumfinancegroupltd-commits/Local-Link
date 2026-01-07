import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export function RequireAuth({ roles, children }) {
  const { booted, isAuthed, user } = useAuth()
  const location = useLocation()

  if (!booted) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">
          Loading…
        </div>
      </div>
    )
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles?.length && !roles.includes(user?.role)) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border bg-white p-5">
          <h1 className="text-lg font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account role doesn’t have access to this page.
          </p>
        </div>
      </div>
    )
  }

  return children
}


