import { Component } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card } from './FormControls.jsx'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('UI crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const msg = this.state.error?.message ? String(this.state.error.message) : 'Something went wrong.'
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Card>
          <div className="text-sm font-semibold text-slate-900">Something went wrong</div>
          <div className="mt-2 text-sm text-slate-700">
            The app hit an unexpected error. Try reloading—if it keeps happening, open Support and we’ll help.
          </div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            {msg}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Link to="/support">
              <Button type="button" variant="secondary">
                Open Support
              </Button>
            </Link>
            <Link to="/">
              <Button type="button" variant="secondary">
                Go home
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }
}


