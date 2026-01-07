import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you’re looking for doesn’t exist.</p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Go home
        </Link>
      </div>
    </div>
  )
}


