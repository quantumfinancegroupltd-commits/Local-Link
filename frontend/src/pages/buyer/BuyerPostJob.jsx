import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { JOB_CATEGORIES_TIER1 } from '../../lib/jobCategories.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { useDraftAutosave } from '../../lib/drafts.js'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function BuyerPostJob() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { online } = useOnlineStatus()
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [locationLat, setLocationLat] = useState(null)
  const [locationLng, setLocationLng] = useState(null)
  const [locationPlaceId, setLocationPlaceId] = useState(null)
  const [budget, setBudget] = useState('')
  const [mediaFiles, setMediaFiles] = useState([]) // File[]
  const [mediaError, setMediaError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const draftKey = 'draft:buyer:post_job'
  const draftData = useMemo(
    () => ({
      title,
      description,
      category,
      location,
      locationLat,
      locationLng,
      locationPlaceId,
      budget,
      saved_at: Date.now(),
    }),
    [title, description, category, location, locationLat, locationLng, locationPlaceId, budget],
  )
  const draft = useDraftAutosave({ key: draftKey, data: draftData, enabled: true, debounceMs: 700 })

  // Restore draft on first load if form is empty.
  useEffect(() => {
    const empty = !title && !description && !category && !location && !budget
    if (!empty) return
    const d = draft.load()
    if (!d) return
    setTitle(String(d.title ?? ''))
    setDescription(String(d.description ?? ''))
    setCategory(String(d.category ?? ''))
    setLocation(String(d.location ?? ''))
    setLocationLat(typeof d.locationLat === 'number' ? d.locationLat : null)
    setLocationLng(typeof d.locationLng === 'number' ? d.locationLng : null)
    setLocationPlaceId(d.locationPlaceId ?? null)
    setBudget(String(d.budget ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previews = useMemo(() => {
    return mediaFiles.map((f) => ({
      name: f.name,
      type: f.type,
      kind: f.type?.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(f),
    }))
  }, [mediaFiles])

  // Prevent object URL leaks
  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url)
    }
  }, [previews])

  const mapsQuery = useMemo(() => {
    if (locationLat != null && locationLng != null) return `${locationLat},${locationLng}`
    return location || ''
  }, [location, locationLat, locationLng])

  const googleMapsLink = useMemo(() => {
    if (!mapsQuery) return null
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
  }, [mapsQuery])

  const googleMapsEmbed = useMemo(() => {
    if (!mapsQuery) return null
    return `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`
  }, [mapsQuery])

  useEffect(() => {
    const fromQuery = params.get('category')
    if (fromQuery && !category) setCategory(fromQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMediaError(null)
    if (!online) {
      const msg = 'You are offline. Your draft is saved — reconnect to post.'
      setError(msg)
      toast.warning('Offline', msg)
      return
    }
    setBusy(true)
    try {
      let image_url = null
      let media = null

      if (mediaFiles.length) {
        const uploaded = await uploadMediaFiles(mediaFiles)
        if (!uploaded.length) {
          setMediaError('Upload failed. Please try again.')
          return
        }
        media = uploaded.map((x) => ({ url: x.url, kind: x.kind, mime: x.mime, size: x.size }))
        const firstImage = media.find((m) => m.kind === 'image' && m.url)
        image_url = firstImage?.url ?? null
      }

      const res = await http.post('/jobs', {
        title,
        description,
        category: category || null,
        location,
        budget: budget ? Number(budget) : null,
        image_url,
        media,
        location_place_id: locationPlaceId,
        location_lat: locationLat,
        location_lng: locationLng,
      })
      const jobId = res.data?.id ?? res.data?.job?.id
      draft.clear()
      navigate(jobId ? `/buyer/jobs/${jobId}` : '/buyer', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to post job')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <h1 className="text-xl font-bold">Post a job</h1>
        <p className="mt-1 text-sm text-slate-600">Describe what you need done and where. Include budget and location for faster, more accurate quotes.</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>Draft autosaves while you type (attachments are not saved).</div>
          <div className="flex items-center gap-2">
            {draft.savedAt ? <span className="text-emerald-700">Saved</span> : <span>Not saved yet</span>}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                draft.clear()
                setTitle('')
                setDescription('')
                setCategory('')
                setLocation('')
                setLocationLat(null)
                setLocationLng(null)
                setLocationPlaceId(null)
                setBudget('')
                setMediaFiles([])
              }}
            >
              Clear draft
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="job_title">Job title</Label>
            <Input
              id="job_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Fix leaking kitchen sink"
            />
          </div>
          <div>
            <Label htmlFor="job_category">Category (optional)</Label>
            <Select id="job_category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
              <option value="">Choose a category…</option>
              {JOB_CATEGORIES_TIER1.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <div className="mt-2 text-xs text-slate-500">Helps us match you faster (you can leave it blank).</div>
          </div>
          <div>
            <Label htmlFor="job_description">Description</Label>
            <Textarea
              id="job_description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              placeholder="What needs to be done? Include scope, timeline, and any special requirements."
            />
            <div className="mt-2 text-xs text-slate-500">
              Be specific — scope, timeline, and requirements help providers quote accurately.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="job_location">Location</Label>
              <div className="mb-2 text-xs text-slate-500">Location helps providers check travel and give accurate quotes.</div>
              <LocationInput
                id="job_location"
                value={location}
                onChange={(v) => {
                  setLocation(v)
                  // typing resets coords until a place is picked
                  setLocationLat(null)
                  setLocationLng(null)
                  setLocationPlaceId(null)
                }}
                onPick={({ lat, lng, placeId }) => {
                  setLocationLat(typeof lat === 'number' ? lat : null)
                  setLocationLng(typeof lng === 'number' ? lng : null)
                  setLocationPlaceId(placeId ?? null)
                }}
                disabled={busy}
              />
              {googleMapsLink ? (
                <div className="mt-2 text-xs text-slate-600">
                  <a className="underline" href={googleMapsLink} target="_blank" rel="noreferrer">
                    Open in Google Maps
                  </a>
                </div>
              ) : null}
            </div>
            <div>
              <Label htmlFor="job_budget">Budget (optional)</Label>
              <Input
                id="job_budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                type="number"
                min="0"
                placeholder="GHS"
              />
              <div className="mt-2 text-xs text-slate-500">A rough budget helps providers give realistic quotes.</div>
            </div>
          </div>

          {googleMapsEmbed ? (
            <div>
              <div className="text-xs font-medium text-slate-700">Map preview</div>
              <div className="mt-2 overflow-hidden rounded-2xl border">
                <iframe
                  title="Location preview"
                  src={googleMapsEmbed}
                  className="h-56 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="job_media">Upload media (optional)</Label>
            <Input
              id="job_media"
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
              disabled={busy}
            />
            <div className="mt-2 text-xs text-slate-500">
              You can upload multiple images/videos. Max 50MB per file.
            </div>
            {mediaError ? <div className="mt-2 text-sm text-red-700">{mediaError}</div> : null}
            {previews.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {previews.map((p) => (
                  <div key={`${p.name}-${p.url}`} className="overflow-hidden rounded-xl border bg-white">
                    {p.kind === 'video' ? (
                      <video src={p.url} controls className="h-48 w-full object-cover" />
                    ) : (
                      <img src={p.url} alt={p.name} className="h-48 w-full object-cover" loading="lazy" />
                    )}
                    <div className="px-3 py-2 text-xs text-slate-600">{p.name}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-semibold">Couldn’t post job</div>
              <div className="mt-1">{error}</div>
              <div className="mt-2 text-xs text-red-600">Check your title, description, and connection. Your draft is saved.</div>
            </div>
          )}

          <div className="flex gap-3">
            <Button disabled={busy || !online} title={!online ? 'Reconnect to post' : undefined}>
              {busy ? 'Posting…' : !online ? 'Offline' : 'Post job'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


