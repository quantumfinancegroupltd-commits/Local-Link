import { Fragment, useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { Tabs } from '../../components/ui/Tabs.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { useToast } from '../../components/ui/Toast.jsx'

async function blobUrlForAuthedGet(url) {
  const res = await http.get(url, { responseType: 'blob' })
  const blob = res.data
  return URL.createObjectURL(blob)
}

function sumLastN(series, n) {
  const list = Array.isArray(series) ? series : []
  const take = list.slice(Math.max(0, list.length - n))
  return take.reduce((acc, x) => acc + (Number(x?.value) || 0), 0)
}

function MiniSparkline({ series, stroke = '#0f766e' }) {
  const values = (Array.isArray(series) ? series : []).map((p) => Number(p?.value ?? 0))
  const w = 260
  const h = 52
  const pad = 6
  const max = Math.max(1, ...values)
  const min = 0
  const dx = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const pts = values.map((v, i) => {
    const x = pad + i * dx
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2)
    return [x, Number.isFinite(y) ? y : h - pad]
  })
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="trend">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function formatChartDay(day) {
  if (!day) return ''
  const d = new Date(day)
  if (Number.isNaN(d.getTime())) return String(day)
  const m = d.getMonth() + 1
  const date = d.getDate()
  return `${m}/${date}`
}

function AnalyticsLineChart({ series, height = 220 }) {
  const rows = Array.isArray(series) ? series : []
  if (rows.length === 0) return null
  const values = rows.map((r) => Number(r?.views ?? 0))
  const max = Math.max(1, ...values)
  const w = 640
  const h = height
  const pad = { left: 44, right: 20, top: 16, bottom: 36 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const dx = rows.length > 1 ? chartW / (rows.length - 1) : 0
  const pts = values.map((v, i) => {
    const x = pad.left + i * dx
    const y = pad.top + chartH - (v / max) * chartH
    return [x, Number.isFinite(y) ? y : pad.top + chartH]
  })
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const areaD = lineD + ` L${pts[pts.length - 1]?.[0] ?? 0},${pad.top + chartH} L${pts[0]?.[0] ?? 0},${pad.top + chartH} Z`
  const gridLines = 4
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full overflow-visible" role="img" aria-label="Page views over time">
      {/* Grid */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = pad.top + (chartH * i) / gridLines
        return (
          <line key={i} x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 2" />
        )
      })}
      <line x1={pad.left} y1={pad.top + chartH} x2={pad.left + chartW} y2={pad.top + chartH} stroke="#cbd5e1" strokeWidth="1" />
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + chartH} stroke="#cbd5e1" strokeWidth="1" />
      {/* Area fill */}
      <path d={areaD} fill="rgba(15, 118, 110, 0.12)" />
      {/* Line */}
      <path d={lineD} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* X-axis labels */}
      {rows.map((r, i) => {
        const x = pad.left + i * dx
        const label = formatChartDay(r?.day)
        if (!label) return null
        return (
          <text key={i} x={x} y={pad.top + chartH + 20} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
            {label}
          </text>
        )
      })}
    </svg>
  )
}

function AnalyticsBarChart({ data, labelKey = 'label', valueKey = 'views', maxBars = 10, color = '#0f766e' }) {
  const rows = (Array.isArray(data) ? data : []).slice(0, maxBars)
  if (rows.length === 0) return null
  const max = Math.max(1, ...rows.map((r) => Number(r?.[valueKey] ?? 0)))
  const barH = 20
  const gap = 8
  const labelW = 140
  const barW = 200
  const h = Math.max(1, rows.length * (barH + gap) - gap)
  const w = labelW + barW + 48
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full" role="img" aria-label="Bar chart">
      {rows.map((r, i) => {
        const val = Number(r?.[valueKey] ?? 0)
        const pct = max > 0 ? val / max : 0
        const label = String(r?.[labelKey] ?? '').slice(0, 22)
        const y = i * (barH + gap)
        return (
          <g key={i}>
            <text x={0} y={y + barH - 6} className="fill-slate-700 text-xs" style={{ fontFamily: 'inherit' }}>
              {label || '—'}
            </text>
            <rect
              x={labelW}
              y={y}
              width={barW * pct}
              height={barH - 2}
              rx={4}
              fill={color}
              opacity={0.85}
            />
            <text x={labelW + barW + 8} y={y + barH - 6} className="fill-slate-600 text-xs font-medium">
              {val.toLocaleString()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function AdminDashboard() {
  const { user: authUser } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [q, setQ] = useState('')

  // Manual ops hooks (early-stage safety controls)
  const [opsJobId, setOpsJobId] = useState('')
  const [opsArtisanUserId, setOpsArtisanUserId] = useState('')
  const [opsAcceptedQuote, setOpsAcceptedQuote] = useState('')
  const [opsEscrowId, setOpsEscrowId] = useState('')
  const [opsUserId, setOpsUserId] = useState('')
  const [opsSuspendHours, setOpsSuspendHours] = useState('168') // 7 days
  const [opsSuspendReason, setOpsSuspendReason] = useState('Repeated no-shows / reliability issues')
  const [opsNoShowContextType, setOpsNoShowContextType] = useState('job')
  const [opsNoShowContextId, setOpsNoShowContextId] = useState('')
  const [opsActionBusy, setOpsActionBusy] = useState(false)
  const [opsActionMsg, setOpsActionMsg] = useState(null)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(true)
  const [disputesError, setDisputesError] = useState(null)
  const [disputesFilter, setDisputesFilter] = useState('')
  const [resolveBusyId, setResolveBusyId] = useState(null)
  const [resolveAction, setResolveAction] = useState('release')
  const [resolveSellerAmount, setResolveSellerAmount] = useState('')
  const [resolveBuyerAmount, setResolveBuyerAmount] = useState('')
  const [resolveNote, setResolveNote] = useState('')

  const [drivers, setDrivers] = useState([])
  const [driversLoading, setDriversLoading] = useState(true)
  const [deliveries, setDeliveries] = useState([])
  const [deliveriesLoading, setDeliveriesLoading] = useState(true)
  const [assignBusyId, setAssignBusyId] = useState(null)
  const [assignDriverIdByDelivery, setAssignDriverIdByDelivery] = useState({})

  const [verificationRequests, setVerificationRequests] = useState([])
  const [verificationLoading, setVerificationLoading] = useState(true)
  const [verificationBusyId, setVerificationBusyId] = useState(null)
  const [verificationApproveLevelById, setVerificationApproveLevelById] = useState({})
  const [verificationNoteById, setVerificationNoteById] = useState({})

  const [idvStatus, setIdvStatus] = useState('pending') // pending | needs_correction | rejected | approved
  const [idvRequests, setIdvRequests] = useState([])
  const [idvLoading, setIdvLoading] = useState(true)
  const [idvError, setIdvError] = useState(null)
  const [idvBusyId, setIdvBusyId] = useState(null)
  const [idvReasonById, setIdvReasonById] = useState({})
  const [idvSelectedId, setIdvSelectedId] = useState(null)
  const [idvSelected, setIdvSelected] = useState(null)
  const [idvPreviewByUrl, setIdvPreviewByUrl] = useState({}) // { [url]: objectUrl }

  const [featureFlags, setFeatureFlags] = useState([])
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(true)
  const [featureFlagsError, setFeatureFlagsError] = useState(null)
  const [featureBusyKey, setFeatureBusyKey] = useState(null)

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [metricsError, setMetricsError] = useState(null)

  const [ops, setOps] = useState(null)
  const [opsLoading, setOpsLoading] = useState(true)
  const [sys, setSys] = useState(null)
  const [sysLoading, setSysLoading] = useState(true)
  const [opsAlerts, setOpsAlerts] = useState([])
  const [opsAlertsLoading, setOpsAlertsLoading] = useState(true)
  const [opsAlertsError, setOpsAlertsError] = useState(null)
  const [opsAlertBusyId, setOpsAlertBusyId] = useState(null)

  const [ts, setTs] = useState(null) // { wer, disputes_opened, no_shows }
  const [tsLoading, setTsLoading] = useState(true)
  const [tsError, setTsError] = useState(null)

  const [payouts, setPayouts] = useState([])
  const [payoutsLoading, setPayoutsLoading] = useState(true)
  const [payoutsError, setPayoutsError] = useState(null)
  const [payoutBusyId, setPayoutBusyId] = useState(null)

  const [audit, setAudit] = useState([])
  const [auditLoading, setAuditLoading] = useState(true)

  const [geo, setGeo] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState(null)
  const [geoRange, setGeoRange] = useState('30d') // 7d | 30d
  const [geoBucket, setGeoBucket] = useState('0.05') // degrees
  const [geoMinCount, setGeoMinCount] = useState('3')

  const [supportTickets, setSupportTickets] = useState([])
  const [supportLoading, setSupportLoading] = useState(false)
  const [supportError, setSupportError] = useState(null)
  const [supportSelectedId, setSupportSelectedId] = useState(null)
  const [supportDetail, setSupportDetail] = useState(null) // {ticket, events}
  const [supportDetailLoading, setSupportDetailLoading] = useState(false)
  const [supportReplyBody, setSupportReplyBody] = useState('')
  const [supportReplyVisibility, setSupportReplyVisibility] = useState('customer') // customer | internal
  const [supportReplyBusy, setSupportReplyBusy] = useState(false)
  const [supportUpdateBusy, setSupportUpdateBusy] = useState(false)

  const [commentCtx, setCommentCtx] = useState(null) // admin view of a related post_comment
  const [commentCtxLoading, setCommentCtxLoading] = useState(false)
  const [commentModBusy, setCommentModBusy] = useState(false)

  // Moderation queue (reported/flagged comments) + keyword filters
  const [modStatus, setModStatus] = useState('visible') // visible | hidden | all
  const [modRange, setModRange] = useState('all') // all | 7d | 30d
  const [modQuery, setModQuery] = useState('')
  const [modItems, setModItems] = useState([])
  const [modLoading, setModLoading] = useState(false)
  const [modError, setModError] = useState(null)
  const [modSelectedId, setModSelectedId] = useState(null)
  const [modSelected, setModSelected] = useState(null)
  const [modSelectedLoading, setModSelectedLoading] = useState(false)
  const [modActionBusy, setModActionBusy] = useState(false)

  const [kwItems, setKwItems] = useState([])
  const [kwLoading, setKwLoading] = useState(false)
  const [kwError, setKwError] = useState(null)
  const [kwNew, setKwNew] = useState('')
  const [kwNewAction, setKwNewAction] = useState('block') // block | flag
  const [kwNewEnabled, setKwNewEnabled] = useState(true)
  const [kwBusyId, setKwBusyId] = useState(null)

  const [trustUserId, setTrustUserId] = useState(null)
  const [trustReport, setTrustReport] = useState(null)
  const [trustLoading, setTrustLoading] = useState(false)
  const [trustError, setTrustError] = useState(null)

  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null) // { user, profile, role_profile, counts }
  const [selectedUserLoading, setSelectedUserLoading] = useState(false)
  const [selectedUserError, setSelectedUserError] = useState(null)
  const [tempPassword, setTempPassword] = useState(null)

  // News publishing
  const [newsItems, setNewsItems] = useState([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState(null)
  const [newsSelectedId, setNewsSelectedId] = useState(null)
  const [newsSelected, setNewsSelected] = useState(null)
  const [newsEditTitle, setNewsEditTitle] = useState('')
  const [newsEditSlug, setNewsEditSlug] = useState('')
  const [newsEditBody, setNewsEditBody] = useState('')
  const [newsEditStatus, setNewsEditStatus] = useState('draft')
  const [newsEditCategory, setNewsEditCategory] = useState('')
  const [newsEditSummary, setNewsEditSummary] = useState('')
  const [newsEditHeroUrl, setNewsEditHeroUrl] = useState('')
  const [newsEditHeroAlt, setNewsEditHeroAlt] = useState('')
  const [newsEditHeroCredit, setNewsEditHeroCredit] = useState('')
  const [newsBusy, setNewsBusy] = useState(false)

  const [queues, setQueues] = useState(null)
  const [queuesLoading, setQueuesLoading] = useState(false)
  const [queuesError, setQueuesError] = useState(null)
  const [queueActionBusyId, setQueueActionBusyId] = useState(null)
  const [queueDetailId, setQueueDetailId] = useState(null)
  const [queueDetail, setQueueDetail] = useState(null)
  const [queueDetailLoading, setQueueDetailLoading] = useState(false)
  const [queueDetailError, setQueueDetailError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/admin/users')
        if (!cancelled) setUsers(Array.isArray(res.data) ? res.data : res.data?.users ?? [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load users')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredDisputes = useMemo(() => {
    const q = String(disputesFilter || '').trim().toLowerCase()
    const list = Array.isArray(disputes) ? disputes : []
    if (!q) return list
    return list.filter((d) => {
      const hay = [
        d?.id,
        d?.escrow_id,
        d?.job_id,
        d?.order_id,
        d?.buyer_id,
        d?.counterparty_user_id,
        d?.status,
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
        .join(' ')
      return hay.includes(q)
    })
  }, [disputes, disputesFilter])

  useEffect(() => {
    let cancelled = false
    async function loadMetrics() {
      setMetricsLoading(true)
      setMetricsError(null)
      try {
        const res = await http.get('/admin/metrics/overview')
        if (!cancelled) setMetrics(res.data)
      } catch (err) {
        if (!cancelled) setMetricsError(err?.response?.data?.message ?? err?.message ?? 'Failed to load metrics')
      } finally {
        if (!cancelled) setMetricsLoading(false)
      }
    }
    loadMetrics()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadTimeSeries() {
      setTsLoading(true)
      setTsError(null)
      try {
        const [wer, disputes, noShows] = await Promise.all([
          http.get('/admin/metrics/timeseries', { params: { metric: 'wer', bucket: 'day' } }),
          http.get('/admin/metrics/timeseries', { params: { metric: 'disputes_opened', bucket: 'day' } }),
          http.get('/admin/metrics/timeseries', { params: { metric: 'no_shows', bucket: 'day' } }),
        ])
        if (cancelled) return
        setTs({
          wer: Array.isArray(wer.data?.series) ? wer.data.series : [],
          disputes_opened: Array.isArray(disputes.data?.series) ? disputes.data.series : [],
          no_shows: Array.isArray(noShows.data?.series) ? noShows.data.series : [],
        })
      } catch (e) {
        if (!cancelled) setTsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load charts')
      } finally {
        if (!cancelled) setTsLoading(false)
      }
    }
    loadTimeSeries()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadOpsAndSystem() {
      setOpsLoading(true)
      setSysLoading(true)
      setOpsAlertsLoading(true)
      setOpsAlertsError(null)
      try {
        const [o, s, a] = await Promise.all([
          http.get('/admin/ops/overview'),
          http.get('/admin/system/status'),
          http.get('/admin/ops/alerts', { params: { status: 'open', limit: 50 } }),
        ])
        if (cancelled) return
        setOps(o.data ?? null)
        setSys(s.data ?? null)
        setOpsAlerts(Array.isArray(a.data?.items) ? a.data.items : [])
      } catch {
        // best-effort
      } finally {
        if (!cancelled) {
          setOpsLoading(false)
          setSysLoading(false)
          setOpsAlertsLoading(false)
        }
      }
    }
    loadOpsAndSystem()
    return () => {
      cancelled = true
    }
  }, [])

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)
  const [analyticsDays, setAnalyticsDays] = useState(30)
  const [analyticsPathPrefix, setAnalyticsPathPrefix] = useState('')
  const [errorsList, setErrorsList] = useState([])
  const [errorsLoading, setErrorsLoading] = useState(false)
  const [errorsError, setErrorsError] = useState(null)
  const [errorsExpandedId, setErrorsExpandedId] = useState(null)

  const tabs = useMemo(
    () => [
      { label: 'Overview', value: 'overview' },
      { label: 'Analytics', value: 'analytics' },
      { label: 'Errors', value: 'errors' },
      { label: 'Location', value: 'location' },
      { label: 'Support', value: 'support' },
      { label: 'Moderation', value: 'moderation' },
      { label: 'Reliability', value: 'reliability' },
      { label: 'Controls', value: 'controls' },
      { label: 'News', value: 'news' },
      { label: `Disputes${ops?.disputes_active ? ` (${ops.disputes_active})` : ''}`, value: 'disputes' },
      { label: `Verification${ops?.verification_requests_pending ? ` (${ops.verification_requests_pending})` : ''}`, value: 'verification' },
      { label: `Dispatch${ops?.deliveries_unassigned_paid ? ` (${ops.deliveries_unassigned_paid})` : ''}`, value: 'dispatch' },
      { label: `Payouts${ops?.payouts_pending ? ` (${ops.payouts_pending})` : ''}`, value: 'payouts' },
      { label: 'Users', value: 'users' },
      { label: 'Flags', value: 'flags' },
    ],
    [ops?.deliveries_unassigned_paid, ops?.disputes_active, ops?.verification_requests_pending, ops?.payouts_pending],
  )

  useEffect(() => {
    let cancelled = false
    async function loadAnalytics() {
      if (tab !== 'analytics') return
      setAnalyticsLoading(true)
      setAnalyticsError(null)
      try {
        const params = { days: analyticsDays }
        if (analyticsPathPrefix.trim()) params.path_prefix = analyticsPathPrefix.trim()
        const r = await http.get('/admin/analytics/traffic', { params })
        if (!cancelled) setAnalytics(r.data ?? null)
      } catch (e) {
        if (!cancelled) setAnalyticsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load analytics')
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }
    loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [tab, analyticsDays, analyticsPathPrefix])

  useEffect(() => {
    let cancelled = false
    async function loadErrors() {
      if (tab !== 'errors') return
      setErrorsLoading(true)
      setErrorsError(null)
      try {
        const r = await http.get('/admin/errors', { params: { limit: 100 } })
        if (!cancelled) setErrorsList(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        if (!cancelled) setErrorsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load errors')
      } finally {
        if (!cancelled) setErrorsLoading(false)
      }
    }
    loadErrors()
    return () => {
      cancelled = true
    }
  }, [tab])

  useEffect(() => {
    let cancelled = false
    async function loadNews() {
      if (tab !== 'news') return
      setNewsLoading(true)
      setNewsError(null)
      try {
        const r = await http.get('/admin/news')
        if (!cancelled) setNewsItems(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        if (!cancelled) setNewsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load news')
      } finally {
        if (!cancelled) setNewsLoading(false)
      }
    }
    loadNews()
    return () => {
      cancelled = true
    }
  }, [tab])

  // If a support ticket is about a post comment, fetch comment context for moderation actions.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (tab !== 'support') return
      const t = supportDetail?.ticket
      const rt = String(t?.related_type || '')
      const rid = t?.related_id ? String(t.related_id) : ''
      if (rt !== 'post_comment' || !rid) {
        setCommentCtx(null)
        setCommentCtxLoading(false)
        return
      }
      setCommentCtxLoading(true)
      try {
        const r = await http.get(`/admin/comments/${encodeURIComponent(rid)}`)
        if (!cancelled) setCommentCtx(r.data ?? null)
      } catch {
        if (!cancelled) setCommentCtx(null)
      } finally {
        if (!cancelled) setCommentCtxLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supportDetail?.ticket?.related_type, supportDetail?.ticket?.related_id, tab])

  useEffect(() => {
    let cancelled = false
    async function loadNewsDetail() {
      if (tab !== 'news') return
      if (!newsSelectedId) {
        setNewsSelected(null)
        return
      }
      setNewsBusy(true)
      try {
        const r = await http.get(`/admin/news/${encodeURIComponent(newsSelectedId)}`)
        if (cancelled) return
        const p = r.data
        setNewsSelected(p)
        setNewsEditTitle(p?.title ?? '')
        setNewsEditSlug(p?.slug ?? '')
        setNewsEditBody(p?.body ?? '')
        setNewsEditStatus(p?.status ?? 'draft')
        setNewsEditCategory(p?.category ?? '')
        setNewsEditSummary(p?.summary ?? '')
        setNewsEditHeroUrl(p?.hero_image_url ?? '')
        setNewsEditHeroAlt(p?.hero_image_alt ?? '')
        setNewsEditHeroCredit(p?.hero_image_credit ?? '')
      } catch (e) {
        if (!cancelled) toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to load post')
      } finally {
        if (!cancelled) setNewsBusy(false)
      }
    }
    loadNewsDetail()
    return () => {
      cancelled = true
    }
  }, [tab, newsSelectedId])

  async function refreshNewsList() {
    const r = await http.get('/admin/news')
    setNewsItems(Array.isArray(r.data) ? r.data : [])
  }

  async function createNews() {
    setNewsBusy(true)
    try {
      const r = await http.post('/admin/news', {
        title: 'New update',
        body: 'Write your announcement here…',
        status: 'draft',
        category: newsEditCategory || null,
        summary: newsEditSummary || null,
        hero_image_url: newsEditHeroUrl || null,
        hero_image_alt: newsEditHeroAlt || null,
        hero_image_credit: newsEditHeroCredit || null,
      })
      toast.success('Draft created.')
      setNewsSelectedId(r.data?.id ?? null)
      await refreshNewsList()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to create post')
    } finally {
      setNewsBusy(false)
    }
  }

  async function saveNews() {
    if (!newsSelectedId) return
    setNewsBusy(true)
    try {
      const r = await http.put(`/admin/news/${encodeURIComponent(newsSelectedId)}`, {
        title: newsEditTitle,
        slug: newsEditSlug || null,
        body: newsEditBody,
        status: newsEditStatus,
        category: newsEditCategory || null,
        summary: newsEditSummary || null,
        hero_image_url: newsEditHeroUrl || null,
        hero_image_alt: newsEditHeroAlt || null,
        hero_image_credit: newsEditHeroCredit || null,
      })
      setNewsSelected(r.data)
      toast.success('Saved.')
      await refreshNewsList()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save')
    } finally {
      setNewsBusy(false)
    }
  }

  async function deleteNews() {
    if (!newsSelectedId) return
    const ok = window.confirm('Delete this news post?')
    if (!ok) return
    setNewsBusy(true)
    try {
      await http.delete(`/admin/news/${encodeURIComponent(newsSelectedId)}`)
      toast.success('Deleted.')
      setNewsSelectedId(null)
      setNewsSelected(null)
      await refreshNewsList()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete')
    } finally {
      setNewsBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadGeo() {
      if (tab !== 'location') return
      setGeoLoading(true)
      setGeoError(null)
      try {
        const now = Date.now()
        const from = new Date(now - (geoRange === '7d' ? 7 : 30) * 24 * 3600 * 1000).toISOString()
        const to = new Date(now).toISOString()
        const res = await http.get('/admin/analytics/geo', {
          params: {
            from,
            to,
            bucket_deg: Number(geoBucket || 0.05),
            min_count: Number(geoMinCount || 3),
          },
        })
        if (!cancelled) setGeo(res.data ?? null)
      } catch (err) {
        if (!cancelled) setGeoError(err?.response?.data?.message ?? err?.message ?? 'Failed to load location analytics')
      } finally {
        if (!cancelled) setGeoLoading(false)
      }
    }
    loadGeo()
    return () => {
      cancelled = true
    }
  }, [tab, geoRange, geoBucket, geoMinCount])

  useEffect(() => {
    let cancelled = false
    async function refreshQueues() {
      if (tab !== 'reliability') return
      setQueuesLoading(true)
      setQueuesError(null)
      try {
        const r = await http.get('/admin/queues/overview')
        if (!cancelled) setQueues(r.data ?? null)
      } catch (e) {
        if (!cancelled) setQueuesError(e?.response?.data?.message ?? e?.message ?? 'Failed to load queues overview')
      } finally {
        if (!cancelled) setQueuesLoading(false)
      }
    }
    refreshQueues()
    return () => {
      cancelled = true
    }
  }, [tab])

  async function refreshQueuesNow() {
    setQueuesLoading(true)
    setQueuesError(null)
    try {
      const r = await http.get('/admin/queues/overview')
      setQueues(r.data ?? null)
    } catch (e) {
      setQueuesError(e?.response?.data?.message ?? e?.message ?? 'Failed to load queues overview')
    } finally {
      setQueuesLoading(false)
    }
  }

  async function openQueueDetail(id) {
    setQueueDetailId(id)
    setQueueDetail(null)
    setQueueDetailError(null)
    setQueueDetailLoading(true)
    try {
      const r = await http.get(`/admin/queues/webhooks/${id}`)
      setQueueDetail(r.data ?? null)
    } catch (e) {
      setQueueDetailError(e?.response?.data?.message ?? e?.message ?? 'Failed to load queue item')
    } finally {
      setQueueDetailLoading(false)
    }
  }

  function closeQueueDetail() {
    setQueueDetailId(null)
    setQueueDetail(null)
    setQueueDetailError(null)
    setQueueDetailLoading(false)
  }

  async function exportQueueFailures() {
    const r = await http.get('/admin/queues/webhooks/export/failures', { params: { limit: 50 } })
    const payload = r.data ?? {}
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = `locallink-webhook-failures-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2500)
  }

  async function copyText(label, text) {
    const s = String(text ?? '')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(s)
      } else {
        const ta = document.createElement('textarea')
        ta.value = s
        ta.setAttribute('readonly', 'true')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      }
      toast.push({ title: `${label} copied`, variant: 'success' })
    } catch {
      toast.push({ title: 'Could not copy', variant: 'error' })
    }
  }

  async function retryQueueItem(id) {
    setQueueActionBusyId(id)
    try {
      await http.post(`/admin/queues/webhooks/${id}/retry`, { note: 'Manual retry from Admin' })
      await refreshQueuesNow()
    } finally {
      setQueueActionBusyId(null)
    }
  }

  async function ignoreQueueItem(id) {
    setQueueActionBusyId(id)
    try {
      await http.post(`/admin/queues/webhooks/${id}/ignore`, { note: 'Marked ignored from Admin' })
      await refreshQueuesNow()
    } finally {
      setQueueActionBusyId(null)
    }
  }

  async function loadTrust(userId) {
    setTrustUserId(userId)
    setTrustReport(null)
    setTrustError(null)
    setTrustLoading(true)
    try {
      const r = await http.get(`/trust/admin/users/${userId}`)
      setTrustReport(r.data ?? null)
    } catch (e) {
      setTrustError(e?.response?.data?.message ?? e?.message ?? 'Failed to load trust report')
    } finally {
      setTrustLoading(false)
    }
  }

  async function loadUserDetail(userId) {
    setSelectedUserId(userId)
    setSelectedUser(null)
    setSelectedUserError(null)
    setTempPassword(null)
    setSelectedUserLoading(true)
    try {
      const r = await http.get(`/admin/users/${userId}`)
      setSelectedUser(r.data ?? null)
    } catch (e) {
      setSelectedUserError(e?.response?.data?.message ?? e?.message ?? 'Failed to load user')
    } finally {
      setSelectedUserLoading(false)
    }
  }

  async function resetUserPassword(userId) {
    setTempPassword(null)
    try {
      const r = await http.post(`/admin/users/${userId}/reset-password`, {})
      const pw = r.data?.temp_password
      if (pw) {
        setTempPassword(String(pw))
        toast.push({ title: 'Temporary password generated', variant: 'success' })
      } else {
        toast.push({ title: 'Password reset', variant: 'success' })
      }
    } catch (e) {
      toast.push({ title: e?.response?.data?.message ?? e?.message ?? 'Failed to reset password', variant: 'error' })
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadSupport() {
      if (tab !== 'support') return
      setSupportLoading(true)
      setSupportError(null)
      try {
        const res = await http.get('/admin/support/tickets', { params: { q: q || undefined } })
        if (!cancelled) setSupportTickets(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (!cancelled) setSupportError(err?.response?.data?.message ?? err?.message ?? 'Failed to load support tickets')
      } finally {
        if (!cancelled) setSupportLoading(false)
      }
    }
    loadSupport()
    return () => {
      cancelled = true
    }
  }, [tab, q])

  useEffect(() => {
    let cancelled = false
    async function loadModeration() {
      if (tab !== 'moderation') return
      setModLoading(true)
      setModError(null)
      try {
        const res = await http.get('/admin/moderation/comments', {
          params: {
            status: modStatus,
            range: modRange,
            q: modQuery || undefined,
            limit: 120,
            offset: 0,
          },
        })
        const items = Array.isArray(res.data?.items) ? res.data.items : []
        if (!cancelled) setModItems(items)
      } catch (e) {
        if (!cancelled) setModError(e?.response?.data?.message ?? e?.message ?? 'Failed to load moderation queue')
      } finally {
        if (!cancelled) setModLoading(false)
      }
    }
    loadModeration()
    return () => {
      cancelled = true
    }
  }, [tab, modQuery, modRange, modStatus])

  useEffect(() => {
    let cancelled = false
    async function loadKeywords() {
      if (tab !== 'moderation') return
      setKwLoading(true)
      setKwError(null)
      try {
        const res = await http.get('/admin/moderation/keywords')
        if (!cancelled) setKwItems(Array.isArray(res.data) ? res.data : [])
      } catch (e) {
        if (!cancelled) setKwError(e?.response?.data?.message ?? e?.message ?? 'Failed to load keyword filters')
      } finally {
        if (!cancelled) setKwLoading(false)
      }
    }
    loadKeywords()
    return () => {
      cancelled = true
    }
  }, [tab])

  useEffect(() => {
    let cancelled = false
    async function loadSelected() {
      if (tab !== 'moderation') return
      if (!modSelectedId) {
        setModSelected(null)
        setModSelectedLoading(false)
        return
      }
      setModSelectedLoading(true)
      try {
        const r = await http.get(`/admin/comments/${encodeURIComponent(modSelectedId)}`)
        if (!cancelled) setModSelected(r.data ?? null)
      } catch {
        if (!cancelled) setModSelected(null)
      } finally {
        if (!cancelled) setModSelectedLoading(false)
      }
    }
    loadSelected()
    return () => {
      cancelled = true
    }
  }, [tab, modSelectedId])

  async function openSupportTicket(id) {
    setSupportSelectedId(id)
    setSupportDetail(null)
    setSupportDetailLoading(true)
    try {
      const r = await http.get(`/admin/support/tickets/${id}`)
      setSupportDetail(r.data ?? null)
    } finally {
      setSupportDetailLoading(false)
    }
  }

  async function updateSupportTicket(id, patch) {
    setSupportUpdateBusy(true)
    try {
      const r = await http.put(`/admin/support/tickets/${id}`, patch)
      // refresh list + detail best-effort
      await http
        .get('/admin/support/tickets', { params: { q: q || undefined } })
        .then((res) => setSupportTickets(Array.isArray(res.data) ? res.data : []))
        .catch(() => {})
      await http
        .get(`/admin/support/tickets/${id}`)
        .then((res) => setSupportDetail(res.data ?? null))
        .catch(() => {})
      return r.data
    } finally {
      setSupportUpdateBusy(false)
    }
  }

  async function addSupportEvent(id) {
    const body = String(supportReplyBody || '').trim()
    if (!body) return
    setSupportReplyBusy(true)
    try {
      await http.post(`/admin/support/tickets/${id}/events`, { visibility: supportReplyVisibility, body })
      setSupportReplyBody('')
      await http.get(`/admin/support/tickets/${id}`).then((res) => setSupportDetail(res.data ?? null))
      await http
        .get('/admin/support/tickets', { params: { q: q || undefined } })
        .then((res) => setSupportTickets(Array.isArray(res.data) ? res.data : []))
        .catch(() => {})
    } finally {
      setSupportReplyBusy(false)
    }
  }

  const qLower = String(q || '').trim().toLowerCase()
  const filteredUsers = useMemo(() => {
    if (!qLower) return users
    return (users || []).filter((u) => String(u.name || '').toLowerCase().includes(qLower) || String(u.email || '').toLowerCase().includes(qLower))
  }, [users, qLower])
  const filteredDrivers = useMemo(() => {
    if (!qLower) return drivers
    return (drivers || []).filter((d) => String(d.name || '').toLowerCase().includes(qLower) || String(d.email || '').toLowerCase().includes(qLower))
  }, [drivers, qLower])

  useEffect(() => {
    let cancelled = false
    async function loadFeatures() {
      setFeatureFlagsLoading(true)
      setFeatureFlagsError(null)
      try {
        const res = await http.get('/admin/features')
        if (!cancelled) setFeatureFlags(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (!cancelled) setFeatureFlagsError(err?.response?.data?.message ?? err?.message ?? 'Failed to load feature flags')
      } finally {
        if (!cancelled) setFeatureFlagsLoading(false)
      }
    }
    loadFeatures()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadVerificationRequests() {
      setVerificationLoading(true)
      try {
        const res = await http.get('/verification/admin/requests')
        if (!cancelled) setVerificationRequests(Array.isArray(res.data) ? res.data : [])
      } finally {
        if (!cancelled) setVerificationLoading(false)
      }
    }
    loadVerificationRequests()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadIdVerifications() {
      setIdvLoading(true)
      setIdvError(null)
      try {
        const res = await http.get('/id-verification/admin/queue', { params: { status: idvStatus, limit: 100 } })
        if (!cancelled) setIdvRequests(Array.isArray(res.data) ? res.data : [])
      } catch (e) {
        if (!cancelled) setIdvError(e?.response?.data?.message ?? e?.message ?? 'Failed to load ID verification queue')
      } finally {
        if (!cancelled) setIdvLoading(false)
      }
    }
    loadIdVerifications()
    return () => {
      cancelled = true
    }
  }, [idvStatus])

  useEffect(() => {
    let cancelled = false
    async function loadIdvSelected() {
      if (!idvSelectedId) {
        setIdvSelected(null)
        return
      }
      try {
        const res = await http.get(`/id-verification/admin/requests/${encodeURIComponent(idvSelectedId)}`)
        if (cancelled) return
        setIdvSelected(res.data ?? null)
      } catch {
        if (!cancelled) setIdvSelected(null)
      }
    }
    loadIdvSelected()
    return () => {
      cancelled = true
    }
  }, [idvSelectedId])

  useEffect(() => {
    return () => {
      // Revoke object URLs on unmount.
      try {
        Object.values(idvPreviewByUrl || {}).forEach((u) => {
          if (u) URL.revokeObjectURL(u)
        })
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadDriversAndDeliveries() {
      setDriversLoading(true)
      setDeliveriesLoading(true)
      try {
        const [drv, del] = await Promise.all([http.get('/drivers').catch(() => ({ data: [] })), http.get('/admin/deliveries')])
        if (cancelled) return
        setDrivers(Array.isArray(drv.data) ? drv.data : [])
        setDeliveries(Array.isArray(del.data) ? del.data : [])
      } finally {
        if (!cancelled) {
          setDriversLoading(false)
          setDeliveriesLoading(false)
        }
      }
    }
    loadDriversAndDeliveries()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadPayouts() {
      setPayoutsLoading(true)
      setPayoutsError(null)
      try {
        const res = await http.get('/admin/payouts')
        if (!cancelled) setPayouts(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (!cancelled) setPayoutsError(err?.response?.data?.message ?? err?.message ?? 'Failed to load payouts')
      } finally {
        if (!cancelled) setPayoutsLoading(false)
      }
    }
    loadPayouts()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadAudit() {
      setAuditLoading(true)
      try {
        const res = await http.get('/admin/audit')
        if (!cancelled) setAudit(Array.isArray(res.data) ? res.data : [])
      } finally {
        if (!cancelled) setAuditLoading(false)
      }
    }
    loadAudit()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshOps() {
    const o = await http.get('/admin/ops/overview')
    setOps(o.data ?? null)
  }

  async function refreshOpsAlerts() {
    setOpsAlertsLoading(true)
    setOpsAlertsError(null)
    try {
      const r = await http.get('/admin/ops/alerts', { params: { status: 'open', limit: 50 } })
      setOpsAlerts(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setOpsAlertsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load ops alerts')
    } finally {
      setOpsAlertsLoading(false)
    }
  }

  async function resolveAlert(alertId) {
    const id = String(alertId || '').trim()
    if (!id) return
    setOpsAlertBusyId(id)
    try {
      await http.post(`/admin/ops/alerts/${encodeURIComponent(id)}/resolve`)
      setOpsAlerts((prev) => (Array.isArray(prev) ? prev.filter((a) => a.id !== id) : []))
      refreshOps().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to resolve alert')
    } finally {
      setOpsAlertBusyId(null)
    }
  }

  async function markPayoutPaid(payoutId) {
    setPayoutBusyId(payoutId)
    try {
      await http.post(`/admin/payouts/${payoutId}/mark-paid`)
      const res = await http.get('/admin/payouts')
      setPayouts(Array.isArray(res.data) ? res.data : [])
      await refreshOps().catch(() => {})
      await http.get('/admin/audit').then((r) => setAudit(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    } finally {
      setPayoutBusyId(null)
    }
  }

  async function cancelPayout(payoutId) {
    const ok = window.confirm('Cancel this payout and refund it back to the user wallet?')
    if (!ok) return
    setPayoutBusyId(payoutId)
    try {
      await http.post(`/admin/payouts/${payoutId}/cancel`)
      const res = await http.get('/admin/payouts')
      setPayouts(Array.isArray(res.data) ? res.data : [])
      await refreshOps().catch(() => {})
      await http.get('/admin/audit').then((r) => setAudit(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    } finally {
      setPayoutBusyId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadDisputes() {
      setDisputesLoading(true)
      setDisputesError(null)
      try {
        const res = await http.get('/admin/disputes')
        if (!cancelled) setDisputes(Array.isArray(res.data) ? res.data : res.data?.disputes ?? [])
      } catch (err) {
        if (!cancelled) setDisputesError(err?.response?.data?.message ?? err?.message ?? 'Failed to load disputes')
      } finally {
        if (!cancelled) setDisputesLoading(false)
      }
    }
    loadDisputes()
    return () => {
      cancelled = true
    }
  }, [])

  async function verifyUser(id) {
    setBusyId(id)
    try {
      await http.put(`/admin/users/${id}/verify`)
      const res = await http.get('/admin/users')
      setUsers(Array.isArray(res.data) ? res.data : res.data?.users ?? [])
    } finally {
      setBusyId(null)
    }
  }

  async function resolveDispute(id, escrowAmount) {
    setResolveBusyId(id)
    try {
      const body =
        resolveAction === 'split'
          ? {
              action: 'split',
              seller_amount: Number(resolveSellerAmount || 0),
              buyer_amount: Number(resolveBuyerAmount || 0),
              note: resolveNote || undefined,
            }
          : { action: resolveAction, note: resolveNote || undefined }

      // Simple guard for split to avoid obvious mistakes
      if (resolveAction === 'split') {
        const sum = Number(resolveSellerAmount || 0) + Number(resolveBuyerAmount || 0)
        if (Math.abs(sum - Number(escrowAmount || 0)) > 0.0001) {
          throw new Error('Split amounts must sum to escrow amount')
        }
      }

      await http.post(`/admin/disputes/${id}/resolve`, body)
      const res = await http.get('/admin/disputes')
      setDisputes(Array.isArray(res.data) ? res.data : res.data?.disputes ?? [])
    } finally {
      setResolveBusyId(null)
    }
  }

  async function approveDriver(userId) {
    await http.put(`/drivers/${userId}/status`, { status: 'approved' })
    const drv = await http.get('/drivers')
    setDrivers(Array.isArray(drv.data) ? drv.data : [])
  }

  async function assignDriver(deliveryId) {
    const driver_user_id = assignDriverIdByDelivery[deliveryId]
    if (!driver_user_id) return
    setAssignBusyId(deliveryId)
    try {
      await http.post(`/admin/deliveries/${deliveryId}/assign`, { driver_user_id })
      const del = await http.get('/admin/deliveries')
      setDeliveries(Array.isArray(del.data) ? del.data : [])
    } finally {
      setAssignBusyId(null)
    }
  }

  async function approveVerification(id) {
    const level = verificationApproveLevelById[id] ?? 'bronze'
    const note = verificationNoteById[id] ?? ''
    setVerificationBusyId(id)
    try {
      await http.post(`/verification/admin/requests/${id}/approve`, { level, note: note || undefined })
      const res = await http.get('/verification/admin/requests')
      setVerificationRequests(Array.isArray(res.data) ? res.data : [])
    } finally {
      setVerificationBusyId(null)
    }
  }

  async function rejectVerification(id) {
    const note = verificationNoteById[id] ?? ''
    setVerificationBusyId(id)
    try {
      await http.post(`/verification/admin/requests/${id}/reject`, { note: note || undefined })
      const res = await http.get('/verification/admin/requests')
      setVerificationRequests(Array.isArray(res.data) ? res.data : [])
    } finally {
      setVerificationBusyId(null)
    }
  }

  async function approveIdv(id) {
    setIdvBusyId(id)
    setIdvError(null)
    try {
      await http.post(`/id-verification/admin/requests/${encodeURIComponent(id)}/approve`, {})
      toast.success('ID verification approved')
      const res = await http.get('/id-verification/admin/queue', { params: { status: idvStatus, limit: 100 } })
      setIdvRequests(Array.isArray(res.data) ? res.data : [])
      await refreshOps().catch(() => {})
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to approve'
      setIdvError(msg)
      toast.error(msg)
    } finally {
      setIdvBusyId(null)
    }
  }

  async function rejectIdv(id, status) {
    const reason = String(idvReasonById[id] ?? '').trim()
    if (!reason || reason.length < 10) {
      const msg = 'Please enter a rejection/correction reason (min 10 chars).'
      setIdvError(msg)
      toast.error(msg)
      return
    }
    setIdvBusyId(id)
    setIdvError(null)
    try {
      await http.post(`/id-verification/admin/requests/${encodeURIComponent(id)}/reject`, {
        status,
        rejection_reason: reason,
      })
      toast.success(status === 'needs_correction' ? 'Marked as needs correction' : 'Rejected')
      const res = await http.get('/id-verification/admin/queue', { params: { status: idvStatus, limit: 100 } })
      setIdvRequests(Array.isArray(res.data) ? res.data : [])
      await refreshOps().catch(() => {})
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to update request'
      setIdvError(msg)
      toast.error(msg)
    } finally {
      setIdvBusyId(null)
    }
  }

  async function previewIdvImages(row) {
    const urls = [row?.id_front_url, row?.id_back_url, row?.selfie_url].filter(Boolean)
    for (const u of urls) {
      if (idvPreviewByUrl[u]) continue
      try {
        const objUrl = await blobUrlForAuthedGet(u)
        setIdvPreviewByUrl((m) => ({ ...m, [u]: objUrl }))
      } catch {
        // best-effort
      }
    }
  }

  async function toggleFeature(key, enabled) {
    setFeatureBusyKey(key)
    setFeatureFlagsError(null)
    try {
      const res = await http.put(`/admin/features/${encodeURIComponent(key)}`, { enabled })
      setFeatureFlags((prev) => prev.map((f) => (f.key === key ? res.data : f)))
    } catch (err) {
      setFeatureFlagsError(err?.response?.data?.message ?? err?.message ?? 'Failed to update feature flag')
    } finally {
      setFeatureBusyKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Admin"
        title="Dashboard"
        subtitle="Verify users, resolve disputes, and control risk."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name/email…" />
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
      </div>

      {tab === 'overview' ? (
        <Card>
          <div className="text-sm font-semibold">System & payments status</div>
          {sysLoading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : !sys ? (
            <div className="mt-3 text-sm text-slate-600">No status.</div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Paystack</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {sys?.payments?.paystack_configured ? 'Configured' : 'Not configured'}
                </div>
                <div className="mt-2 text-xs text-slate-600">Webhook URL</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg border bg-white px-2 py-1 text-xs">{sys?.payments?.paystack_webhook_url ?? '—'}</code>
                  {sys?.payments?.paystack_webhook_url ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigator.clipboard?.writeText(sys.payments.paystack_webhook_url).catch(() => {})}
                    >
                      Copy
                    </Button>
                  ) : null}
                </div>
                {!sys?.payments?.paystack_configured ? (
                  <div className="mt-2 text-xs text-amber-700">
                    Set <span className="font-semibold">PAYSTACK_SECRET_KEY</span> on the server before taking real payments.
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">System</div>
                <div className="mt-2 grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">DB</span>
                    <span className={sys?.db?.ok ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                      {sys?.db?.ok ? 'OK' : 'DOWN'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Uptime</span>
                    <span className="font-semibold text-slate-900">{sys?.uptime_sec != null ? `${Math.floor(sys.uptime_sec / 60)}m` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Schedulers</span>
                    <span className="font-semibold text-slate-900">{sys?.workers?.schedulers_enabled ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Webhook queue</span>
                    <span className="font-semibold text-slate-900">{sys?.workers?.webhook_queue_enabled ? 'ON' : 'OFF'}</span>
                  </div>
                  {sys?.webhook_queue?.counts ? (
                    <div className="mt-2 rounded-xl border bg-white p-3 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900">Webhook queue counts</div>
                      <div className="mt-2 grid gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Pending</span>
                          <span className="font-semibold">{sys.webhook_queue.counts.pending ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Retry</span>
                          <span className="font-semibold">{sys.webhook_queue.counts.retry ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Dead</span>
                          <span className="font-semibold">{sys.webhook_queue.counts.dead ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-600">Queue counts unavailable.</div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Ops queue</div>
                {opsLoading ? (
                  <div className="mt-2 text-sm text-slate-600">Loading…</div>
                ) : !ops ? (
                  <div className="mt-2 text-sm text-slate-600">No data.</div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Active disputes</span>
                      <span className="font-semibold text-slate-900">{ops.disputes_active}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Verification requests</span>
                      <span className="font-semibold text-slate-900">{ops.verification_requests_pending}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Unpaid orders</span>
                      <span className="font-semibold text-slate-900">{ops.orders_unpaid}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Paid deliveries (unassigned)</span>
                      <span className="font-semibold text-slate-900">{ops.deliveries_unassigned_paid}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Job escrows pending payment</span>
                      <span className="font-semibold text-slate-900">{ops.job_escrows_pending_payment}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Pending payouts</span>
                      <span className="font-semibold text-slate-900">{ops.payouts_pending ?? 0}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-600">Mission control (live)</div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      refreshOps().catch(() => {})
                      refreshOpsAlerts().catch(() => {})
                    }}
                  >
                    Refresh
                  </Button>
                </div>

                {ops ? (
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Escrow pending &gt; 12h</span>
                      <span className={ops.escrows_pending_payment_stuck_12h ? 'font-semibold text-red-700' : 'font-semibold text-slate-900'}>
                        {ops.escrows_pending_payment_stuck_12h ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Awaiting buyer confirm &gt; 12h</span>
                      <span className={ops.escrows_completed_pending_stuck_12h ? 'font-semibold text-amber-700' : 'font-semibold text-slate-900'}>
                        {ops.escrows_completed_pending_stuck_12h ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Payouts stuck &gt; 6h</span>
                      <span className={ops.payouts_stuck_6h ? 'font-semibold text-amber-700' : 'font-semibold text-slate-900'}>
                        {ops.payouts_stuck_6h ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Scheduler tasks failing</span>
                      <span className={ops.scheduler_tasks_failing ? 'font-semibold text-amber-700' : 'font-semibold text-slate-900'}>
                        {ops.scheduler_tasks_failing ?? 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-slate-600">No ops metrics.</div>
                )}

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">Active alerts</div>
                    <div className="text-xs text-slate-500">{Array.isArray(opsAlerts) ? opsAlerts.length : 0}</div>
                  </div>
                  {opsAlertsLoading ? (
                    <div className="mt-2 text-sm text-slate-600">Loading…</div>
                  ) : opsAlertsError ? (
                    <div className="mt-2 text-sm text-red-700">{opsAlertsError}</div>
                  ) : !opsAlerts?.length ? (
                    <div className="mt-2 text-sm text-emerald-700">No active alerts.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {opsAlerts.slice(0, 6).map((a) => {
                        const sev = String(a?.severity ?? 'warning')
                        const sevClass =
                          sev === 'critical'
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : sev === 'info'
                              ? 'bg-slate-100 text-slate-800 border-slate-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                        let last = '—'
                        try {
                          last = a?.last_seen_at ? new Date(a.last_seen_at).toLocaleString() : '—'
                        } catch {
                          last = '—'
                        }
                        return (
                          <div key={a.id} className="rounded-xl border bg-white p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${sevClass}`}>
                                    {sev.toUpperCase()}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-900">{a.type}</span>
                                </div>
                                <div className="mt-1 text-sm text-slate-700">{a.message ?? '—'}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  last seen: {last} • count: {a.count ?? 1}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={opsAlertBusyId === a.id}
                                onClick={() => resolveAlert(a.id)}
                              >
                                {opsAlertBusyId === a.id ? 'Resolving…' : 'Resolve'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                      {opsAlerts.length > 6 ? <div className="text-xs text-slate-500">Showing 6 of {opsAlerts.length}.</div> : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'overview' ? (
        <Card>
        <div className="text-sm font-semibold">North Star & risk (last 30 days)</div>
        {metricsLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : metricsError ? (
          <div className="mt-3 text-sm text-red-700">{metricsError}</div>
        ) : !metrics ? (
          <div className="mt-3 text-sm text-slate-600">No data.</div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Weekly Escrow Releases (WER)</div>
              <div className="mt-1 text-2xl font-bold">{metrics?.north_star?.weekly_escrow_releases ?? '—'}</div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Dispute rate / escrow</div>
              <div className="mt-1 text-2xl font-bold">
                {Math.round(Number(metrics?.rates?.dispute_rate_per_escrow ?? 0) * 1000) / 10}%
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Cancel rate / tx</div>
              <div className="mt-1 text-2xl font-bold">
                {Math.round(Number(metrics?.rates?.cancel_rate_per_transaction ?? 0) * 1000) / 10}%
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs text-slate-600">Phone leaks</div>
              <div className="mt-1 text-2xl font-bold">{metrics?.kpis?.phone_leaks ?? 0}</div>
            </div>
          </div>
        )}
        </Card>
      ) : null}

      {tab === 'overview' ? (
        <Card>
          <div className="text-sm font-semibold">Mission control charts (last 30 days)</div>
          <div className="mt-2 text-sm text-slate-600">Live trends help you catch reliability and money-pipeline issues early.</div>

          {tsLoading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : tsError ? (
            <div className="mt-3 text-sm text-red-700">{tsError}</div>
          ) : !ts ? (
            <div className="mt-3 text-sm text-slate-600">No data.</div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Escrow releases</div>
                <div className="mt-1 text-2xl font-bold">{sumLastN(ts.wer, 7)}</div>
                <div className="text-xs text-slate-500">last 7 days</div>
                <div className="mt-2">
                  <MiniSparkline series={ts.wer} stroke="#0f766e" />
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Disputes opened</div>
                <div className="mt-1 text-2xl font-bold">{sumLastN(ts.disputes_opened, 7)}</div>
                <div className="text-xs text-slate-500">last 7 days</div>
                <div className="mt-2">
                  <MiniSparkline series={ts.disputes_opened} stroke="#b45309" />
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">No-shows (confirmed)</div>
                <div className="mt-1 text-2xl font-bold">{sumLastN(ts.no_shows, 7)}</div>
                <div className="text-xs text-slate-500">last 7 days</div>
                <div className="mt-2">
                  <MiniSparkline series={ts.no_shows} stroke="#991b1b" />
                </div>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'analytics' ? (
        <div className="space-y-4">
          <Card>
            <div className="text-sm font-semibold">Web traffic analytics</div>
            <div className="mt-1 text-xs text-slate-600">
              Page views, unique sessions, top pages, and referrers. Data is collected when users browse the site.
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Time range</Label>
                <Select value={String(analyticsDays)} onChange={(e) => setAnalyticsDays(Number(e.target.value) || 30)}>
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Path filter</Label>
                <Input
                  placeholder="/jobs or /c/..."
                  value={analyticsPathPrefix}
                  onChange={(e) => setAnalyticsPathPrefix(e.target.value)}
                  className="max-w-[180px]"
                />
              </div>
            </div>
          </Card>

          {analyticsLoading ? (
            <Card>Loading…</Card>
          ) : analyticsError ? (
            <Card>
              <div className="text-sm text-red-700">{analyticsError}</div>
            </Card>
          ) : !analytics ? (
            <Card>
              <div className="text-sm text-slate-600">No data yet.</div>
            </Card>
          ) : (
            <>
              {analytics?.message ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {analytics.message}
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <div className="text-xs text-slate-600">Today</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(analytics?.today_views ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">page views</div>
                </Card>
                <Card>
                  <div className="text-xs text-slate-600">Page views</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(analytics?.totals?.total_page_views ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">last {analytics?.days ?? 30} days</div>
                  {Array.isArray(analytics?.page_views_over_time) && analytics.page_views_over_time.length > 0 ? (
                    <div className="mt-2">
                      <MiniSparkline
                        series={analytics.page_views_over_time.map((d) => ({ value: d.views }))}
                        stroke="#0f766e"
                      />
                    </div>
                  ) : null}
                </Card>
                <Card>
                  <div className="text-xs text-slate-600">Unique sessions</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(analytics?.totals?.unique_sessions ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">by session</div>
                </Card>
                <Card>
                  <div className="text-xs text-slate-600">Bounce rate</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(analytics?.bounce_rate_pct ?? 0)}%
                  </div>
                  <div className="text-xs text-slate-500">1-page sessions</div>
                </Card>
                <Card>
                  <div className="text-xs text-slate-600">Logged-in visitors</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {Number(analytics?.totals?.logged_in_visitors ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-500">with account</div>
                </Card>
              </div>

              {Array.isArray(analytics?.page_views_over_time) && analytics.page_views_over_time.length > 0 ? (
                <Card>
                  <div className="text-sm font-semibold">Page views over time</div>
                  <p className="mt-1 text-xs text-slate-500">Daily trend with grid and date labels</p>
                  <div className="mt-3 min-h-[220px]">
                    <AnalyticsLineChart series={analytics.page_views_over_time} />
                  </div>
                </Card>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <div className="text-sm font-semibold">Top pages</div>
                  {Array.isArray(analytics?.top_pages) && analytics.top_pages.length > 0 ? (
                    <>
                      <div className="mt-3 min-h-[200px]">
                        <AnalyticsBarChart
                          data={analytics.top_pages.map((r) => ({ label: r.path || '/', views: r.views ?? 0 }))}
                          labelKey="label"
                          valueKey="views"
                          maxBars={10}
                          color="#0f766e"
                        />
                      </div>
                      <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3">
                        <table className="w-full text-sm">
                        <thead className="text-left text-xs text-slate-500">
                          <tr>
                            <th className="py-2 pr-3">Path</th>
                            <th className="py-2 pr-3 text-right">Views</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analytics.top_pages.slice(0, 15).map((r) => (
                            <tr key={r.path}>
                              <td className="py-2 pr-3 font-medium text-slate-900 truncate max-w-[200px]" title={r.path}>
                                {r.path || '/'}
                              </td>
                              <td className="py-2 pr-3 text-right font-semibold text-slate-900">{Number(r.views ?? 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">No page views yet.</div>
                  )}
                </Card>
                <Card>
                  <div className="text-sm font-semibold">Traffic sources</div>
                  {Array.isArray(analytics?.referrers) && analytics.referrers.length > 0 ? (
                    <>
                      <div className="mt-3 min-h-[180px]">
                        <AnalyticsBarChart
                          data={analytics.referrers.map((r) => ({ label: r.source ?? 'Unknown', views: r.views ?? 0 }))}
                          labelKey="label"
                          valueKey="views"
                          maxBars={8}
                          color="#0369a1"
                        />
                      </div>
                      <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-3">
                        <table className="w-full text-sm">
                        <thead className="text-left text-xs text-slate-500">
                          <tr>
                            <th className="py-2 pr-3">Source</th>
                            <th className="py-2 pr-3 text-right">Views</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analytics.referrers.map((r) => (
                            <tr key={r.source}>
                              <td className="py-2 pr-3 font-medium text-slate-900">{r.source ?? 'Unknown'}</td>
                              <td className="py-2 pr-3 text-right font-semibold text-slate-900">{Number(r.views ?? 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">No referrer data yet.</div>
                  )}
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <div className="text-sm font-semibold">UTM sources</div>
                  <div className="mt-3 overflow-x-auto">
                    {Array.isArray(analytics?.utm) && analytics.utm.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-slate-500">
                          <tr>
                            <th className="py-2 pr-3">Source</th>
                            <th className="py-2 pr-3 text-right">Views</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {analytics.utm.map((r) => (
                            <tr key={r.source}>
                              <td className="py-2 pr-3 font-medium text-slate-900">{r.source ?? '—'}</td>
                              <td className="py-2 pr-3 text-right font-semibold text-slate-900">{Number(r.views ?? 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-sm text-slate-600">No UTM data yet.</div>
                    )}
                  </div>
                </Card>
                <Card>
                  <div className="text-sm font-semibold">Devices</div>
                  {Array.isArray(analytics?.devices) && analytics.devices.length > 0 ? (
                    <>
                      <div className="mt-3 min-h-[120px]">
                        <AnalyticsBarChart
                          data={analytics.devices.map((r) => ({ label: (r.device ?? '—').toLowerCase(), views: r.views ?? 0 }))}
                          labelKey="label"
                          valueKey="views"
                          maxBars={5}
                          color="#059669"
                        />
                      </div>
                      <div className="mt-3 overflow-x-auto border-t border-slate-100 pt-3">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-slate-500">
                            <tr>
                              <th className="py-2 pr-3">Device</th>
                              <th className="py-2 pr-3 text-right">Views</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {analytics.devices.map((r) => (
                              <tr key={r.device}>
                                <td className="py-2 pr-3 font-medium text-slate-900 capitalize">{r.device ?? '—'}</td>
                                <td className="py-2 pr-3 text-right font-semibold text-slate-900">{Number(r.views ?? 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">No device data yet.</div>
                  )}
                </Card>
                <Card>
                  <div className="text-sm font-semibold">Funnel</div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Page views</span>
                      <span className="font-semibold text-slate-900">{Number(analytics?.funnel?.page_views ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Signups</span>
                      <span className="font-semibold text-slate-900">{Number(analytics?.funnel?.signup ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Logins</span>
                      <span className="font-semibold text-slate-900">{Number(analytics?.funnel?.login ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Jobs posted</span>
                      <span className="font-semibold text-slate-900">{Number(analytics?.funnel?.job_posted ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Orders placed</span>
                      <span className="font-semibold text-slate-900">{Number(analytics?.funnel?.order_placed ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'errors' ? (
        <div className="space-y-4">
          <Card>
            <div className="text-sm font-semibold">Server error log</div>
            <div className="mt-1 text-xs text-slate-600">
              Unhandled API errors are logged here. Run migrations so the <code className="rounded bg-slate-100 px-1">error_logs</code> table exists.
            </div>
          </Card>
          {errorsLoading ? (
            <Card>Loading…</Card>
          ) : errorsError ? (
            <Card>
              <div className="text-sm text-red-700">{errorsError}</div>
            </Card>
          ) : errorsList.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-600">No errors logged yet.</div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Message</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Path</th>
                      <th className="py-2 pr-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {errorsList.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="text-slate-700">
                          <td className="py-2 pr-3 whitespace-nowrap text-slate-600">
                            {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 pr-3 max-w-[280px] truncate" title={row.message}>
                            {row.message || '—'}
                          </td>
                          <td className="py-2 pr-3">{row.method || '—'}</td>
                          <td className="py-2 pr-3 max-w-[160px] truncate" title={row.path}>{row.path || '—'}</td>
                          <td className="py-2 pr-3">
                            {(row.stack || row.req_id) ? (
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-900"
                                onClick={() => setErrorsExpandedId(errorsExpandedId === row.id ? null : row.id)}
                              >
                                {errorsExpandedId === row.id ? '▼' : '▶'}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {errorsExpandedId === row.id ? (
                          <tr key={`${row.id}-detail`}>
                            <td colSpan={5} className="py-2 pr-3">
                              <div className="rounded-lg border bg-slate-50 p-3 font-mono text-xs text-slate-700 whitespace-pre-wrap break-all">
                                {row.req_id ? <div className="mb-2"><span className="text-slate-500">Req ID:</span> {row.req_id}</div> : null}
                                {row.stack ? <div><span className="text-slate-500">Stack:</span><br />{row.stack}</div> : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : null}

      {tab === 'errors' ? (
        <div className="space-y-4">
          <Card>
            <div className="text-sm font-semibold">Server error log</div>
            <div className="mt-1 text-xs text-slate-600">
              Unhandled API errors are logged here. No external service required. Run migrations to create the table.
            </div>
          </Card>
          {errorsLoading ? (
            <Card>Loading…</Card>
          ) : errorsError ? (
            <Card>
              <div className="text-sm text-red-700">{errorsError}</div>
            </Card>
          ) : errorsList.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-600">No errors logged yet.</div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Message</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Path</th>
                      <th className="py-2 pr-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {errorsList.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="text-slate-700">
                          <td className="py-2 pr-3 whitespace-nowrap text-xs">
                            {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-2 pr-3 max-w-[280px] truncate font-medium" title={row.message}>
                            {row.message ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-xs">{row.method ?? '—'}</td>
                          <td className="py-2 pr-3 max-w-[160px] truncate text-xs" title={row.path}>
                            {row.path ?? '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {row.stack ? (
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-900"
                                onClick={() => setErrorsExpandedId(errorsExpandedId === row.id ? null : row.id)}
                              >
                                {errorsExpandedId === row.id ? 'Hide' : 'Stack'}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {errorsExpandedId === row.id && row.stack ? (
                          <tr>
                            <td colSpan={5} className="bg-slate-50 py-2 pr-3">
                              <pre className="whitespace-pre-wrap break-all text-xs text-slate-700 font-mono max-h-48 overflow-auto">
                                {row.stack}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : null}

      {tab === 'location' ? (
        <div className="space-y-4">
          <Card>
            <div className="text-sm font-semibold">Location intelligence (aggregated)</div>
            <div className="mt-2 text-sm text-slate-600">
              Demand vs supply density, dispute hotspots, and driver presence. Privacy guardrails hide low-count cells.
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
      <div>
                <Label>Range</Label>
                <Select value={geoRange} onChange={(e) => setGeoRange(e.target.value)}>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </Select>
      </div>
              <div>
                <Label>Grid bucket (deg)</Label>
                <Input value={geoBucket} onChange={(e) => setGeoBucket(e.target.value)} placeholder="0.05" />
                <div className="mt-1 text-xs text-slate-500">0.05 ≈ 5km. Smaller = more detail.</div>
              </div>
              <div>
                <Label>Minimum count</Label>
                <Input value={geoMinCount} onChange={(e) => setGeoMinCount(e.target.value)} placeholder="3" />
                <div className="mt-1 text-xs text-slate-500">Privacy guardrail (keep ≥ 3).</div>
              </div>
            </div>
          </Card>

          {geoLoading ? (
            <Card>Loading…</Card>
          ) : geoError ? (
            <Card>
              <div className="text-sm text-red-700">{geoError}</div>
            </Card>
          ) : !geo ? (
            <Card>
              <div className="text-sm text-slate-600">No data.</div>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                ['Demand: jobs posted', geo.layers?.demand_jobs],
                ['Demand: orders placed', geo.layers?.demand_orders],
                ['Supply: artisans', geo.layers?.supply_artisans],
                ['Supply: farmers', geo.layers?.supply_farmers],
                ['Ops: disputes hotspots', geo.layers?.ops_disputes],
                ['Ops: drivers online (fresh)', geo.layers?.ops_drivers_online_fresh],
              ].map(([title, rows]) => {
                const list = Array.isArray(rows) ? rows : []
                return (
                  <Card key={title}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{title}</div>
                      <div className="text-xs text-slate-500">{list.length} cells</div>
                    </div>
                    {list.length === 0 ? (
                      <div className="mt-3 text-sm text-slate-600">No cells yet for this layer.</div>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-slate-500">
                            <tr>
                              <th className="py-2 pr-3">Lat</th>
                              <th className="py-2 pr-3">Lng</th>
                              <th className="py-2 pr-3">Count</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {list.slice(0, 15).map((r) => (
                              <tr key={`${r.lat},${r.lng}`}>
                                <td className="py-2 pr-3 text-slate-700">{Number(r.lat).toFixed(4)}</td>
                                <td className="py-2 pr-3 text-slate-700">{Number(r.lng).toFixed(4)}</td>
                                <td className="py-2 pr-3 font-semibold text-slate-900">{Number(r.n ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'moderation' ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Moderation queue</div>
                <div className="mt-1 text-xs text-slate-600">Reported/flagged comments ranked by signal count.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setModRange('7d')}
                  disabled={modLoading}
                  className={modRange === '7d' ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100' : ''}
                >
                  Top reported (7d)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setModRange('all')}
                  disabled={modLoading}
                  className={modRange === 'all' ? 'bg-slate-100' : ''}
                >
                  All time
                </Button>
                <Button variant="secondary" onClick={() => setModQuery('')} disabled={modLoading}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label>Search</Label>
                <Input value={modQuery} onChange={(e) => setModQuery(e.target.value)} placeholder="comment id, author name, text…" />
              </div>
              <div>
                <Label>Range</Label>
                <Select value={modRange} onChange={(e) => setModRange(e.target.value)} disabled={modLoading}>
                  <option value="all">all time</option>
                  <option value="7d">last 7 days</option>
                  <option value="30d">last 30 days</option>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={modStatus} onChange={(e) => setModStatus(e.target.value)} disabled={modLoading}>
                  <option value="visible">visible</option>
                  <option value="hidden">hidden</option>
                  <option value="all">all</option>
                </Select>
              </div>
            </div>
            {modError ? <div className="mt-3 text-sm text-red-700">{modError}</div> : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Items</div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={modLoading}
                  onClick={async () => {
                    try {
                      setModLoading(true)
                      const res = await http.get('/admin/moderation/comments', {
                        params: { status: modStatus, range: modRange, q: modQuery || undefined, limit: 120, offset: 0 },
                      })
                      setModItems(Array.isArray(res.data?.items) ? res.data.items : [])
                    } catch (e) {
                      setModError(e?.response?.data?.message ?? e?.message ?? 'Failed to load moderation queue')
                    } finally {
                      setModLoading(false)
                    }
                  }}
                >
                  Refresh
                </Button>
              </div>
              {modLoading ? (
                <div className="mt-3 text-sm text-slate-600">Loading…</div>
              ) : modItems.length === 0 ? (
                <div className="mt-3 text-sm text-slate-600">No flagged/reported comments.</div>
              ) : (
                <div className="mt-3 divide-y">
                  {modItems.slice(0, 120).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setModSelectedId(it.id)}
                      className={[
                        'w-full px-1 py-3 text-left hover:bg-slate-50',
                        modSelectedId === it.id ? 'bg-slate-50' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{it.author_name || 'User'}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-600">{it.body_preview || '—'}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{it.deleted_at ? 'hidden' : 'visible'} • {String(it.id).slice(0, 8)}</div>
                        </div>
                        <div className="text-right">
                          <div className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                            {Number(it.signal_count ?? 0)}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            R {Number(it.report_count ?? 0)} • F {Number(it.flag_count ?? 0)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <div className="space-y-4 lg:col-span-2">
              <Card>
                <div className="text-sm font-semibold">Keyword filters</div>
                <div className="mt-1 text-xs text-slate-600">Block or flag comments that contain a keyword (case-insensitive).</div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Label>Keyword</Label>
                    <Input value={kwNew} onChange={(e) => setKwNew(e.target.value)} placeholder="e.g. whatsapp number, scam, porn…" />
                  </div>
                  <div>
                    <Label>Action</Label>
                    <Select value={kwNewAction} onChange={(e) => setKwNewAction(e.target.value)} disabled={kwLoading}>
                      <option value="block">block</option>
                      <option value="flag">flag</option>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={kwNewEnabled} onChange={(e) => setKwNewEnabled(e.target.checked)} />
                      enabled
                    </label>
                    <Button
                      disabled={kwLoading || !String(kwNew || '').trim()}
                      onClick={async () => {
                        const keyword = String(kwNew || '').trim()
                        if (!keyword) return
                        setKwLoading(true)
                        setKwError(null)
                        try {
                          await http.post('/admin/moderation/keywords', { keyword, action: kwNewAction, enabled: kwNewEnabled })
                          setKwNew('')
                          const res = await http.get('/admin/moderation/keywords')
                          setKwItems(Array.isArray(res.data) ? res.data : [])
                        } catch (e) {
                          setKwError(e?.response?.data?.message ?? e?.message ?? 'Failed to add keyword')
                        } finally {
                          setKwLoading(false)
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {kwError ? <div className="mt-3 text-sm text-red-700">{kwError}</div> : null}

                {kwLoading ? (
                  <div className="mt-3 text-sm text-slate-600">Loading…</div>
                ) : kwItems.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">No keyword filters yet.</div>
                ) : (
                  <div className="mt-4 divide-y rounded-2xl border bg-white">
                    {kwItems.slice(0, 200).map((k) => (
                      <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{k.keyword}</div>
                          <div className="mt-0.5 text-xs text-slate-600">{k.enabled ? 'enabled' : 'disabled'} • {k.action}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={k.action}
                            disabled={kwBusyId === k.id}
                            onChange={async (e) => {
                              setKwBusyId(k.id)
                              try {
                                const r = await http.put(`/admin/moderation/keywords/${k.id}`, { action: e.target.value })
                                setKwItems((prev) => (Array.isArray(prev) ? prev.map((x) => (x.id === k.id ? r.data : x)) : prev))
                              } finally {
                                setKwBusyId(null)
                              }
                            }}
                          >
                            <option value="block">block</option>
                            <option value="flag">flag</option>
                          </Select>
                          <button
                            type="button"
                            disabled={kwBusyId === k.id}
                            onClick={async () => {
                              setKwBusyId(k.id)
                              try {
                                const r = await http.put(`/admin/moderation/keywords/${k.id}`, { enabled: !k.enabled })
                                setKwItems((prev) => (Array.isArray(prev) ? prev.map((x) => (x.id === k.id ? r.data : x)) : prev))
                              } finally {
                                setKwBusyId(null)
                              }
                            }}
                            className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-60"
                          >
                            {k.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            disabled={kwBusyId === k.id}
                            onClick={async () => {
                              const ok = window.confirm(`Delete keyword “${k.keyword}”?`)
                              if (!ok) return
                              setKwBusyId(k.id)
                              try {
                                await http.delete(`/admin/moderation/keywords/${k.id}`)
                                setKwItems((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== k.id) : prev))
                              } finally {
                                setKwBusyId(null)
                              }
                            }}
                            className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Selected comment</div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!modSelectedId || modSelectedLoading}
                    onClick={() => setModSelectedId((x) => x)}
                  >
                    Refresh
                  </Button>
                </div>
                {!modSelectedId ? (
                  <div className="mt-3 text-sm text-slate-600">Select an item from the queue.</div>
                ) : modSelectedLoading ? (
                  <div className="mt-3 text-sm text-slate-600">Loading…</div>
                ) : !modSelected ? (
                  <div className="mt-3 text-sm text-slate-600">Comment not found.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="text-xs text-slate-600">
                      Author: <span className="font-semibold">{modSelected.author_name || '—'}</span> • {String(modSelected.id).slice(0, 8)} •{' '}
                      {modSelected.deleted_at ? <span className="font-semibold text-red-700">hidden</span> : <span className="font-semibold text-emerald-700">visible</span>}
                    </div>
                    <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-800 whitespace-pre-wrap">
                      {modSelected.deleted_at ? '[hidden]' : modSelected.body || '—'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={modActionBusy}
                        className={modSelected.deleted_at ? '' : 'border-red-200 text-red-800 hover:bg-red-50'}
                        onClick={async () => {
                          const id = String(modSelected.id || '')
                          if (!id) return
                          const wantHide = !modSelected.deleted_at
                          const ok = window.confirm(wantHide ? 'Hide this comment?' : 'Restore this comment?')
                          if (!ok) return
                          const note = window.prompt('Admin note (optional)') || ''
                          setModActionBusy(true)
                          try {
                            await http.post(`/admin/comments/${encodeURIComponent(id)}/${wantHide ? 'hide' : 'restore'}`, { note: note.trim() || null })
                            const [qRes, dRes] = await Promise.all([
                            http
                              .get('/admin/moderation/comments', { params: { status: modStatus, range: modRange, q: modQuery || undefined, limit: 120, offset: 0 } })
                              .catch(() => ({ data: null })),
                              http.get(`/admin/comments/${encodeURIComponent(id)}`).catch(() => ({ data: null })),
                            ])
                            setModItems(Array.isArray(qRes.data?.items) ? qRes.data.items : modItems)
                            setModSelected(dRes.data ?? modSelected)
                            toast.push({ title: wantHide ? 'Comment hidden' : 'Comment restored', variant: 'success' })
                          } catch (e) {
                            toast.push({ title: e?.response?.data?.message ?? e?.message ?? 'Failed', variant: 'error' })
                          } finally {
                            setModActionBusy(false)
                          }
                        }}
                      >
                        {modSelected.deleted_at ? 'Restore' : 'Hide'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!modSelected?.post_id}
                        onClick={() => copyText('Post ID', modSelected.post_id)}
                      >
                        Copy post id
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'support' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Support inbox</div>
              <Button variant="secondary" onClick={() => openSupportTicket(supportSelectedId)} disabled={!supportSelectedId || supportDetailLoading}>
                Refresh
              </Button>
            </div>
            {supportLoading ? (
              <div className="mt-3 text-sm text-slate-600">Loading…</div>
            ) : supportError ? (
              <div className="mt-3 text-sm text-red-700">{supportError}</div>
            ) : supportTickets.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No tickets.</div>
            ) : (
              <div className="mt-3 divide-y">
                {supportTickets.slice(0, 100).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={[
                      'w-full px-1 py-3 text-left hover:bg-slate-50',
                      supportSelectedId === t.id ? 'bg-slate-50' : '',
                    ].join(' ')}
                    onClick={() => openSupportTicket(t.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{t.subject}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-600">
                          {t.category} • {t.requester_name || '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{t.status}</div>
                        <div className="mt-1 text-[11px] text-slate-500">{t.priority}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {!supportSelectedId ? (
              <Card>
                <div className="text-sm text-slate-600">Select a ticket to review and reply.</div>
              </Card>
            ) : supportDetailLoading ? (
              <Card>Loading…</Card>
            ) : !supportDetail?.ticket ? (
              <Card>
                <div className="text-sm text-slate-600">Ticket not found.</div>
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{supportDetail.ticket.subject}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        From: <span className="font-semibold">{supportDetail.ticket.requester_name || '—'}</span>{' '}
                        <span className="text-slate-400">•</span> {supportDetail.ticket.requester_email || ''}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Status: <span className="font-semibold">{supportDetail.ticket.status}</span>{' '}
                        <span className="text-slate-400">•</span> Priority:{' '}
                        <span className="font-semibold">{supportDetail.ticket.priority}</span>
                      </div>
                      {supportDetail.ticket.related_type || supportDetail.ticket.related_id ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                          <div className="font-semibold text-slate-900">Context</div>
                          <div className="mt-1">
                            {supportDetail.ticket.related_type ? <span className="mr-2">Type: {supportDetail.ticket.related_type}</span> : null}
                            {supportDetail.ticket.related_id ? <span>ID: {supportDetail.ticket.related_id}</span> : null}
                          </div>
                          {(() => {
                            const t = String(supportDetail.ticket.related_type || '')
                            const rid = String(supportDetail.ticket.related_id || '')
                            if (!rid) return null
                            if (t !== 'job' && t !== 'order') return null
                            const match = (Array.isArray(disputes) ? disputes : []).find((d) => (t === 'job' ? d?.job_id === rid : d?.order_id === rid))
                            if (!match) {
                              return <div className="mt-2 text-xs text-slate-600">Dispute: none yet</div>
                            }
                            return (
                              <div className="mt-2 text-xs text-slate-700">
                                Dispute:{' '}
                                <span className={match.status === 'resolved' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-800'}>
                                  {match.status}
                                </span>{' '}
                                <span className="text-slate-500">•</span> {String(match.id).slice(0, 8)}
                              </div>
                            )
                          })()}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const t = String(supportDetail.ticket.related_type || '')
                                const id = String(supportDetail.ticket.related_id || '')
                                if (!id) return
                                if (t === 'job') setOpsJobId(id)
                                if (t === 'escrow') setOpsEscrowId(id)
                                if (t === 'user') setOpsUserId(id)
                                setTab('controls')
                              }}
                            >
                              Open in Controls
                            </Button>
                            {String(supportDetail.ticket.related_type || '') === 'post_comment' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="border-red-200 text-red-800 hover:bg-red-50"
                                disabled={commentModBusy || commentCtxLoading || !supportDetail.ticket.related_id}
                                onClick={async () => {
                                  const id = String(supportDetail.ticket.related_id || '')
                                  if (!id) return
                                  const wantHide = !(commentCtx?.deleted_at)
                                  const action = wantHide ? 'hide' : 'restore'
                                  const label = wantHide ? 'Hide' : 'Restore'
                                  const ok = window.confirm(`${label} this comment?`)
                                  if (!ok) return
                                  const note = window.prompt('Admin note (optional)') || ''
                                  setCommentModBusy(true)
                                  try {
                                    await http.post(`/admin/comments/${encodeURIComponent(id)}/${action}`, { note: note.trim() || null })
                                    toast.push({ title: wantHide ? 'Comment hidden' : 'Comment restored', variant: 'success' })
                                    const refreshed = await http.get(`/admin/comments/${encodeURIComponent(id)}`).catch(() => ({ data: null }))
                                    setCommentCtx(refreshed.data ?? null)
                                  } catch (e) {
                                    toast.push({ title: e?.response?.data?.message ?? e?.message ?? 'Failed', variant: 'error' })
                                  } finally {
                                    setCommentModBusy(false)
                                  }
                                }}
                                title={commentCtxLoading ? 'Loading comment…' : commentCtx?.deleted_at ? 'Restore comment' : 'Hide comment'}
                              >
                                {commentCtxLoading ? 'Loading…' : commentCtx?.deleted_at ? 'Restore comment' : 'Hide comment'}
                              </Button>
                            ) : null}
                            {String(supportDetail.ticket.related_type || '') === 'job' || String(supportDetail.ticket.related_type || '') === 'order' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  const id = String(supportDetail.ticket.related_id || '')
                                  if (!id) return
                                  setDisputesFilter(id)
                                  setTab('disputes')
                                }}
                                title="Jump to the Disputes tab filtered by this job/order id"
                              >
                                Open disputes
                              </Button>
                            ) : null}
                            {String(supportDetail.ticket.related_type || '') === 'job' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="border-amber-200 text-amber-900 hover:bg-amber-50"
                                onClick={async () => {
                                  const ok = window.confirm(
                                    'Confirm no-show and apply a reliability strike to the assigned provider?\n\nThis will affect trust/ranking and may freeze the provider after repeated strikes.',
                                  )
                                  if (!ok) return
                                  try {
                                    await http.post(`/admin/support/tickets/${supportSelectedId}/confirm-no-show`, {
                                      note: `Confirmed from Admin Support ticket ${supportSelectedId}`,
                                    })
                                    toast.push({ title: 'No-show confirmed (strike applied)', variant: 'success' })
                                    await openSupportTicket(supportSelectedId)
                                  } catch (e) {
                                    toast.push({
                                      title: e?.response?.data?.message ?? e?.message ?? 'Failed to confirm no-show',
                                      variant: 'error',
                                    })
                                  }
                                }}
                              >
                                Confirm no-show (strike)
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                const id = supportDetail.ticket.related_id
                                if (!id) return
                                copyText('Related ID', id)
                              }}
                            >
                              Copy ID
                            </Button>
                          </div>
                          {String(supportDetail.ticket.related_type || '') === 'post_comment' ? (
                            <div className="mt-2 text-xs text-slate-600">
                              Comment status:{' '}
                              {commentCtxLoading ? (
                                <span className="font-semibold">loading…</span>
                              ) : commentCtx?.deleted_at ? (
                                <span className="font-semibold text-red-700">hidden</span>
                              ) : commentCtx ? (
                                <span className="font-semibold text-emerald-700">visible</span>
                              ) : (
                                <span className="font-semibold">unknown</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={supportUpdateBusy}
                        onClick={() =>
                          updateSupportTicket(supportSelectedId, {
                            assigned_admin_user_id: authUser?.id ?? null,
                          })
                        }
                        title="Assign this ticket to you"
                      >
                        Assign to me
                      </Button>
                      <Select
                        value={supportDetail.ticket.status}
                        onChange={(e) => updateSupportTicket(supportSelectedId, { status: e.target.value })}
                        disabled={supportUpdateBusy}
                      >
                        <option value="open">open</option>
                        <option value="pending_admin">pending_admin</option>
                        <option value="pending_user">pending_user</option>
                        <option value="resolved">resolved</option>
                        <option value="closed">closed</option>
                      </Select>
                      <Select
                        value={supportDetail.ticket.priority}
                        onChange={(e) => updateSupportTicket(supportSelectedId, { priority: e.target.value })}
                        disabled={supportUpdateBusy}
                      >
                        <option value="low">low</option>
                        <option value="normal">normal</option>
                        <option value="high">high</option>
                        <option value="urgent">urgent</option>
                      </Select>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="text-sm font-semibold">Timeline</div>
                  {Array.isArray(supportDetail.events) && supportDetail.events.length ? (
                    <div className="mt-3 space-y-3">
                      {supportDetail.events.map((e) => (
                        <div
                          key={e.id}
                          className={[
                            'rounded-2xl border p-4',
                            e.visibility === 'internal' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
                          ].join(' ')}
                        >
                          <div className="text-xs text-slate-500">
                            {new Date(e.created_at).toLocaleString()} • {e.author_name || 'User'} • {e.visibility}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{e.body}</div>
                          {Array.isArray(e.attachments) && e.attachments.filter(Boolean).length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {e.attachments
                                .filter(Boolean)
                                .slice(0, 12)
                                .map((u) => (
                                  <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
                                    {String(u).match(/\.(mp4|webm|mov)(\?|#|$)/i) ? (
                                      <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                                        Video attachment
                                        <span className="text-slate-400">•</span>
                                        Open
                                      </div>
                                    ) : (
                                      <img src={u} alt="attachment" className="h-16 w-16 rounded-xl border object-cover" loading="lazy" />
                                    )}
                                  </a>
                                ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">No events yet.</div>
                  )}
                </Card>

                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Reply</div>
                    <div className="flex items-center gap-2">
                      <Label>Visibility</Label>
                      <Select value={supportReplyVisibility} onChange={(e) => setSupportReplyVisibility(e.target.value)} disabled={supportReplyBusy}>
                        <option value="customer">customer</option>
                        <option value="internal">internal</option>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    <textarea
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      rows={4}
                      value={supportReplyBody}
                      onChange={(e) => setSupportReplyBody(e.target.value)}
                      placeholder="Write a reply or internal note…"
                      disabled={supportReplyBusy}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={supportReplyBusy} onClick={() => addSupportEvent(supportSelectedId)}>
                        {supportReplyBusy ? 'Sending…' : supportReplyVisibility === 'internal' ? 'Add internal note' : 'Send reply to user'}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={supportReplyBusy}
                        onClick={() => setSupportReplyBody('Hi! Thanks for reaching out. Can you share a bit more detail (what happened, when, and any screenshots)?')}
                      >
                        Request more info
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={supportReplyBusy}
                        onClick={() => setSupportReplyBody('Thanks — we’ve resolved this. Please refresh and try again. If it still happens, reply here and we’ll investigate.')}
                      >
                        Resolved template
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'reliability' ? (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Reliability</div>
                <div className="mt-1 text-xs text-slate-600">Queues & background workers health (internal).</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={queuesLoading} onClick={refreshQueuesNow}>
                  Refresh
                </Button>
                <Button variant="secondary" onClick={exportQueueFailures}>
                  Export last 50 failures
                </Button>
              </div>
            </div>

            {queuesLoading ? (
              <div className="mt-3 text-sm text-slate-600">Loading…</div>
            ) : queuesError ? (
              <div className="mt-3 text-sm text-red-700">{queuesError}</div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(() => {
                  const c = queues?.webhook_queue?.counts
                  const items = [
                    { label: 'Pending', value: c?.pending ?? 0, tone: 'bg-slate-50' },
                    { label: 'Retry', value: c?.retry ?? 0, tone: 'bg-amber-50' },
                    { label: 'Dead', value: c?.dead ?? 0, tone: 'bg-red-50' },
                    { label: 'Processing', value: c?.processing ?? 0, tone: 'bg-slate-50' },
                    { label: 'Ignored', value: c?.ignored ?? 0, tone: 'bg-slate-50' },
                    { label: 'Processed', value: c?.processed ?? 0, tone: 'bg-slate-50' },
                  ]
                  return items.map((it) => (
                    <div key={it.label} className={`rounded-2xl border p-4 ${it.tone}`}>
                      <div className="text-xs font-semibold text-slate-600">{it.label}</div>
                      <div className="mt-1 text-2xl font-extrabold text-slate-900">{Number(it.value)}</div>
                    </div>
                  ))
                })()}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Recent webhook failures</div>
              <div className="text-xs text-slate-500">retry/dead only</div>
            </div>
            {queuesLoading ? (
              <div className="mt-3 text-sm text-slate-600">Loading…</div>
            ) : !Array.isArray(queues?.webhook_queue?.recent_failures) || queues.webhook_queue.recent_failures.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No recent failures.</div>
            ) : (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Attempts</th>
                      <th className="py-2 pr-3">Next retry</th>
                      <th className="py-2 pr-3">Error</th>
                      <th className="py-2 pr-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {queues.webhook_queue.recent_failures.slice(0, 50).map((x) => (
                      <tr key={x.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openQueueDetail(x.id)}>
                        <td className="py-2 pr-3 font-semibold text-slate-900">{x.provider}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={[
                              'rounded-full px-2 py-1 text-xs font-semibold',
                              x.status === 'dead' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800',
                            ].join(' ')}
                          >
                            {x.status}
                          </span>
                        </td>
                        <td className="py-2 pr-3">{Number(x.attempts ?? 0)}</td>
                        <td className="py-2 pr-3 text-xs text-slate-600">{x.next_retry_at ? new Date(x.next_retry_at).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-3">
                          <div className="max-w-md truncate text-xs text-slate-700" title={x.last_error || ''}>
                            {x.last_error || '—'}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              disabled={queueActionBusyId === x.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                retryQueueItem(x.id)
                              }}
                            >
                              {queueActionBusyId === x.id ? '…' : 'Retry'}
                            </Button>
                            <Button
                              variant="secondary"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                              disabled={queueActionBusyId === x.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                ignoreQueueItem(x.id)
                              }}
                            >
                              Ignore
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {queueDetailId ? (
            <div className="fixed inset-0 z-50">
              <div className="absolute inset-0 bg-black/30" onClick={closeQueueDetail} />
              <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-auto bg-white shadow-2xl">
                <div className="sticky top-0 border-b bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Webhook queue item</div>
                      <div className="mt-1 text-xs text-slate-500">{queueDetailId}</div>
                    </div>
                    <Button variant="secondary" onClick={closeQueueDetail}>
                      Close
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  {queueDetailLoading ? (
                    <Card>Loading…</Card>
                  ) : queueDetailError ? (
                    <Card>
                      <div className="text-sm text-red-700">{queueDetailError}</div>
                    </Card>
                  ) : !queueDetail ? (
                    <Card>No data.</Card>
                  ) : (
                    <>
                      <Card>
                        <div className="text-sm font-semibold">Summary</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Provider</span>
                            <span className="font-semibold">{queueDetail.provider}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Event ID</span>
                            <span className="font-semibold">{queueDetail.event_id || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Status</span>
                            <span className="font-semibold">{queueDetail.status}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Attempts</span>
                            <span className="font-semibold">{Number(queueDetail.attempts ?? 0)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Next retry</span>
                            <span className="font-semibold">{queueDetail.next_retry_at ? new Date(queueDetail.next_retry_at).toLocaleString() : '—'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Updated</span>
                            <span className="font-semibold">{queueDetail.updated_at ? new Date(queueDetail.updated_at).toLocaleString() : '—'}</span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => copyText('Queue item ID', queueDetail.id)}
                          >
                            Copy ID
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => copyText('Event ID', queueDetail.event_id)}
                          >
                            Copy event
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={queueActionBusyId === queueDetail.id}
                            onClick={() => retryQueueItem(queueDetail.id)}
                          >
                            {queueActionBusyId === queueDetail.id ? '…' : 'Retry'}
                          </Button>
                          <Button
                            variant="secondary"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={queueActionBusyId === queueDetail.id}
                            onClick={() => ignoreQueueItem(queueDetail.id)}
                          >
                            Ignore
                          </Button>
                        </div>
                      </Card>

                      <Card>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Last error</div>
                          <Button variant="secondary" onClick={() => copyText('Last error', queueDetail.last_error || '')}>
                            Copy error
                          </Button>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap rounded-2xl border bg-slate-50 p-3 text-xs text-slate-800">
{queueDetail.last_error || '—'}
                        </pre>
                      </Card>

                      <Card>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">Payload</div>
                          <Button
                            variant="secondary"
                            onClick={() => copyText('Payload', JSON.stringify(queueDetail.payload ?? {}, null, 2))}
                          >
                            Copy payload
                          </Button>
                        </div>
                        <pre className="mt-3 overflow-auto rounded-2xl border bg-slate-50 p-3 text-xs text-slate-800">
{JSON.stringify(queueDetail.payload ?? {}, null, 2)}
                        </pre>
                      </Card>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'controls' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="text-sm font-semibold">Manual job reassignment</div>
            <div className="mt-1 text-xs text-slate-600">
              Use when a provider no-shows and you need to keep the buyer’s transaction alive (before escrow is held).
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Job ID</Label>
                <Input value={opsJobId} onChange={(e) => setOpsJobId(e.target.value)} placeholder="uuid" />
              </div>
              <div>
                <Label>Artisan user ID</Label>
                <Input value={opsArtisanUserId} onChange={(e) => setOpsArtisanUserId(e.target.value)} placeholder="uuid" />
              </div>
              <div>
                <Label>Accepted quote (GHS)</Label>
                <Input
                  value={opsAcceptedQuote}
                  onChange={(e) => setOpsAcceptedQuote(e.target.value)}
                  placeholder="e.g. 150"
                  type="number"
                />
              </div>
              <Button
                disabled={opsActionBusy}
                onClick={async () => {
                  setOpsActionBusy(true)
                  setOpsActionMsg(null)
                  try {
                    await http.post(`/admin/jobs/${encodeURIComponent(opsJobId)}/reassign`, {
                      artisan_user_id: opsArtisanUserId || null,
                      accepted_quote: opsAcceptedQuote || null,
                    })
                    setOpsActionMsg('Job reassigned.')
                  } catch (e) {
                    setOpsActionMsg(e?.response?.data?.message ?? e?.message ?? 'Failed')
                  } finally {
                    setOpsActionBusy(false)
                  }
                }}
              >
                {opsActionBusy ? 'Working…' : 'Reassign job'}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Escrow overrides</div>
            <div className="mt-1 text-xs text-slate-600">Use sparingly. Prefer disputes for contested cases.</div>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Escrow ID</Label>
                <Input value={opsEscrowId} onChange={(e) => setOpsEscrowId(e.target.value)} placeholder="uuid" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={opsActionBusy}
                  onClick={async () => {
                    setOpsActionBusy(true)
                    setOpsActionMsg(null)
                    try {
                      await http.post(`/admin/escrows/${encodeURIComponent(opsEscrowId)}/release`, { note: 'Manual release' })
                      setOpsActionMsg('Escrow released.')
                    } catch (e) {
                      setOpsActionMsg(e?.response?.data?.message ?? e?.message ?? 'Failed')
                    } finally {
                      setOpsActionBusy(false)
                    }
                  }}
                >
                  Release escrow
                </Button>
                <Button
                  variant="secondary"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={opsActionBusy}
                  onClick={async () => {
                    setOpsActionBusy(true)
                    setOpsActionMsg(null)
                    try {
                      await http.post(`/admin/escrows/${encodeURIComponent(opsEscrowId)}/refund`, { note: 'Manual refund' })
                      setOpsActionMsg('Escrow marked refunded.')
                    } catch (e) {
                      setOpsActionMsg(e?.response?.data?.message ?? e?.message ?? 'Failed')
                    } finally {
                      setOpsActionBusy(false)
                    }
                  }}
                >
                  Refund escrow
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Provider suspension</div>
            <div className="mt-1 text-xs text-slate-600">Temporary freeze for repeated no-shows or off-platform leakage.</div>
            <div className="mt-4 space-y-3">
              <div>
                <Label>User ID</Label>
                <Input value={opsUserId} onChange={(e) => setOpsUserId(e.target.value)} placeholder="uuid" />
              </div>
              <div>
                <Label>Suspend hours</Label>
                <Input value={opsSuspendHours} onChange={(e) => setOpsSuspendHours(e.target.value)} type="number" />
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={opsSuspendReason} onChange={(e) => setOpsSuspendReason(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={opsActionBusy}
                  onClick={async () => {
                    setOpsActionBusy(true)
                    setOpsActionMsg(null)
                    try {
                      await http.put(`/admin/users/${encodeURIComponent(opsUserId)}/suspend`, {
                        hours: Number(opsSuspendHours || 1),
                        reason: opsSuspendReason || null,
                      })
                      setOpsActionMsg('User suspended.')
                    } catch (e) {
                      setOpsActionMsg(e?.response?.data?.message ?? e?.message ?? 'Failed')
                    } finally {
                      setOpsActionBusy(false)
                    }
                  }}
                >
                  Suspend
                </Button>
                <Button
                  variant="secondary"
                  disabled={opsActionBusy}
                  onClick={async () => {
                    setOpsActionBusy(true)
                    setOpsActionMsg(null)
                    try {
                      await http.put(`/admin/users/${encodeURIComponent(opsUserId)}/unsuspend`)
                      setOpsActionMsg('User unsuspended.')
                    } catch (e) {
                      setOpsActionMsg(e?.response?.data?.message ?? e?.message ?? 'Failed')
                    } finally {
                      setOpsActionBusy(false)
                    }
                  }}
                >
                  Unsuspend
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Reliability enforcement: mark no-show</div>
            <div className="mt-1 text-xs text-slate-600">
              Adds a reliability strike (warns user; 3 strikes in 30 days triggers a 7-day freeze).
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <Label>User ID</Label>
                <Input value={opsUserId} onChange={(e) => setOpsUserId(e.target.value)} placeholder="uuid" />
              </div>
              <div>
                <Label>Context type</Label>
                <Select value={opsNoShowContextType} onChange={(e) => setOpsNoShowContextType(e.target.value)}>
                  <option value="job">Job</option>
                  <option value="order">Order</option>
                  <option value="delivery">Delivery</option>
                </Select>
              </div>
              <div>
                <Label>Context ID (optional)</Label>
                <Input value={opsNoShowContextId} onChange={(e) => setOpsNoShowContextId(e.target.value)} placeholder="uuid" />
              </div>
              <Button
                variant="secondary"
                disabled={opsActionBusy}
                onClick={async () => {
                  setOpsActionBusy(true)
                  setOpsActionMsg(null)
                  try {
                    await http.post('/admin/policy/no-show', {
                      user_id: opsUserId,
                      context_type: opsNoShowContextType,
                      context_id: opsNoShowContextId || null,
                      note: 'Marked by ops',
                    })
                    setOpsActionMsg('No-show recorded.')
                  } catch (e) {
                    setOpsActionMsg(e?.response?.data?.message ?? e?.message ?? 'Failed')
                  } finally {
                    setOpsActionBusy(false)
                  }
                }}
              >
                Record no-show
              </Button>
            </div>
          </Card>

          {opsActionMsg ? (
            <div className="lg:col-span-2">
              <Card>
                <div className="text-sm">{opsActionMsg}</div>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'news' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">News posts</div>
                <div className="mt-1 text-xs text-slate-600">Create and publish announcements for the `/news` page.</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={newsBusy} onClick={createNews}>
                  New
                </Button>
                <Button variant="secondary" disabled={newsLoading} onClick={async () => refreshNewsList()}>
                  Refresh
                </Button>
              </div>
            </div>

            {newsLoading ? (
              <div className="mt-3 text-sm text-slate-600">Loading…</div>
            ) : newsError ? (
              <div className="mt-3 text-sm text-red-700">{newsError}</div>
            ) : newsItems.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No posts yet.</div>
            ) : (
              <div className="mt-3 divide-y">
                {newsItems.slice(0, 200).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setNewsSelectedId(p.id)}
                    className={[
                      'w-full text-left py-3',
                      newsSelectedId === p.id ? 'bg-slate-50' : 'bg-transparent hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="px-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900 line-clamp-2">{p.title}</div>
                        <div
                          className={[
                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                            p.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700',
                          ].join(' ')}
                        >
                          {p.status}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">/{p.slug}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2">
            {!newsSelectedId ? (
              <div className="text-sm text-slate-600">Select a post, or click “New”.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Edit</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Public URL: <span className="font-semibold">/news/{newsEditSlug || newsSelected?.slug || ''}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={newsBusy} onClick={deleteNews} className="border-red-200 text-red-700 hover:bg-red-50">
                      Delete
                    </Button>
                    <Button disabled={newsBusy} onClick={saveNews}>
                      {newsBusy ? 'Working…' : 'Save'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Title</Label>
                    <Input value={newsEditTitle} onChange={(e) => setNewsEditTitle(e.target.value)} disabled={newsBusy} />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Slug</Label>
                    <Input value={newsEditSlug} onChange={(e) => setNewsEditSlug(e.target.value)} disabled={newsBusy} placeholder="leave blank to auto-generate" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Status</Label>
                    <Select value={newsEditStatus} onChange={(e) => setNewsEditStatus(e.target.value)} disabled={newsBusy}>
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label>Category</Label>
                    <Input value={newsEditCategory} onChange={(e) => setNewsEditCategory(e.target.value)} disabled={newsBusy} placeholder="Product updates" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Summary (excerpt)</Label>
                    <Input value={newsEditSummary} onChange={(e) => setNewsEditSummary(e.target.value)} disabled={newsBusy} placeholder="Short summary shown on /news" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Hero image URL</Label>
                    <Input value={newsEditHeroUrl} onChange={(e) => setNewsEditHeroUrl(e.target.value)} disabled={newsBusy} placeholder="https://…" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Hero image alt text</Label>
                    <Input value={newsEditHeroAlt} onChange={(e) => setNewsEditHeroAlt(e.target.value)} disabled={newsBusy} placeholder="Accra skyline" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Hero image credit</Label>
                    <Input value={newsEditHeroCredit} onChange={(e) => setNewsEditHeroCredit(e.target.value)} disabled={newsBusy} placeholder="Photo credit + license" />
                  </div>
                </div>

                <div>
                  <Label>Body</Label>
                  <textarea
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    rows={12}
                    value={newsEditBody}
                    onChange={(e) => setNewsEditBody(e.target.value)}
                    disabled={newsBusy}
                    placeholder="Write your announcement…"
                  />
                  <div className="mt-2 text-xs text-slate-500">Tip: keep it simple. This is plain text for now (no markdown).</div>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'flags' ? (
        <Card>
        <div className="text-sm font-semibold">Feature flags (vertical unlocks)</div>
        {featureFlagsLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : featureFlagsError ? (
          <div className="mt-3 text-sm text-red-700">{featureFlagsError}</div>
        ) : featureFlags.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No flags found.</div>
        ) : (
          <div className="mt-3 divide-y">
            {featureFlags.map((f) => (
              <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold">{f.key}</div>
                  {f.description ? <div className="mt-1 text-xs text-slate-600">{f.description}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={f.enabled ? 'secondary' : 'primary'}
                    disabled={featureBusyKey === f.key}
                    onClick={() => toggleFeature(f.key, !f.enabled)}
                  >
                    {featureBusyKey === f.key ? 'Saving…' : f.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        </Card>
      ) : null}

      {tab === 'payouts' ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Payouts</div>
              <div className="mt-1 text-xs text-slate-600">MVP: withdrawals create pending payouts; admins review and mark paid.</div>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                const res = await http.get('/admin/payouts')
                setPayouts(Array.isArray(res.data) ? res.data : [])
                await refreshOps().catch(() => {})
              }}
            >
              Refresh
            </Button>
          </div>

          {payoutsLoading ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : payoutsError ? (
            <div className="mt-3 text-sm text-red-700">{payoutsError}</div>
          ) : payouts.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">No payouts yet.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3 text-slate-700">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-3 text-slate-700">{String(p.user_id).slice(0, 8)}…</td>
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {p.currency ?? 'GHS'} {Number(p.amount ?? 0).toFixed(0)}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{p.method}</td>
                      <td className="py-2 pr-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{p.status}</span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={payoutBusyId === p.id || p.status === 'paid'}
                            onClick={() => markPayoutPaid(p.id)}
                          >
                            {payoutBusyId === p.id ? 'Working…' : 'Mark paid'}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={payoutBusyId === p.id || p.status === 'paid' || p.status === 'cancelled'}
                            onClick={() => cancelPayout(p.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold">Recent admin actions</div>
              <Button
                variant="secondary"
                onClick={() => http.get('/admin/audit').then((r) => setAudit(Array.isArray(r.data) ? r.data : [])).catch(() => {})}
              >
                Refresh
              </Button>
            </div>
            {auditLoading ? (
              <div className="mt-2 text-sm text-slate-600">Loading…</div>
            ) : audit.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">No actions recorded yet.</div>
            ) : (
              <div className="mt-3 divide-y">
                {audit.slice(0, 15).map((a) => (
                  <div key={a.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900">{a.action}</div>
                      <div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {a.target_type ? `${a.target_type}: ` : ''}{a.target_id ?? '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {tab === 'users' ? (
      <Card>
        <div className="text-sm font-semibold">Users</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No users found.</div>
        ) : (
          <div className="mt-3 divide-y">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className={[
                  'flex flex-wrap items-center justify-between gap-3 py-3 rounded-xl px-2 -mx-2 cursor-pointer',
                  selectedUserId === u.id ? 'bg-slate-50' : 'hover:bg-slate-50',
                ].join(' ')}
                role="button"
                tabIndex={0}
                onClick={() => loadUserDetail(u.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') loadUserDetail(u.id)
                }}
              >
                <div className="min-w-[220px]">
                  <div className="text-sm font-semibold">{u.name || u.email}</div>
                  <div className="text-xs text-slate-600">
                    {u.role} • {u.verified ? 'verified' : 'not verified'}
                  </div>
                  {u.email ? <div className="mt-1 text-xs text-slate-500">{u.email}</div> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      loadUserDetail(u.id)
                      loadTrust(u.id)
                    }}
                  >
                    Trust
                  </Button>
                {!u.verified ? (
                    <Button
                      disabled={busyId === u.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        loadUserDetail(u.id)
                        verifyUser(u.id)
                      }}
                    >
                    {busyId === u.id ? 'Verifying…' : 'Verify'}
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>
                    Verified
                  </Button>
                )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedUserId ? (
          <div className="mt-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">User details</div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedUserId(null)
                  setSelectedUser(null)
                  setSelectedUserError(null)
                  setTempPassword(null)
                }}
              >
                Close
              </Button>
            </div>

            {selectedUserLoading ? (
              <div className="mt-2 text-sm text-slate-600">Loading…</div>
            ) : selectedUserError ? (
              <div className="mt-2 text-sm text-red-700">{selectedUserError}</div>
            ) : selectedUser?.user ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <img
                      src={selectedUser.user.profile_pic || '/locallink-logo.png'}
                      alt="avatar"
                      className="h-12 w-12 rounded-2xl border object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{selectedUser.user.name || selectedUser.user.email}</div>
                      <div className="mt-0.5 text-xs text-slate-600">
                        {selectedUser.user.role} • {selectedUser.user.verified ? 'verified' : 'not verified'} • tier:{' '}
                        {selectedUser.user.verification_tier || 'unverified'}
                      </div>
                      {selectedUser.user.email ? <div className="mt-2 text-sm text-slate-700">{selectedUser.user.email}</div> : null}
                      {selectedUser.user.phone ? <div className="mt-1 text-sm text-slate-700">{selectedUser.user.phone}</div> : null}
                      <div className="mt-2 text-xs text-slate-500">
                        Created: {selectedUser.user.created_at ? new Date(selectedUser.user.created_at).toLocaleString() : '—'}
                        {selectedUser.user.last_active_at ? (
                          <span className="ml-2">• Last active: {new Date(selectedUser.user.last_active_at).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {selectedUser.profile?.bio ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-slate-600">Bio</div>
                      <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{selectedUser.profile.bio}</div>
                    </div>
                  ) : null}

                  {selectedUser.user.suspended_until ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <div className="font-semibold">Suspended</div>
                      <div className="mt-1">
                        Until: {new Date(selectedUser.user.suspended_until).toLocaleString()}
                        {selectedUser.user.suspended_reason ? <span className="ml-1">• {selectedUser.user.suspended_reason}</span> : null}
                      </div>
                    </div>
                  ) : null}

                  {selectedUser.user.deleted_at ? (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      <div className="font-semibold">Deleted</div>
                      <div className="mt-1">Deleted at: {new Date(selectedUser.user.deleted_at).toLocaleString()}</div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold">Admin actions</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => loadTrust(selectedUser.user.id)}>
                      View trust
                    </Button>
                    {!selectedUser.user.verified ? (
                      <Button disabled={busyId === selectedUser.user.id} onClick={() => verifyUser(selectedUser.user.id)}>
                        {busyId === selectedUser.user.id ? 'Verifying…' : 'Verify user'}
                      </Button>
                    ) : (
                      <Button variant="secondary" disabled>
                        Verified
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      className="border-amber-200 text-amber-900 hover:bg-amber-50"
                      onClick={() => resetUserPassword(selectedUser.user.id)}
                    >
                      Reset password
                    </Button>
                  </div>

                  {tempPassword ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700">Temporary password (share securely)</div>
                      <div className="mt-1 font-mono text-sm text-slate-900">{tempPassword}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            toast
                              .promise(navigator.clipboard.writeText(tempPassword), {
                                loading: 'Copying…',
                                success: 'Copied',
                                error: 'Copy failed',
                              })
                              .catch(() => {})
                          }
                        >
                          Copy
                        </Button>
                      </div>
                      <div className="mt-2 text-xs text-slate-600">User will be forced to set a new password on next login.</div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-600">
                      We do <span className="font-semibold">not</span> show stored passwords. Use “Reset password” instead.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">Select a user to view details.</div>
            )}
          </div>
        ) : null}

        {trustUserId ? (
          <div className="mt-4 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Trust report</div>
              <Button
                variant="secondary"
                onClick={() => {
                  setTrustUserId(null)
                  setTrustReport(null)
                  setTrustError(null)
                }}
              >
                Close
              </Button>
            </div>
            {trustLoading ? (
              <div className="mt-2 text-sm text-slate-600">Loading…</div>
            ) : trustError ? (
              <div className="mt-2 text-sm text-red-700">{trustError}</div>
            ) : trustReport ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">Score</div>
                  <div className="mt-1 text-2xl font-extrabold text-slate-900">
                    {Number(trustReport.score ?? 0).toFixed(1)} <span className="text-sm font-semibold text-slate-500">/ 100</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    Band: <span className="font-semibold">{String(trustReport.band || '').toUpperCase()}</span>
                  </div>
                  {trustReport?.risk_flags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trustReport.risk_flags.slice(0, 10).map((f) => (
                        <span key={f.key} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                          {f.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">No major risk flags.</div>
                  )}
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold">Breakdown</div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Base score (matching)</span>
                      <span className="font-semibold">{Number(trustReport.base_score ?? 0).toFixed(1)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Boosts</span>
                      <span className="font-semibold text-emerald-700">+{Number(trustReport.boost_total ?? 0).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Penalties</span>
                      <span className="font-semibold text-red-700">-{Number(trustReport.penalty_total ?? 0).toFixed(0)}</span>
                    </div>
                    {Array.isArray(trustReport.penalties) && trustReport.penalties.length ? (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-700">Penalties</div>
                        <div className="mt-1 space-y-1">
                          {trustReport.penalties.map((p) => (
                            <div key={p.key} className="flex items-center justify-between rounded-xl border bg-red-50 px-3 py-2">
                              <div className="text-xs font-semibold text-red-800">{p.label}</div>
                              <div className="text-xs font-semibold text-red-800">-{p.points}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {Array.isArray(trustReport.boosts) && trustReport.boosts.length ? (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-700">Boosts</div>
                        <div className="mt-1 space-y-1">
                          {trustReport.boosts.map((b) => (
                            <div key={b.key} className="flex items-center justify-between rounded-xl border bg-emerald-50 px-3 py-2">
                              <div className="text-xs font-semibold text-emerald-800">{b.label}</div>
                              <div className="text-xs font-semibold text-emerald-800">+{b.points}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {trustReport.raw ? (
                      <details className="mt-3 rounded-2xl border bg-slate-50 p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-700">Raw signals</summary>
                        <pre className="mt-2 overflow-auto text-xs text-slate-700">{JSON.stringify(trustReport.raw, null, 2)}</pre>
                      </details>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">Select a user and click “Trust”.</div>
            )}
          </div>
        ) : null}
      </Card>
      ) : null}

      {tab === 'verification' ? (
      <Card>
        <div className="text-sm font-semibold">Verification requests</div>
        {verificationLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : verificationRequests.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No pending requests.</div>
        ) : (
          <div className="mt-3 divide-y">
            {verificationRequests.map((r) => {
              const evidenceFiles = r?.evidence?.files
              const levelDefault = r?.requested_level ?? 'bronze'
              return (
                <div key={r.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{r.name || r.email}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {r.role} • requested: {r.requested_level} • submitted: {new Date(r.created_at).toLocaleString()}
                      </div>
                      {r.note ? <div className="mt-2 text-sm text-slate-700">{r.note}</div> : null}
                      {Array.isArray(evidenceFiles) && evidenceFiles.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {evidenceFiles.slice(0, 6).map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="evidence" className="h-14 w-14 rounded-xl border object-cover" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">No evidence files.</div>
                      )}
                    </div>

                    <div className="w-full max-w-md space-y-2">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <Label>Approve level</Label>
                          <Select
                            value={verificationApproveLevelById[r.id] ?? levelDefault}
                            onChange={(e) => setVerificationApproveLevelById((m) => ({ ...m, [r.id]: e.target.value }))}
                          >
                            <option value="bronze">bronze</option>
                            <option value="silver">silver</option>
                            <option value="gold">gold</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Admin note (optional)</Label>
                          <Input
                            value={verificationNoteById[r.id] ?? ''}
                            onChange={(e) => setVerificationNoteById((m) => ({ ...m, [r.id]: e.target.value }))}
                            placeholder="Reason / next steps"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={verificationBusyId === r.id} onClick={() => approveVerification(r.id)}>
                          {verificationBusyId === r.id ? 'Working…' : 'Approve'}
                        </Button>
                        <Button variant="secondary" disabled={verificationBusyId === r.id} onClick={() => rejectVerification(r.id)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      ) : null}

      {tab === 'verification' ? (
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Ghana ID verification (providers)</div>
            <div className="mt-1 text-xs text-slate-600">Review Ghana Card + selfie submissions for artisans, farmers, and drivers.</div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label>Status</Label>
              <Select value={idvStatus} onChange={(e) => setIdvStatus(e.target.value)}>
                <option value="pending">pending</option>
                <option value="needs_correction">needs_correction</option>
                <option value="rejected">rejected</option>
                <option value="approved">approved</option>
              </Select>
            </div>
          </div>
        </div>

        {idvLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : idvError ? (
          <div className="mt-3 text-sm text-red-700">{idvError}</div>
        ) : idvRequests.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No requests.</div>
        ) : (
          <div className="mt-3 divide-y">
            {idvRequests.map((r) => {
              const selected = idvSelectedId === r.id
              const frontPreview = r.id_front_url ? idvPreviewByUrl[r.id_front_url] : null
              const backPreview = r.id_back_url ? idvPreviewByUrl[r.id_back_url] : null
              const selfiePreview = r.selfie_url ? idvPreviewByUrl[r.selfie_url] : null
              return (
                <div key={r.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-slate-900 hover:underline"
                        onClick={() => setIdvSelectedId((prev) => (prev === r.id ? null : r.id))}
                      >
                        {r.name || r.email} <span className="text-xs text-slate-500">({r.role})</span>
                      </button>
                      <div className="mt-1 text-xs text-slate-600">
                        status: {r.status} • submitted: {new Date(r.created_at).toLocaleString()}
                      </div>
                      {r.rejection_reason ? <div className="mt-2 text-xs text-slate-700">Reason: {r.rejection_reason}</div> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => previewIdvImages(r)} disabled={idvBusyId === r.id}>
                          Preview images
                        </Button>
                      </div>
                      {(frontPreview || backPreview || selfiePreview) ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {frontPreview ? <img src={frontPreview} alt="ID front" className="h-16 w-16 rounded-xl border object-cover" /> : null}
                          {backPreview ? <img src={backPreview} alt="ID back" className="h-16 w-16 rounded-xl border object-cover" /> : null}
                          {selfiePreview ? <img src={selfiePreview} alt="Selfie" className="h-16 w-16 rounded-xl border object-cover" /> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full max-w-md space-y-2">
                      <div>
                        <Label>Correction / rejection reason</Label>
                        <Input
                          value={idvReasonById[r.id] ?? ''}
                          onChange={(e) => setIdvReasonById((m) => ({ ...m, [r.id]: e.target.value }))}
                          placeholder="e.g. ID photo blurry, glare, selfie mismatch…"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={idvBusyId === r.id || r.status !== 'pending'} onClick={() => approveIdv(r.id)}>
                          {idvBusyId === r.id ? 'Working…' : 'Approve'}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={idvBusyId === r.id || r.status !== 'pending'}
                          onClick={() => rejectIdv(r.id, 'needs_correction')}
                        >
                          Needs correction
                        </Button>
                        <Button
                          variant="secondary"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          disabled={idvBusyId === r.id || r.status !== 'pending'}
                          onClick={() => rejectIdv(r.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>

                  {selected && idvSelected ? (
                    <details className="mt-3 rounded-2xl border bg-slate-50 p-3" open>
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Details</summary>
                      <pre className="mt-2 overflow-auto text-xs text-slate-700">{JSON.stringify(idvSelected, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </Card>
      ) : null}

      {tab === 'verification' ? (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">
            Driver approval
            {(drivers || []).filter((x) => x.status === 'pending').length > 0 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {(drivers || []).filter((x) => x.status === 'pending').length} pending
              </span>
            ) : null}
          </div>
          <div className="text-xs text-slate-600">Review driver profiles and approve to enable deliveries.</div>
        </div>
        {driversLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : filteredDrivers.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No drivers yet.</div>
        ) : (
          <div className="mt-3 divide-y">
            {filteredDrivers.map((d) => (
              <div key={d.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold">{d.name || d.email}</div>
                  <div className="text-xs text-slate-600">
                    {d.vehicle_type} • {d.area_of_operation || '—'} • status: <span className="font-medium">{d.status}</span>
                  </div>
                </div>
                {d.status !== 'approved' ? (
                  <Button onClick={() => approveDriver(d.user_id)}>Approve driver</Button>
                ) : (
                  <Button variant="secondary" disabled>
                    Approved
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      ) : null}

      {tab === 'dispatch' ? (
      <Card>
        <div className="text-sm font-semibold">Deliveries</div>
        <div className="mt-1 text-xs text-slate-600">Only paid orders can be assigned/claimed.</div>
        {deliveriesLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : deliveries.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No deliveries.</div>
        ) : (
          <div className="mt-3 divide-y">
            {deliveries.map((d) => (
              <div key={d.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      Order {d.order_id?.slice(0, 8)} • fee GHS {Number(d.fee ?? d.delivery_task_fee ?? 0).toFixed(0)}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Pickup: {d.pickup_location || '—'}</div>
                    <div className="mt-1 text-xs text-slate-600">Dropoff: {d.dropoff_location || d.delivery_address || '—'}</div>
                    <div className="mt-1 text-xs text-slate-600">Status: {d.status}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={assignDriverIdByDelivery[d.id] ?? ''}
                      onChange={(e) => setAssignDriverIdByDelivery((m) => ({ ...m, [d.id]: e.target.value }))}
                    >
                      <option value="">Assign driver…</option>
                      {drivers.filter((x) => x.status === 'approved').map((x) => (
                        <option key={x.user_id} value={x.user_id}>
                          {x.name || x.email} ({x.vehicle_type})
                        </option>
                      ))}
                    </Select>
                    <Button variant="secondary" disabled={assignBusyId === d.id} onClick={() => assignDriver(d.id)}>
                      {assignBusyId === d.id ? 'Assigning…' : 'Assign'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      ) : null}

      {tab === 'disputes' ? (
      <Card>
        <div className="text-sm font-semibold">Disputes</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Filter (job/order/escrow/user/dispute id)</Label>
            <Input value={disputesFilter} onChange={(e) => setDisputesFilter(e.target.value)} placeholder="Paste an ID to filter…" />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => setDisputesFilter('')} disabled={!disputesFilter}>
              Clear
            </Button>
          </div>
        </div>
        {disputesLoading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : disputesError ? (
          <div className="mt-3 text-sm text-red-700">{disputesError}</div>
        ) : filteredDisputes.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No disputes.</div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-sm font-semibold">Resolve settings</div>
              <div className="mt-3 grid gap-4 md:grid-cols-4">
                <div>
                  <Label>Action</Label>
                  <Select value={resolveAction} onChange={(e) => setResolveAction(e.target.value)}>
                    <option value="release">Release full</option>
                    <option value="refund">Refund full</option>
                    <option value="split">Split</option>
                  </Select>
                </div>
                <div>
                  <Label>Seller amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={resolveSellerAmount}
                    onChange={(e) => setResolveSellerAmount(e.target.value)}
                    disabled={resolveAction !== 'split'}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Buyer amount</Label>
                  <Input
                    type="number"
                    min="0"
                    value={resolveBuyerAmount}
                    onChange={(e) => setResolveBuyerAmount(e.target.value)}
                    disabled={resolveAction !== 'split'}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Input value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Optional note" />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Split amounts must sum to the escrow amount. Platform fee applies only to the seller portion.
              </div>
            </div>

            <div className="divide-y">
              {filteredDisputes.map((d) => (
                <div key={d.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {d.reason} • {d.escrow_currency ?? 'GHS'} {Number(d.escrow_amount ?? 0).toFixed(0)}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        status: {d.status} • escrow: {d.escrow_status} • job: {d.job_id ?? '—'} • order: {d.order_id ?? '—'}
                      </div>
                      {d.details ? <div className="mt-2 text-sm text-slate-700">{d.details}</div> : null}
                      <div className="mt-2 text-xs text-slate-600">
                        Opened: {d.created_at ? new Date(d.created_at).toLocaleString() : '—'}
                        {d.resolved_at ? ` • Resolved: ${new Date(d.resolved_at).toLocaleString()}` : ''}
                      </div>
                      {Array.isArray(d?.evidence?.files) && d.evidence.files.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {d.evidence.files.slice(0, 8).map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                              <Button variant="secondary">Evidence</Button>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Button disabled={resolveBusyId === d.id || d.status === 'resolved'} onClick={() => resolveDispute(d.id, d.escrow_amount)}>
                      {d.status === 'resolved' ? 'Resolved' : resolveBusyId === d.id ? 'Resolving…' : 'Resolve'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      ) : null}
    </div>
  )
}


