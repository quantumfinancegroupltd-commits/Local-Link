import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Select } from '../ui/FormControls.jsx'

const INTENTS = [
  { key: 'fix', label: 'Fix/Build' },
  { key: 'produce', label: 'Produce' },
  { key: 'project', label: 'Project' },
  { key: 'supply', label: 'Supply' },
]

export function HomeSearchBar() {
  const navigate = useNavigate()
  const [intent, setIntent] = useState('fix')
  const [location, setLocation] = useState('')
  const [query, setQuery] = useState('')

  const placeholder = useMemo(() => {
    if (intent === 'produce') return 'e.g. tomatoes, plantain, onions…'
    if (intent === 'project') return 'e.g. renovation, new build, store fit-out…'
    if (intent === 'supply') return 'e.g. weekly veg for restaurant…'
    return 'e.g. electrician, plumber, painter…'
  }, [intent])

  function submit(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    params.set('role', 'buyer')
    params.set('intent', intent)
    if (location.trim()) params.set('location', location.trim())
    if (query.trim()) params.set('q', query.trim())
    navigate(`/register?${params.toString()}`)
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-soft">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto px-1 pb-2">
        {INTENTS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setIntent(t.key)}
            className={[
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition',
              intent === t.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-2 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-slate-700">Location</div>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Accra, Kumasi, Tema…"
              className="border-0 px-0 py-1 focus:ring-0"
            />
          </div>
        </div>

        <div className="md:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <div className="text-[11px] font-semibold text-slate-700">What</div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="border-0 px-0 py-1 focus:ring-0"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <Button className="h-full w-full py-3">Search</Button>
        </div>
      </form>

      {/* Quick filters */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-1">
        {['Accra', 'Kumasi', 'Tema', 'Takoradi', 'Cape Coast'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setLocation(c)}
            className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {c}
          </button>
        ))}
        <div className="flex-1" />
        <Select
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="w-auto rounded-full border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {INTENTS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}


