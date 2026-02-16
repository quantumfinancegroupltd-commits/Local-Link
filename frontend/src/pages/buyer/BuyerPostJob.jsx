import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { JOB_CATEGORIES_TIER1 } from '../../lib/jobCategories.js'
import { trackEvent } from '../../lib/useAnalytics.js'
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
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledEndAt, setScheduledEndAt] = useState('')
  const [recurringFrequency, setRecurringFrequency] = useState('')
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [accessInstructions, setAccessInstructions] = useState('')
  const [eventHeadCount, setEventHeadCount] = useState('')
  const [eventMenuNotes, setEventMenuNotes] = useState('')
  const [eventEquipment, setEventEquipment] = useState('')
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
      scheduledAt,
      scheduledEndAt,
      recurringFrequency,
      recurringEndDate,
      accessInstructions,
      eventHeadCount,
      eventMenuNotes,
      eventEquipment,
      saved_at: Date.now(),
    }),
    [title, description, category, location, locationLat, locationLng, locationPlaceId, budget, scheduledAt, scheduledEndAt, recurringFrequency, recurringEndDate, accessInstructions, eventHeadCount, eventMenuNotes, eventEquipment],
  )
  const draft = useDraftAutosave({ key: draftKey, data: draftData, enabled: true, debounceMs: 700 })

  // Restore draft on first load if form is empty (skip when rebooking from a job).
  useEffect(() => {
    const rebookId = params.get('rebook')
    if (rebookId) return // rebook effect will pre-fill
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
    setScheduledAt(String(d.scheduledAt ?? ''))
    setScheduledEndAt(String(d.scheduledEndAt ?? ''))
    setRecurringFrequency(String(d.recurringFrequency ?? ''))
    setRecurringEndDate(String(d.recurringEndDate ?? ''))
    setAccessInstructions(String(d.accessInstructions ?? ''))
    setEventHeadCount(String(d.eventHeadCount ?? ''))
    setEventMenuNotes(String(d.eventMenuNotes ?? ''))
    setEventEquipment(String(d.eventEquipment ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rebook this slot: pre-fill from a completed job (same cleaner/slot, next occurrence).
  useEffect(() => {
    const rebookId = params.get('rebook')
    if (!rebookId) return
    let cancelled = false
    async function loadJob() {
      try {
        const res = await http.get(`/jobs/${rebookId}`)
        const j = res.data?.job ?? res.data
        if (!j || cancelled) return
        setCategory(String(j.category ?? 'Domestic Services'))
        setTitle(String(j.title ?? ''))
        setDescription(String(j.description ?? ''))
        setLocation(String(j.location ?? ''))
        setLocationLat(j.location_lat != null ? Number(j.location_lat) : null)
        setLocationLng(j.location_lng != null ? Number(j.location_lng) : null)
        setLocationPlaceId(j.location_place_id ?? null)
        setBudget(j.budget != null ? String(j.budget) : '')
        setAccessInstructions(String(j.access_instructions ?? ''))
        setRecurringFrequency(String(j.recurring_frequency ?? ''))
        setRecurringEndDate(j.recurring_end_date ? String(j.recurring_end_date).slice(0, 10) : '')
        const freq = String(j.recurring_frequency ?? '')
        const prevAt = j.scheduled_at ? new Date(j.scheduled_at) : null
        if (prevAt && (freq === 'weekly' || freq === 'monthly')) {
          const next = new Date(prevAt)
          if (freq === 'weekly') next.setDate(next.getDate() + 7)
          else next.setMonth(next.getMonth() + 1)
          const y = next.getFullYear()
          const m = String(next.getMonth() + 1).padStart(2, '0')
          const d = String(next.getDate()).padStart(2, '0')
          const h = String(next.getHours()).padStart(2, '0')
          const min = String(next.getMinutes()).padStart(2, '0')
          setScheduledAt(`${y}-${m}-${d}T${h}:${min}`)
        }
      } catch {
        if (!cancelled) toast.warning('Could not load job', 'Rebook pre-fill skipped. You can still post a new job.')
      }
    }
    loadJob()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('rebook')])

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

  const titlePlaceholder = useMemo(() => {
    if (category === 'Events & Catering') return 'e.g. Wedding catering, chairs & tents, event staff'
    if (category === 'Domestic Services') return 'e.g. Weekly cleaning, laundry pickup, deep clean'
    return 'e.g. Fix leaking kitchen sink'
  }, [category])
  const descriptionPlaceholder = useMemo(() => {
    if (category === 'Events & Catering') return 'Event date, venue, head count, catering needs (meals/drinks), equipment (chairs, tents, tables), staff required. Escrow can hold deposit until completion.'
    if (category === 'Domestic Services') return 'Frequency (e.g. weekly), what to clean or launder, access instructions. Recurring bookings supported.'
    return 'What needs to be done? Include scope, timeline, and any special requirements.'
  }, [category])

  useEffect(() => {
    const fromQuery = params.get('category')
    if (fromQuery && !category) setCategory(fromQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Pre-fill from "Book" on artisan profile (service booking)
  useEffect(() => {
    const artisanId = params.get('artisan')
    const serviceTitle = params.get('title')
    const serviceDesc = params.get('description')
    const serviceBudget = params.get('budget')
    const serviceCategory = params.get('category')
    const serviceDate = params.get('date') // YYYY-MM-DD
    if (!artisanId || !serviceTitle) return
    setTitle(serviceTitle || '')
    if (serviceDesc) setDescription(decodeURIComponent(serviceDesc))
    if (serviceBudget) setBudget(serviceBudget || '')
    if (serviceCategory) setCategory(decodeURIComponent(serviceCategory))
    if (serviceDate) {
      setScheduledAt(`${serviceDate}T09:00`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('artisan'), params.get('title')])

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

      const artisanIdFromUrl = params.get('artisan')
      const payload = {
        title,
        description,
        category: category || null,
        location,
        budget: budget ? Number(budget) : null,
        scheduled_at: scheduledAt.trim() || null,
        scheduled_end_at: scheduledEndAt.trim() || null,
        recurring_frequency: recurringFrequency || null,
        recurring_end_date: recurringEndDate.trim() || null,
        access_instructions: accessInstructions.trim() || null,
        event_head_count: eventHeadCount.trim() ? Number(eventHeadCount) : null,
        event_menu_notes: eventMenuNotes.trim() || null,
        event_equipment: eventEquipment.trim() || null,
        image_url,
        media,
        location_place_id: locationPlaceId,
        location_lat: locationLat,
        location_lng: locationLng,
      }
      if (artisanIdFromUrl) payload.invited_artisan_user_id = artisanIdFromUrl

      const res = await http.post('/jobs', payload)
      const jobId = res.data?.id ?? res.data?.job?.id
      trackEvent('job_posted')
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
                setScheduledAt('')
                setScheduledEndAt('')
                setRecurringFrequency('')
                setRecurringEndDate('')
                setAccessInstructions('')
                setEventHeadCount('')
                setEventMenuNotes('')
                setEventEquipment('')
                setMediaFiles([])
              }}
            >
              Clear draft
            </Button>
          </div>
        </div>

        {params.get('rebook') ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <span className="font-semibold">Rebook this slot</span> — Form pre-filled from your previous booking. Confirm or edit the details, then post to book the next session.
          </div>
        ) : params.get('artisan') && params.get('title') ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <span className="font-semibold">Book this service</span> — Form pre-filled from the provider&apos;s profile. Add your location and any extra details, then post. They&apos;ll see your request first.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="job_title">Job title</Label>
            <Input
              id="job_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder={titlePlaceholder}
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
              placeholder={descriptionPlaceholder}
            />
            <div className="mt-2 text-xs text-slate-500">
              Be specific — scope, timeline, and requirements help providers quote accurately.
            </div>
          </div>

          {category === 'Events & Catering' ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="job_scheduled_at">Event date & time</Label>
                  <Input
                    id="job_scheduled_at"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={busy}
                  />
                  <div className="mt-2 text-xs text-slate-500">When the event or service is scheduled. Escrow secures the booking.</div>
                </div>
                <div>
                  <Label htmlFor="job_scheduled_end_at">End time (optional)</Label>
                  <Input
                    id="job_scheduled_end_at"
                    type="datetime-local"
                    value={scheduledEndAt}
                    onChange={(e) => setScheduledEndAt(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="job_event_head_count">Head count (optional)</Label>
                <Input
                  id="job_event_head_count"
                  type="number"
                  min="1"
                  max="100000"
                  value={eventHeadCount}
                  onChange={(e) => setEventHeadCount(e.target.value)}
                  placeholder="e.g. 50"
                  disabled={busy}
                />
                <div className="mt-2 text-xs text-slate-500">Expected number of guests — helps caterers quote accurately.</div>
              </div>
              <div>
                <Label htmlFor="job_event_menu_notes">Menu / catering notes (optional)</Label>
                <Textarea
                  id="job_event_menu_notes"
                  value={eventMenuNotes}
                  onChange={(e) => setEventMenuNotes(e.target.value)}
                  placeholder="e.g. 3-course sit-down, vegetarian options for 10, soft drinks + wine"
                  rows={3}
                  disabled={busy}
                />
                <div className="mt-2 text-xs text-slate-500">Meals, drinks, dietary requirements. Confirm with your caterer before the event.</div>
              </div>
              <div>
                <Label htmlFor="job_event_equipment">Equipment needed (optional)</Label>
                <Textarea
                  id="job_event_equipment"
                  value={eventEquipment}
                  onChange={(e) => setEventEquipment(e.target.value)}
                  placeholder="e.g. chairs, tables, tents, cutlery, glassware"
                  rows={2}
                  disabled={busy}
                />
                <div className="mt-2 text-xs text-slate-500">Chairs, tents, tables, etc. — or note if venue provides.</div>
              </div>
            </>
          ) : null}

          {category === 'Domestic Services' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="job_recurring">Recurring</Label>
                <Select
                  id="job_recurring"
                  value={recurringFrequency}
                  onChange={(e) => setRecurringFrequency(e.target.value)}
                  disabled={busy}
                >
                  <option value="">One-off</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
                <div className="mt-2 text-xs text-slate-500">Cleaners and laundry often repeat weekly or monthly.</div>
              </div>
              <div>
                <Label htmlFor="job_recurring_end">Repeat until (optional)</Label>
                <Input
                  id="job_recurring_end"
                  type="date"
                  value={recurringEndDate}
                  onChange={(e) => setRecurringEndDate(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="job_access_instructions">Access instructions (optional)</Label>
            <Textarea
              id="job_access_instructions"
              value={accessInstructions}
              onChange={(e) => setAccessInstructions(e.target.value)}
              placeholder="e.g. key code, gate code, door entry, where to collect keys"
              rows={2}
              disabled={busy}
            />
            <div className="mt-2 text-xs text-slate-500">
              {category === 'Domestic Services' ? 'Cleaners need this to get in — key code, gate, building access.' : 'Help providers access the site (codes, entry instructions).'}
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


