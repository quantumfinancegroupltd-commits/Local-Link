import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useDraftAutosave } from '../../lib/drafts.js'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'
import { trackEvent } from '../../lib/useAnalytics.js'
import { useAuth } from '../../auth/useAuth.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { ImageCropperModal } from '../../components/ui/ImageCropperModal.jsx'

function fmtDate(x) {
  try {
    return new Date(x).toLocaleString()
  } catch {
    return String(x || '')
  }
}

export function CompanyDashboard() {
  const toast = useToast()
  const { online } = useOnlineStatus()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const companyIdFromUrl = useMemo(() => {
    const v = String(searchParams.get('company_id') || '').trim()
    return v || null
  }, [searchParams])
  const companySlugFromUrl = useMemo(() => {
    const v = String(searchParams.get('company_slug') || '').trim()
    return v || null
  }, [searchParams])
  const [company, setCompany] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [access, setAccess] = useState(null) // { company_id, workspace_role, company_slug }
  const [myCompanies, setMyCompanies] = useState([])
  const [myCompaniesLoading, setMyCompaniesLoading] = useState(true)
  const [myCompaniesError, setMyCompaniesError] = useState(null)

  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('hiring') // profile | hiring | staff | ops | payroll | insights

  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [sizeRange, setSizeRange] = useState('1-10')
  const [website, setWebsite] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [profileLinks, setProfileLinks] = useState([{ label: 'Website', url: '' }])
  const [privateProfile, setPrivateProfile] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [crop, setCrop] = useState(null) // { kind: 'logo'|'cover', file: File }

  const [jobTitle, setJobTitle] = useState('')
  const [jobLocation, setJobLocation] = useState('')
  const [jobType, setJobType] = useState('full_time')
  const [jobMode, setJobMode] = useState('onsite')
  const [jobPayMin, setJobPayMin] = useState('')
  const [jobPayMax, setJobPayMax] = useState('')
  const [jobPayPeriod, setJobPayPeriod] = useState('month')
  const [jobTerm, setJobTerm] = useState('permanent')
  const [jobScheduleText, setJobScheduleText] = useState('')
  const [jobBenefits, setJobBenefits] = useState('')
  const [jobTags, setJobTags] = useState('')
  const [jobDesc, setJobDesc] = useState('')

  const [selectedJobId, setSelectedJobId] = useState(null)
  const [applications, setApplications] = useState([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsError, setAppsError] = useState(null)
  const [templateByApplicantId, setTemplateByApplicantId] = useState({})

  // Workforce tools (Employers v1)
  const [workerLists, setWorkerLists] = useState([])
  const [workerListsLoading, setWorkerListsLoading] = useState(false)
  const [workerListsError, setWorkerListsError] = useState(null)
  const [selectedListId, setSelectedListId] = useState('')
  const [newListName, setNewListName] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [listBusy, setListBusy] = useState(false)

  const [addWorkerUserId, setAddWorkerUserId] = useState('')

  const [workers, setWorkers] = useState([])
  const [workersLoading, setWorkersLoading] = useState(false)
  const [workersError, setWorkersError] = useState(null)
  const [noteBusyUserId, setNoteBusyUserId] = useState(null)
  const [noteDraftByUserId, setNoteDraftByUserId] = useState({}) // { [userId]: { rating, notes, preferred, blocked } }

  const [shifts, setShifts] = useState([])
  const [shiftsLoading, setShiftsLoading] = useState(false)
  const [shiftsError, setShiftsError] = useState(null)
  const [shiftBusy, setShiftBusy] = useState(false)
  const [shiftTitle, setShiftTitle] = useState('')
  const [shiftRoleTag, setShiftRoleTag] = useState('')
  const [shiftLoc, setShiftLoc] = useState('')
  const [shiftStartAt, setShiftStartAt] = useState('')
  const [shiftEndAt, setShiftEndAt] = useState('')
  const [shiftHeadcount, setShiftHeadcount] = useState('1')
  const [shiftGeoRequired, setShiftGeoRequired] = useState(false)
  const [shiftGeoRadiusM, setShiftGeoRadiusM] = useState('250')
  const [shiftGeoLat, setShiftGeoLat] = useState('')
  const [shiftGeoLng, setShiftGeoLng] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [shiftDetail, setShiftDetail] = useState(null) // {shift, assignments}
  const [shiftDetailLoading, setShiftDetailLoading] = useState(false)
  const [shiftDepartmentId, setShiftDepartmentId] = useState('')
  const [shiftEditTitle, setShiftEditTitle] = useState('')
  const [shiftEditRoleTag, setShiftEditRoleTag] = useState('')
  const [shiftEditLocation, setShiftEditLocation] = useState('')
  const [shiftEditDepartmentId, setShiftEditDepartmentId] = useState('')
  const [shiftEditStartAt, setShiftEditStartAt] = useState('')
  const [shiftEditEndAt, setShiftEditEndAt] = useState('')
  const [shiftEditHeadcount, setShiftEditHeadcount] = useState('1')
  const [assignSelected, setAssignSelected] = useState({}) // { [userId]: boolean }
  const [assignmentBusyKey, setAssignmentBusyKey] = useState(null)
  const [checkinCodeByShiftId, setCheckinCodeByShiftId] = useState({})
  const [checkinBusyShiftId, setCheckinBusyShiftId] = useState(null)
  const [geoCheckinDraftByShiftId, setGeoCheckinDraftByShiftId] = useState({})

  // Recurring scheduling (v1)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState(null)
  const [tplBusy, setTplBusy] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplTitle, setTplTitle] = useState('')
  const [tplRoleTag, setTplRoleTag] = useState('')
  const [tplLocation, setTplLocation] = useState('')
  const [tplHeadcount, setTplHeadcount] = useState('1')
  const [tplGeoRequired, setTplGeoRequired] = useState(false)
  const [tplGeoRadiusM, setTplGeoRadiusM] = useState('250')
  const [tplGeoLat, setTplGeoLat] = useState('')
  const [tplGeoLng, setTplGeoLng] = useState('')

  const [series, setSeries] = useState([])
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [seriesError, setSeriesError] = useState(null)
  const [seriesBusy, setSeriesBusy] = useState(false)
  const [editingSeriesId, setEditingSeriesId] = useState('')
  const [seriesPreview, setSeriesPreview] = useState([]) // [{on_date, start_at, end_at, skipped, already_generated}]
  const [seriesPreviewLoading, setSeriesPreviewLoading] = useState(false)
  const [seriesPreviewError, setSeriesPreviewError] = useState(null)
  const [seriesTemplateId, setSeriesTemplateId] = useState('')
  const [seriesIntervalWeeks, setSeriesIntervalWeeks] = useState('1')
  const [seriesDaysOfWeek, setSeriesDaysOfWeek] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true }) // Mon-Fri default
  const [seriesStartDate, setSeriesStartDate] = useState('')
  const [seriesEndDate, setSeriesEndDate] = useState('')
  const [seriesStartTime, setSeriesStartTime] = useState('09:00')
  const [seriesEndTime, setSeriesEndTime] = useState('17:00')
  const [skipSeriesId, setSkipSeriesId] = useState('')
  const [skipDate, setSkipDate] = useState('')
  const [seriesAutoFillEnabled, setSeriesAutoFillEnabled] = useState(false)
  const [seriesAutoFillListId, setSeriesAutoFillListId] = useState('')
  const [seriesAutoFillMode, setSeriesAutoFillMode] = useState('headcount') // headcount | count
  const [seriesAutoFillCount, setSeriesAutoFillCount] = useState('1')
  const [seriesAutoGenerateEnabled, setSeriesAutoGenerateEnabled] = useState(false)
  const [seriesAutoGenerateDays, setSeriesAutoGenerateDays] = useState('14')

  const [poolListByApplicantId, setPoolListByApplicantId] = useState({})

  const [workforceOverview, setWorkforceOverview] = useState(null)
  const [workforceLoading, setWorkforceLoading] = useState(false)
  const [workforceError, setWorkforceError] = useState(null)

  const [assignmentBulkSelected, setAssignmentBulkSelected] = useState({})
  const [assignmentBulkStatus, setAssignmentBulkStatus] = useState('checked_out')
  const [assignmentBulkBusy, setAssignmentBulkBusy] = useState(false)
  const [fillCount, setFillCount] = useState('1')

  // Payroll (beta)
  const [payrollSettings, setPayrollSettings] = useState(null)
  const [payrollEmployees, setPayrollEmployees] = useState([])
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [payrollError, setPayrollError] = useState(null)

  const [psCurrency, setPsCurrency] = useState('GHS')
  const [psTaxPct, setPsTaxPct] = useState('0')
  const [psNiPct, setPsNiPct] = useState('0')
  const [psPensionPct, setPsPensionPct] = useState('0')
  const [psBusy, setPsBusy] = useState(false)

  const [empName, setEmpName] = useState('')
  const [empEmail, setEmpEmail] = useState('')
  const [empPhone, setEmpPhone] = useState('')
  const [empUserId, setEmpUserId] = useState('')
  const [empPayBasis, setEmpPayBasis] = useState('salary')
  const [empPayRate, setEmpPayRate] = useState('')
  const [empPayPeriod, setEmpPayPeriod] = useState('month')
  const [empTaxCode, setEmpTaxCode] = useState('')
  const [empBusy, setEmpBusy] = useState(false)

  const [runStart, setRunStart] = useState('')
  const [runEnd, setRunEnd] = useState('')
  const [runPayDate, setRunPayDate] = useState('')
  const [hoursByEmpId, setHoursByEmpId] = useState({})
  const [runBusy, setRunBusy] = useState(false)
  const [lastRun, setLastRun] = useState(null) // {run, items, settings}

  // Enterprise Mode: Workspace + audit + reporting
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState(null)
  const [memberEmail, setMemberEmail] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [memberWorkspaceRole, setMemberWorkspaceRole] = useState('ops')
  const [memberBusy, setMemberBusy] = useState(false)

  const [auditItems, setAuditItems] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState(null)
  const [auditBefore, setAuditBefore] = useState(null)
  const [auditHasMore, setAuditHasMore] = useState(false)

  // Workforce insights (beta)
  const [wfDays, setWfDays] = useState('30')
  const [wfInsights, setWfInsights] = useState(null) // { top_reliable, at_risk, daily, window_* }
  const [wfInsightsLoading, setWfInsightsLoading] = useState(false)
  const [wfInsightsError, setWfInsightsError] = useState(null)
  const [wfPoolListId, setWfPoolListId] = useState('')
  const [wfActionBusyKey, setWfActionBusyKey] = useState(null)
  const [wfWorkerModalOpen, setWfWorkerModalOpen] = useState(false)
  const [wfWorkerId, setWfWorkerId] = useState(null)
  const [wfWorkerHistory, setWfWorkerHistory] = useState(null) // { worker, items, window_* }
  const [wfWorkerHistoryLoading, setWfWorkerHistoryLoading] = useState(false)
  const [wfWorkerHistoryError, setWfWorkerHistoryError] = useState(null)

  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)

  const [departments, setDepartments] = useState([])
  const [departmentsLoading, setDepartmentsLoading] = useState(false)
  const [departmentsError, setDepartmentsError] = useState(null)
  const [departmentsBusy, setDepartmentsBusy] = useState(false)
  const [deptName, setDeptName] = useState('')
  const [deptSlug, setDeptSlug] = useState('')
  const [deptLocation, setDeptLocation] = useState('')
  const [editingDeptId, setEditingDeptId] = useState(null)

  const [budgets, setBudgets] = useState([])
  const [budgetsLoading, setBudgetsLoading] = useState(false)
  const [budgetsError, setBudgetsError] = useState(null)
  const [budgetsBusy, setBudgetsBusy] = useState(false)
  const [budgetDeptId, setBudgetDeptId] = useState('')
  const [budgetPeriodStart, setBudgetPeriodStart] = useState('')
  const [budgetPeriodEnd, setBudgetPeriodEnd] = useState('')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [budgetSpent, setBudgetSpent] = useState('')
  const [budgetNotes, setBudgetNotes] = useState('')
  const [editingBudgetId, setEditingBudgetId] = useState(null)
  const [syncBudgetBusyKey, setSyncBudgetBusyKey] = useState(null)

  const [downloadBusyKey, setDownloadBusyKey] = useState(null)

  // Ops Autopilot (coverage auto-fill)
  const [opsAutoEnabled, setOpsAutoEnabled] = useState(false)
  const [opsAutoListId, setOpsAutoListId] = useState('')
  const [opsAutoDays, setOpsAutoDays] = useState('14')
  const [opsAutoMaxShifts, setOpsAutoMaxShifts] = useState('25')
  const [opsAutoMaxInvitesPerDay, setOpsAutoMaxInvitesPerDay] = useState('200')
  const [opsAutoLastRunAt, setOpsAutoLastRunAt] = useState(null)
  const [opsAutoLoading, setOpsAutoLoading] = useState(false)
  const [opsAutoError, setOpsAutoError] = useState(null)
  const [opsAutoBusy, setOpsAutoBusy] = useState(false)
  const [opsAutoRuns, setOpsAutoRuns] = useState([])
  const [opsAutoRunsLoading, setOpsAutoRunsLoading] = useState(false)
  const [opsAutoRunsError, setOpsAutoRunsError] = useState(null)
  const [opsCoverageAlertEnabled, setOpsCoverageAlertEnabled] = useState(true)
  const [opsCoverageAlertLookaheadHours, setOpsCoverageAlertLookaheadHours] = useState('72')
  const [opsCoverageAlertMinOpenSlots, setOpsCoverageAlertMinOpenSlots] = useState('1')
  const [opsCoverageAlertLastSentAt, setOpsCoverageAlertLastSentAt] = useState(null)
  const [opsReliabilityAlertEnabled, setOpsReliabilityAlertEnabled] = useState(true)
  const [opsReliabilityAlertThresholdPct, setOpsReliabilityAlertThresholdPct] = useState('30')
  const [opsReliabilityAlertLastSentAt, setOpsReliabilityAlertLastSentAt] = useState(null)
  const [opsWeeklyDigestEnabled, setOpsWeeklyDigestEnabled] = useState(true)
  const [opsWeeklyDigestLastSentAt, setOpsWeeklyDigestLastSentAt] = useState(null)

  const [opsAlerts, setOpsAlerts] = useState([])
  const [opsAlertsLoading, setOpsAlertsLoading] = useState(false)
  const [opsAlertsError, setOpsAlertsError] = useState(null)
  const [opsAlertResolvingId, setOpsAlertResolvingId] = useState(null)

  // Ops: coverage (next N days)
  const [opsCoverageDays, setOpsCoverageDays] = useState('14')
  const [opsCoverageOnlyUnfilled, setOpsCoverageOnlyUnfilled] = useState(true)
  const [opsCoverage, setOpsCoverage] = useState([]) // rows from /shifts/coverage
  const [opsCoverageLoading, setOpsCoverageLoading] = useState(false)
  const [opsCoverageError, setOpsCoverageError] = useState(null)
  const [opsCoverageBusyKey, setOpsCoverageBusyKey] = useState(null)
  const [opsCoverageBulk, setOpsCoverageBulk] = useState(null) // { total, done, invited, failed }

  // Ops: calendar (next N days)
  const [opsCalDays, setOpsCalDays] = useState('14')
  const [opsCalOnlyUnfilled, setOpsCalOnlyUnfilled] = useState(false)
  const [opsCalItems, setOpsCalItems] = useState([])
  const [opsCalLoading, setOpsCalLoading] = useState(false)
  const [opsCalError, setOpsCalError] = useState(null)
  const [opsCalBusyKey, setOpsCalBusyKey] = useState(null)
  const [opsCalBulk, setOpsCalBulk] = useState(null) // { total, done, invited, failed }

  // Ops: shared filters (Coverage + Calendar)
  const [opsShiftFilterText, setOpsShiftFilterText] = useState('')
  const [opsShiftFilterRole, setOpsShiftFilterRole] = useState('')
  const [opsShiftFilterLocation, setOpsShiftFilterLocation] = useState('')

  const [invites, setInvites] = useState([])
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [invitesError, setInvitesError] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('ops')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [lastInviteUrl, setLastInviteUrl] = useState('')

  const companyReady = useMemo(() => Boolean(company?.id), [company?.id])
  const isWorkspaceMember = useMemo(() => Boolean(access?.company_id), [access?.company_id])
  const accessRole = useMemo(() => (access?.workspace_role ? String(access.workspace_role) : null), [access?.workspace_role])
  const myWorkspaceRole = useMemo(() => {
    // Prefer server-provided access role, fallback to member list once loaded.
    if (accessRole) return accessRole
    const me = user?.id ? String(user.id) : ''
    if (!me) return null
    const m = (Array.isArray(members) ? members : []).find((x) => x?.id && String(x.id) === me)
    return m?.workspace_role ? String(m.workspace_role) : null
  }, [accessRole, members, user?.id])
  const canInviteMembers = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops'
  const canEditMemberRoles = myWorkspaceRole === 'owner'
  const canEditCompanyProfile = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops' || myWorkspaceRole === 'hr'
  const canUseHiring = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops' || myWorkspaceRole === 'hr'
  const canUseStaff = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops' || myWorkspaceRole === 'hr'
  const canUseOps = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops' || myWorkspaceRole === 'supervisor'
  const canManageRecurring = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops'
  const canUsePayroll = myWorkspaceRole === 'owner' || myWorkspaceRole === 'finance'
  const canUseInsights = Boolean(myWorkspaceRole) || (user?.role === 'company' && !companyReady)
  const canManageDepartments = ['owner', 'ops', 'hr', 'finance'].includes(String(myWorkspaceRole || ''))
  const canManageBudgets = ['owner', 'ops', 'finance'].includes(String(myWorkspaceRole || ''))
  const canViewDepartments = canManageDepartments || myWorkspaceRole === 'auditor'
  const canSetWorkerPreferred = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops' || myWorkspaceRole === 'hr' || myWorkspaceRole === 'supervisor'
  const canSetWorkerBlocked = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops'
  const canSaveOpsSettings = myWorkspaceRole === 'owner' || myWorkspaceRole === 'ops'

  const allowedTabs = useMemo(() => new Set(['profile', 'hiring', 'staff', 'ops', 'payroll', 'insights']), [])

  function setTabInUrl(nextTab, { replace } = {}) {
    const t = String(nextTab || '').trim().toLowerCase()
    if (!allowedTabs.has(t)) return
    setTab(t)
    const next = new URLSearchParams(searchParams)
    next.set('tab', t)
    setSearchParams(next, { replace: Boolean(replace) })
  }

  useEffect(() => {
    const t = String(searchParams.get('tab') || '').trim().toLowerCase()
    if (t && allowedTabs.has(t)) {
      if (t !== tab) setTab(t)
      return
    }
    // Default to hiring, but write it into the URL (so refresh/share keeps your place)
    if (!t) setTabInUrl('hiring', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    if (tab !== 'ops') return
    const q = String(searchParams.get('ops_q') || '')
    const loc = String(searchParams.get('ops_loc') || '')
    const role = String(searchParams.get('ops_role') || '')
    const covDays = String(searchParams.get('ops_cov_days') || '')
    const covUnfilled = String(searchParams.get('ops_cov_unfilled') || '')
    const calDays = String(searchParams.get('ops_cal_days') || '')
    const calUnfilled = String(searchParams.get('ops_cal_unfilled') || '')
    const pool = String(searchParams.get('ops_pool') || '')

    if (q !== opsShiftFilterText) setOpsShiftFilterText(q)
    if (loc !== opsShiftFilterLocation) setOpsShiftFilterLocation(loc)
    if (role !== opsShiftFilterRole) setOpsShiftFilterRole(role)

    if (covDays && covDays !== opsCoverageDays) setOpsCoverageDays(covDays)
    if (covUnfilled) {
      const b = covUnfilled === '1' || covUnfilled === 'true'
      if (b !== Boolean(opsCoverageOnlyUnfilled)) setOpsCoverageOnlyUnfilled(b)
    }
    if (calDays && calDays !== opsCalDays) setOpsCalDays(calDays)
    if (calUnfilled) {
      const b = calUnfilled === '1' || calUnfilled === 'true'
      if (b !== Boolean(opsCalOnlyUnfilled)) setOpsCalOnlyUnfilled(b)
    }
    if (pool && pool !== selectedListId) setSelectedListId(pool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchParams])

  useEffect(() => {
    if (tab !== 'ops') return
    const t = setTimeout(() => {
      const q = String(opsShiftFilterText || '').trim()
      const loc = String(opsShiftFilterLocation || '').trim()
      const role = String(opsShiftFilterRole || '').trim()
      const covDays = String(opsCoverageDays || '14').trim()
      const covUnfilled = opsCoverageOnlyUnfilled ? '1' : '0'
      const calDays = String(opsCalDays || '14').trim()
      const calUnfilled = opsCalOnlyUnfilled ? '1' : '0'
      const pool = String(selectedListId || '').trim()

      const curQ = String(searchParams.get('ops_q') || '')
      const curLoc = String(searchParams.get('ops_loc') || '')
      const curRole = String(searchParams.get('ops_role') || '')
      const curCovDays = String(searchParams.get('ops_cov_days') || '')
      const curCovUnfilled = String(searchParams.get('ops_cov_unfilled') || '')
      const curCalDays = String(searchParams.get('ops_cal_days') || '')
      const curCalUnfilled = String(searchParams.get('ops_cal_unfilled') || '')
      const curPool = String(searchParams.get('ops_pool') || '')

      if (
        curQ === q &&
        curLoc === loc &&
        curRole === role &&
        curCovDays === covDays &&
        curCovUnfilled === covUnfilled &&
        curCalDays === calDays &&
        curCalUnfilled === calUnfilled &&
        curPool === pool
      ) {
        return
      }

      const next = new URLSearchParams(searchParams)
      if (q) next.set('ops_q', q)
      else next.delete('ops_q')
      if (loc) next.set('ops_loc', loc)
      else next.delete('ops_loc')
      if (role) next.set('ops_role', role)
      else next.delete('ops_role')

      next.set('ops_cov_days', covDays)
      next.set('ops_cov_unfilled', covUnfilled)
      next.set('ops_cal_days', calDays)
      next.set('ops_cal_unfilled', calUnfilled)

      if (pool) next.set('ops_pool', pool)
      else next.delete('ops_pool')

      setSearchParams(next, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [
    tab,
    searchParams,
    opsShiftFilterText,
    opsShiftFilterLocation,
    opsShiftFilterRole,
    opsCoverageDays,
    opsCoverageOnlyUnfilled,
    opsCalDays,
    opsCalOnlyUnfilled,
    selectedListId,
    setSearchParams,
  ])

  useEffect(() => {
    // Reload company data when switching company_id in URL.
    if (!companyIdFromUrl) return
    // Clear company-scoped state to avoid showing stale data during switch.
    setCompany(null)
    setJobs([])
    setSelectedJobId(null)
    setApplications([])
    setAppsError(null)
    setWorkerLists([])
    setSelectedListId('')
    setWorkers([])
    setWorkersError(null)
    setShifts([])
    setSelectedShiftId('')
    setShiftDetail(null)
    setWorkforceOverview(null)
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyIdFromUrl])

  function setCompanyInUrl(nextCompanyId, { replace } = {}) {
    const id = String(nextCompanyId || '').trim()
    if (!id) return
    const next = new URLSearchParams(searchParams)
    next.set('company_id', id)
    setSearchParams(next, { replace: Boolean(replace) })
  }

  async function loadMyCompanies() {
    setMyCompaniesLoading(true)
    setMyCompaniesError(null)
    try {
      const r = await http.get('/corporate/companies/mine')
      setMyCompanies(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setMyCompaniesError(e?.response?.data?.message ?? e?.message ?? 'Failed to load companies')
      setMyCompanies([])
    } finally {
      setMyCompaniesLoading(false)
    }
  }

  useEffect(() => {
    loadMyCompanies().catch(() => {})
  }, [])

  useEffect(() => {
    if (companyIdFromUrl) return
    if (myCompaniesLoading) return
    const first = Array.isArray(myCompanies) ? myCompanies[0] : null
    if (first?.id) setCompanyInUrl(first.id, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyIdFromUrl, myCompaniesLoading, myCompanies])

  const companyDraftKey = useMemo(() => `draft:company:profile:${user?.id ?? 'unknown'}`, [user?.id])
  const companyDraft = useDraftAutosave({
    key: companyDraftKey,
    data: { name, industry, sizeRange, website, location, description, logoUrl, coverUrl, saved_at: Date.now() },
    enabled: true,
    debounceMs: 750,
  })

  const jobDraftKey = useMemo(() => `draft:company:post_job:${user?.id ?? 'unknown'}`, [user?.id])
  const jobDraft = useDraftAutosave({
    key: jobDraftKey,
    data: {
      jobTitle,
      jobLocation,
      jobType,
      jobMode,
      jobPayMin,
      jobPayMax,
      jobPayPeriod,
      jobTerm,
      jobScheduleText,
      jobBenefits,
      jobTags,
      jobDesc,
      saved_at: Date.now(),
    },
    enabled: true,
    debounceMs: 750,
  })

  const LOAD_ALL_TIMEOUT_MS = 20000

  async function loadAll() {
    setLoading(true)
    setError(null)
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setError('Request timed out. Check your connection and try again.')
    }, LOAD_ALL_TIMEOUT_MS)
    try {
      const a = await http.get('/corporate/company/access', { params: withCompanyParams() }).catch(() => ({ data: null }))
      setAccess(a.data ?? null)

      const [cRes, profRes] = await Promise.all([
        http.get('/corporate/company/me', { params: withCompanyParams() }).catch(() => ({ data: null })),
        http.get('/profile/me').catch(() => ({ data: null })),
      ])
      setCompany(cRes.data ?? null)
      const prof = profRes?.data?.profile
      const links = Array.isArray(prof?.links) ? prof.links : []
      setProfileLinks(links.length ? links : [{ label: 'Website', url: '' }])
      setPrivateProfile(Boolean(prof?.private_profile))

      const canLoadJobs = ['owner', 'ops', 'hr'].includes(String(a.data?.workspace_role || ''))
      if (canLoadJobs) {
        const j = await http.get('/corporate/company/jobs', { params: withCompanyParams() }).catch(() => ({ data: [] }))
        setJobs(Array.isArray(j.data) ? j.data : [])
      } else {
        setJobs([])
      }

      const c0 = cRes.data
      if (c0) {
        setName(c0.name ?? '')
        setIndustry(c0.industry ?? '')
        setSizeRange(c0.size_range ?? '1-10')
        setWebsite(c0.website ?? '')
        setLocation(c0.location ?? '')
        setDescription(c0.description ?? '')
        setLogoUrl(c0.logo_url ?? '')
        setCoverUrl(c0.cover_url ?? '')
      }
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load corporate dashboard')
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  async function loadWorkforceOverview() {
    if (!companyReady) return
    setWorkforceLoading(true)
    setWorkforceError(null)
    try {
      const r = await http.get('/corporate/company/workforce/overview', { params: withCompanyParams({ days: 30 }) })
      setWorkforceOverview(r.data ?? null)
    } catch (e) {
      setWorkforceError(e?.response?.data?.message ?? e?.message ?? 'Failed to load workforce overview')
      setWorkforceOverview(null)
    } finally {
      setWorkforceLoading(false)
    }
  }

  async function loadWorkerLists() {
    setWorkerListsLoading(true)
    setWorkerListsError(null)
    try {
      const r = await http.get('/corporate/company/worker-lists', { params: withCompanyParams() })
      const list = Array.isArray(r.data) ? r.data : []
      setWorkerLists(list)
      if (!selectedListId && list[0]?.id) setSelectedListId(list[0].id)
    } catch (e) {
      setWorkerListsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load worker lists')
      setWorkerLists([])
    } finally {
      setWorkerListsLoading(false)
    }
  }

  async function loadWorkers(listId) {
    const lid = String(listId || '')
    if (!lid) {
      setWorkers([])
      return
    }
    setWorkersLoading(true)
    setWorkersError(null)
    try {
      const r = await http.get('/corporate/company/workers', { params: withCompanyParams({ list_id: lid }) })
      const rows = Array.isArray(r.data) ? r.data : []
      setWorkers(rows)
      // Seed note drafts (so editing doesn't require typing from scratch)
      setNoteDraftByUserId((prev) => {
        const next = { ...(prev || {}) }
        for (const w of rows) {
          if (!w?.id) continue
          if (!next[w.id]) next[w.id] = { rating: w.rating ?? null, notes: w.notes ?? '', preferred: !!w.preferred, blocked: !!w.blocked }
        }
        return next
      })
    } catch (e) {
      setWorkersError(e?.response?.data?.message ?? e?.message ?? 'Failed to load workers')
      setWorkers([])
    } finally {
      setWorkersLoading(false)
    }
  }

  async function loadShifts() {
    setShiftsLoading(true)
    setShiftsError(null)
    try {
      const r = await http.get('/corporate/company/shifts', { params: withCompanyParams() })
      setShifts(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setShiftsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load shifts')
      setShifts([])
    } finally {
      setShiftsLoading(false)
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const r = await http.get('/corporate/company/shift-templates', { params: withCompanyParams() })
      setTemplates(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setTemplatesError(e?.response?.data?.message ?? e?.message ?? 'Failed to load templates')
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }

  async function loadSeries() {
    setSeriesLoading(true)
    setSeriesError(null)
    try {
      const r = await http.get('/corporate/company/shift-series', { params: withCompanyParams() })
      setSeries(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setSeriesError(e?.response?.data?.message ?? e?.message ?? 'Failed to load series')
      setSeries([])
    } finally {
      setSeriesLoading(false)
    }
  }

  async function createTemplate(e) {
    e.preventDefault()
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    if (!tplName.trim() || !tplTitle.trim()) return toast.warning('Missing fields', 'Template name and title are required.')
    setTplBusy(true)
    try {
      const payload = {
        name: tplName.trim(),
        title: tplTitle.trim(),
        role_tag: tplRoleTag.trim() || null,
        location: tplLocation.trim() || null,
        headcount: tplHeadcount ? Number(tplHeadcount) : 1,
        checkin_geo_required: !!tplGeoRequired,
        checkin_geo_radius_m: tplGeoRequired ? (tplGeoRadiusM ? Number(tplGeoRadiusM) : null) : null,
        checkin_geo_lat: tplGeoRequired ? (tplGeoLat ? Number(tplGeoLat) : null) : null,
        checkin_geo_lng: tplGeoRequired ? (tplGeoLng ? Number(tplGeoLng) : null) : null,
      }
      await http.post('/corporate/company/shift-templates', payload, { params: withCompanyParams() })
      toast.success('Template created.')
      setTplName('')
      setTplTitle('')
      setTplRoleTag('')
      setTplLocation('')
      setTplHeadcount('1')
      setTplGeoRequired(false)
      setTplGeoRadiusM('250')
      setTplGeoLat('')
      setTplGeoLng('')
      await loadTemplates()
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to create template')
    } finally {
      setTplBusy(false)
    }
  }

  function selectedSeriesDaysArray() {
    return Object.entries(seriesDaysOfWeek || {})
      .filter(([, v]) => !!v)
      .map(([k]) => Number(k))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
  }

  async function createSeries(e) {
    e.preventDefault()
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    const days = selectedSeriesDaysArray()
    if (!seriesTemplateId) return toast.warning('Pick a template first.')
    if (!seriesStartDate) return toast.warning('Pick a start date.')
    if (!seriesStartTime || !seriesEndTime) return toast.warning('Pick start/end time.')
    if (days.length === 0) return toast.warning('Pick at least one day of week.')
    setSeriesBusy(true)
    try {
      const payload = {
        template_id: seriesTemplateId,
        interval_weeks: seriesIntervalWeeks ? Number(seriesIntervalWeeks) : 1,
        days_of_week: days,
        start_date: seriesStartDate,
        end_date: seriesEndDate || null,
        start_time: seriesStartTime,
        end_time: seriesEndTime,
        status: 'active',
        auto_fill_list_id: seriesAutoFillEnabled && seriesAutoFillListId ? seriesAutoFillListId : null,
        auto_fill_mode: seriesAutoFillEnabled ? seriesAutoFillMode : 'headcount',
        auto_fill_count: seriesAutoFillEnabled && seriesAutoFillMode === 'count' ? (seriesAutoFillCount ? Number(seriesAutoFillCount) : 1) : null,
        auto_generate_enabled: !!seriesAutoGenerateEnabled,
        auto_generate_days: seriesAutoGenerateEnabled ? (seriesAutoGenerateDays ? Number(seriesAutoGenerateDays) : 14) : 14,
      }
      if (editingSeriesId) {
        await http.put(`/corporate/company/shift-series/${encodeURIComponent(editingSeriesId)}`, payload, { params: withCompanyParams() })
        toast.success('Series updated.')
      } else {
        await http.post('/corporate/company/shift-series', payload, { params: withCompanyParams() })
        toast.success('Series created.')
      }
      setSeriesStartDate('')
      setSeriesEndDate('')
      setEditingSeriesId('')
      await loadSeries()
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to create series')
    } finally {
      setSeriesBusy(false)
    }
  }

  async function loadSeriesPreview(seriesId, days = 14) {
    const sid = String(seriesId || '').trim()
    if (!sid) return
    setSeriesPreviewLoading(true)
    setSeriesPreviewError(null)
    try {
      const r = await http.get(`/corporate/company/shift-series/${encodeURIComponent(sid)}/preview`, { params: withCompanyParams({ days }) })
      setSeriesPreview(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setSeriesPreviewError(e?.response?.data?.message ?? e?.message ?? 'Failed to load preview')
      setSeriesPreview([])
    } finally {
      setSeriesPreviewLoading(false)
    }
  }

  function startEditingSeries(s) {
    if (!s?.id) return
    setEditingSeriesId(String(s.id))
    setSeriesTemplateId(String(s.template_id || ''))
    setSeriesIntervalWeeks(String(s.interval_weeks ?? 1))
    const dow = Array.isArray(s.days_of_week) ? s.days_of_week : []
    const map = {}
    for (const n of dow) map[Number(n)] = true
    setSeriesDaysOfWeek(map)
    setSeriesStartDate(String(s.start_date || ''))
    setSeriesEndDate(String(s.end_date || ''))
    setSeriesStartTime(String(s.start_time || '09:00').slice(0, 5))
    setSeriesEndTime(String(s.end_time || '17:00').slice(0, 5))
    const hasAutoFill = Boolean(s.auto_fill_list_id)
    setSeriesAutoFillEnabled(hasAutoFill)
    setSeriesAutoFillListId(hasAutoFill ? String(s.auto_fill_list_id) : '')
    setSeriesAutoFillMode(String(s.auto_fill_mode || 'headcount'))
    setSeriesAutoFillCount(String(s.auto_fill_count ?? 1))
    setSeriesAutoGenerateEnabled(Boolean(s.auto_generate_enabled))
    setSeriesAutoGenerateDays(String(s.auto_generate_days ?? 14))
    setSeriesPreview([])
    setSeriesPreviewError(null)
    loadSeriesPreview(s.id, 14).catch(() => {})
  }

  async function toggleSeriesStatus(s) {
    if (!s?.id) return
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    const next = String(s.status || 'active') === 'active' ? 'paused' : 'active'
    setSeriesBusy(true)
    try {
      const payload = {
        template_id: s.template_id,
        status: next,
        interval_weeks: Number(s.interval_weeks ?? 1),
        days_of_week: Array.isArray(s.days_of_week) ? s.days_of_week : [],
        start_date: String(s.start_date),
        end_date: s.end_date ?? null,
        start_time: String(s.start_time),
        end_time: String(s.end_time),
        auto_fill_list_id: s.auto_fill_list_id ?? null,
        auto_fill_mode: s.auto_fill_mode ?? 'headcount',
        auto_fill_count: s.auto_fill_mode === 'count' ? (s.auto_fill_count ?? 1) : null,
        auto_generate_enabled: Boolean(s.auto_generate_enabled ?? false),
        auto_generate_days: Number(s.auto_generate_days ?? 14),
      }
      await http.put(`/corporate/company/shift-series/${encodeURIComponent(String(s.id))}`, payload, { params: withCompanyParams() })
      toast.success('Updated', next === 'paused' ? 'Series paused.' : 'Series resumed.')
      await loadSeries()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update series')
    } finally {
      setSeriesBusy(false)
    }
  }

  async function generateSeries(seriesId, days = 60) {
    const sid = String(seriesId || '').trim()
    if (!sid) return
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    setSeriesBusy(true)
    try {
      const r = await http.post(`/corporate/company/shift-series/${encodeURIComponent(sid)}/generate`, { days }, { params: withCompanyParams() })
      const inserted = Number(r.data?.inserted_count ?? 0)
      const invited = Number(r.data?.invited_count ?? 0)
      toast.success('Generated', invited > 0 ? `Created ${inserted} shift(s) and invited ${invited} worker(s).` : `Created ${inserted} shift(s).`)
      await loadShifts()
      await loadSeries()
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to generate')
    } finally {
      setSeriesBusy(false)
    }
  }

  async function skipSeriesDate(e) {
    e.preventDefault()
    if (!skipSeriesId || !skipDate) return toast.warning('Pick series and date to skip.')
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    setSeriesBusy(true)
    try {
      await http.post(
        `/corporate/company/shift-series/${encodeURIComponent(skipSeriesId)}/skip`,
        { on_date: skipDate },
        { params: withCompanyParams() },
      )
      toast.success('Saved', 'That date will be skipped.')
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to skip date')
    } finally {
      setSeriesBusy(false)
    }
  }

  async function loadShiftDetail(id) {
    const sid = String(id || '')
    if (!sid) return
    setShiftDetailLoading(true)
    try {
      const r = await http.get(`/corporate/company/shifts/${encodeURIComponent(sid)}`, { params: withCompanyParams() })
      setShiftDetail(r.data ?? null)
      const base = r.data?.shift ?? null
      if (base) {
        setShiftEditTitle(String(base.title ?? ''))
        setShiftEditRoleTag(String(base.role_tag ?? ''))
        setShiftEditLocation(String(base.location ?? ''))
        setShiftEditDepartmentId(base.department_id ?? '')
        setShiftEditStartAt(base.start_at ? new Date(base.start_at).toISOString().slice(0, 16) : '')
        setShiftEditEndAt(base.end_at ? new Date(base.end_at).toISOString().slice(0, 16) : '')
        setShiftEditHeadcount(String(base.headcount ?? 1))
      }
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to load shift detail')
      setShiftDetail(null)
    } finally {
      setShiftDetailLoading(false)
    }
  }

  async function saveShiftEdits() {
    const sid = String(shiftDetail?.shift?.id ?? '').trim()
    if (!sid) return
    if (!online) return toast.warning('Offline', 'Reconnect to save.')
    setShiftBusy(true)
    try {
      const payload = {
        title: shiftEditTitle.trim(),
        role_tag: shiftEditRoleTag.trim() || null,
        location: shiftEditLocation.trim() || null,
        department_id: shiftEditDepartmentId.trim() || null,
        start_at: shiftEditStartAt ? new Date(shiftEditStartAt).toISOString() : undefined,
        end_at: shiftEditEndAt ? new Date(shiftEditEndAt).toISOString() : undefined,
        headcount: shiftEditHeadcount ? Number(shiftEditHeadcount) : undefined,
      }
      const r = await http.put(`/corporate/company/shifts/${encodeURIComponent(sid)}`, payload, { params: withCompanyParams() })
      setShiftDetail(r.data ?? null)
      toast.success('Shift updated.')
      loadOpsCoverage().catch(() => {})
      loadOpsCalendar().catch(() => {})
      loadShifts().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update shift')
    } finally {
      setShiftBusy(false)
    }
  }

  async function cancelShift() {
    const sid = String(shiftDetail?.shift?.id ?? '').trim()
    if (!sid) return
    const ok = window.confirm('Cancel this shift? This will cancel outstanding invites/acceptances.')
    if (!ok) return
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    setShiftBusy(true)
    try {
      const r = await http.put(`/corporate/company/shifts/${encodeURIComponent(sid)}`, { status: 'cancelled' }, { params: withCompanyParams() })
      setShiftDetail(r.data ?? null)
      toast.success('Shift cancelled.')
      loadOpsCoverage().catch(() => {})
      loadOpsCalendar().catch(() => {})
      loadShifts().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to cancel shift')
    } finally {
      setShiftBusy(false)
    }
  }

  async function loadPayroll() {
    if (!companyReady) return
    setPayrollLoading(true)
    setPayrollError(null)
    try {
      const [s, e] = await Promise.all([
        http.get('/corporate/company/payroll/settings', { params: withCompanyParams() }),
        http.get('/corporate/company/payroll/employees', { params: withCompanyParams() }),
      ])
      const settings = s.data ?? null
      const employees = Array.isArray(e.data) ? e.data : []
      setPayrollSettings(settings)
      setPayrollEmployees(employees)
      setPsCurrency(String(settings?.currency ?? 'GHS'))
      setPsTaxPct(String(settings?.tax_rate_pct ?? 0))
      setPsNiPct(String(settings?.ni_rate_pct ?? 0))
      setPsPensionPct(String(settings?.pension_rate_pct ?? 0))
    } catch (err) {
      setPayrollError(err?.response?.data?.message ?? err?.message ?? 'Failed to load payroll')
      setPayrollSettings(null)
      setPayrollEmployees([])
    } finally {
      setPayrollLoading(false)
    }
  }

  useEffect(() => {
    if (!companyReady) return
    if (tab !== 'payroll') return
    loadPayroll().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyReady, tab])

  function withCompanyParams(params) {
    const out = { ...(params || {}) }
    if (companyIdFromUrl) out.company_id = companyIdFromUrl
    if (companySlugFromUrl && !out.company_slug) out.company_slug = companySlugFromUrl
    return out
  }

  function withCompanyId(url) {
    const cid = companyIdFromUrl
    if (!cid) return url
    try {
      const u = new URL(url, window.location.origin)
      if (!u.searchParams.get('company_id')) u.searchParams.set('company_id', cid)
      return u.pathname + u.search
    } catch {
      if (url.includes('company_id=')) return url
      return url + (url.includes('?') ? '&' : '?') + `company_id=${encodeURIComponent(cid)}`
    }
  }

  async function downloadAuthedCsv(url, filename) {
    const key = String(filename || url || 'download')
    setDownloadBusyKey(key)
    try {
      const r = await http.get(withCompanyId(url), { responseType: 'blob' })
      const blob = new Blob([r.data], { type: 'text/csv;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = String(filename || 'export.csv')
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Download failed')
    } finally {
      setDownloadBusyKey(null)
    }
  }

  function csvCell(v) {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }

  async function copyCurrentLink() {
    try {
      const href = window.location?.href ? String(window.location.href) : ''
      if (!href) throw new Error('Missing URL')
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(href)
        toast.success('Link copied.')
        return
      }
      // Fallback: prompt (still lets user copy)
      window.prompt('Copy this link', href)
    } catch (e) {
      toast.error(e?.message ?? 'Failed to copy link')
    }
  }

  async function exportOpsFilteredShiftsCsv() {
    const key = 'ops-shifts-filtered.csv'
    if (downloadBusyKey === key) return
    setDownloadBusyKey(key)
    try {
      const byId = new Map()
      for (const s of Array.isArray(opsCoverageFiltered) ? opsCoverageFiltered : []) {
        if (s?.id) byId.set(String(s.id), s)
      }
      for (const s of Array.isArray(opsCalFiltered) ? opsCalFiltered : []) {
        if (s?.id) byId.set(String(s.id), s)
      }
      const rows = Array.from(byId.values()).sort((a, b) => new Date(a?.start_at || 0).getTime() - new Date(b?.start_at || 0).getTime())
      if (rows.length === 0) return toast.warning('Nothing to export', 'No shifts match the current filters.')

      const header = [
        'id',
        'title',
        'role_tag',
        'location',
        'start_at',
        'end_at',
        'headcount',
        'active_count',
        'open_slots',
        'invited',
        'accepted',
        'no_shows',
        'autopilot_off',
      ]
      const lines = [header.join(',')]
      for (const s of rows) {
        lines.push(
          [
            csvCell(s?.id),
            csvCell(s?.title),
            csvCell(s?.role_tag),
            csvCell(s?.location),
            csvCell(s?.start_at),
            csvCell(s?.end_at),
            csvCell(s?.headcount),
            csvCell(s?.active_count),
            csvCell(s?.open_slots),
            csvCell(s?.invited),
            csvCell(s?.accepted),
            csvCell(s?.no_shows),
            csvCell(s?.coverage_auto_fill_disabled ? '1' : '0'),
          ].join(','),
        )
      }
      const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = key
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export ready', `Downloaded ${rows.length} shift(s).`)
    } catch (e) {
      toast.error(e?.message ?? 'Failed to export CSV')
    } finally {
      setDownloadBusyKey(null)
    }
  }

  async function loadMembers() {
    if (!companyReady) return
    setMembersLoading(true)
    setMembersError(null)
    try {
      const r = await http.get('/corporate/company/members', { params: withCompanyParams() })
      const items = Array.isArray(r.data?.items) ? r.data.items : []
      setMembers(items)
    } catch (e) {
      setMembersError(e?.response?.data?.message ?? e?.message ?? 'Failed to load members')
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }

  async function addMember() {
    if (!companyReady) return toast.warning('Create your company profile first.')
    const email = String(memberEmail || '').trim()
    const userId = String(memberUserId || '').trim()
    if (!email && !userId) return toast.warning('Add a member', 'Provide an email or user ID.')
    setMemberBusy(true)
    try {
      const payload = { workspace_role: memberWorkspaceRole, email: email || null, user_id: userId || null }
      await http.post('/corporate/company/members', payload, { params: withCompanyParams() })
      setMemberEmail('')
      setMemberUserId('')
      await loadMembers()
      toast.success('Member added.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to add member')
    } finally {
      setMemberBusy(false)
    }
  }

  async function updateMemberRole(userId, role) {
    if (!companyReady) return
    setMemberBusy(true)
    try {
      await http.put(`/corporate/company/members/${encodeURIComponent(String(userId))}`, { workspace_role: role }, { params: withCompanyParams() })
      await loadMembers()
      toast.success('Role updated.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update role')
    } finally {
      setMemberBusy(false)
    }
  }

  async function removeMember(userId) {
    if (!companyReady) return
    const ok = window.confirm('Remove this team member from the workspace?')
    if (!ok) return
    setMemberBusy(true)
    try {
      await http.delete(`/corporate/company/members/${encodeURIComponent(String(userId))}`, { params: withCompanyParams() })
      await loadMembers()
      toast.success('Member removed.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to remove member')
    } finally {
      setMemberBusy(false)
    }
  }

  async function loadInvites() {
    if (!companyReady) return
    setInvitesLoading(true)
    setInvitesError(null)
    try {
      const r = await http.get('/corporate/company/invites', { params: withCompanyParams() })
      const items = Array.isArray(r.data?.items) ? r.data.items : []
      setInvites(items)
    } catch (e) {
      setInvitesError(e?.response?.data?.message ?? e?.message ?? 'Failed to load invites')
      setInvites([])
    } finally {
      setInvitesLoading(false)
    }
  }

  async function createInvite() {
    if (!companyReady) return toast.warning('Create your company profile first.')
    if (!inviteEmail.trim()) return toast.warning('Enter an email to invite.')
    setInviteBusy(true)
    try {
      const payload = { email: inviteEmail.trim(), workspace_role: inviteRole }
      const r = await http.post('/corporate/company/invites', payload, { params: withCompanyParams() })
      const claimUrl = r.data?.claim_url ? String(r.data.claim_url) : ''
      setLastInviteUrl(claimUrl || '')
      if (claimUrl) {
        try {
          await navigator.clipboard.writeText(claimUrl)
          toast.success('Invite created', 'Link copied to clipboard.')
        } catch {
          toast.success('Invite created', 'Copy the link shown below.')
        }
      } else {
        toast.success('Invite created')
      }
      setInviteEmail('')
      await loadInvites()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to create invite')
    } finally {
      setInviteBusy(false)
    }
  }

  async function revokeInvite(id) {
    const ok = window.confirm('Revoke this invite?')
    if (!ok) return
    setInviteBusy(true)
    try {
      await http.post(`/corporate/company/invites/${encodeURIComponent(String(id))}/revoke`, null, { params: withCompanyParams() })
      toast.success('Invite revoked')
      await loadInvites()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to revoke invite')
    } finally {
      setInviteBusy(false)
    }
  }

  async function loadAudit({ reset } = {}) {
    if (!companyReady) return
    setAuditLoading(true)
    setAuditError(null)
    try {
      const before = reset ? null : auditBefore
      const r = await http.get('/corporate/company/audit', { params: withCompanyParams({ limit: 50, before }) })
      const items = Array.isArray(r.data?.items) ? r.data.items : []
      const nextBefore = r.data?.next_before ?? null
      if (reset) setAuditItems(items)
      else setAuditItems((prev) => [...(Array.isArray(prev) ? prev : []), ...items])
      setAuditBefore(nextBefore)
      setAuditHasMore(Boolean(nextBefore && items.length > 0))
    } catch (e) {
      setAuditError(e?.response?.data?.message ?? e?.message ?? 'Failed to load audit log')
      if (reset) setAuditItems([])
      setAuditBefore(null)
      setAuditHasMore(false)
    } finally {
      setAuditLoading(false)
    }
  }

  async function loadCompanyAnalytics(daysOverride) {
    if (!companyReady) return
    const days = daysOverride != null ? Number(daysOverride) : Number(wfDays || 30)
    if (!Number.isFinite(days) || days <= 0) return
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const r = await http.get('/corporate/company/analytics', { params: withCompanyParams({ days }) })
      setAnalytics(r.data ?? null)
    } catch (e) {
      setAnalyticsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load analytics')
      setAnalytics(null)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  async function loadWorkforceInsights(daysOverride) {
    if (!companyReady) return
    const days = daysOverride != null ? Number(daysOverride) : Number(wfDays || 30)
    if (!Number.isFinite(days) || days <= 0) return
    setWfInsightsLoading(true)
    setWfInsightsError(null)
    try {
      const r = await http.get('/corporate/company/workforce/insights', { params: withCompanyParams({ days, limit: 10 }) })
      setWfInsights(r.data ?? null)
    } catch (e) {
      setWfInsightsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load workforce insights')
      setWfInsights(null)
    } finally {
      setWfInsightsLoading(false)
    }
  }

  useEffect(() => {
    if (wfPoolListId) return
    const first = (Array.isArray(workerLists) ? workerLists : [])[0]
    if (first?.id) setWfPoolListId(first.id)
  }, [wfPoolListId, workerLists])

  async function setWorkerPreferredFromInsights(workerUserId, nextPreferred) {
    const uid = String(workerUserId || '').trim()
    const p = Boolean(nextPreferred)
    if (!uid) return
    if (!online) return toast.warning('Offline', 'Reconnect to update worker settings.')
    if (!canSetWorkerPreferred) return toast.warning('Access', 'Your role cannot change preferred status.')
    setWfActionBusyKey(`preferred-${uid}`)
    try {
      await http.put(
        `/corporate/company/workers/${encodeURIComponent(uid)}/note`,
        { preferred: p, blocked: p ? false : null },
        { params: withCompanyParams() },
      )
      toast.success(p ? 'Marked preferred.' : 'Removed preferred.')
      await loadWorkforceInsights(Number(wfDays || 30))
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update worker')
    } finally {
      setWfActionBusyKey(null)
    }
  }

  async function setWorkerBlockedFromInsights(workerUserId, nextBlocked) {
    const uid = String(workerUserId || '').trim()
    const b = Boolean(nextBlocked)
    if (!uid) return
    if (!online) return toast.warning('Offline', 'Reconnect to update worker settings.')
    if (!canSetWorkerBlocked) return toast.warning('Access', 'Only owner/ops can block or unblock workers.')
    let reason = null
    if (b) {
      const r0 = window.prompt('Reason for blocking this worker? (Only owner/ops can block)', '')
      if (r0 == null) return
      const r1 = String(r0 || '').trim()
      if (r1.length < 3) {
        toast.warning('Reason required', 'Please enter at least 3 characters.')
        return
      }
      reason = r1
    }
    setWfActionBusyKey(`blocked-${uid}`)
    try {
      await http.put(
        `/corporate/company/workers/${encodeURIComponent(uid)}/note`,
        { blocked: b, preferred: b ? false : null, block_reason: reason },
        { params: withCompanyParams() },
      )
      toast.success(b ? 'Worker blocked.' : 'Worker unblocked.')
      await loadWorkforceInsights(Number(wfDays || 30))
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update worker')
    } finally {
      setWfActionBusyKey(null)
    }
  }

  async function addWorkerToPoolFromInsights(workerUserId) {
    const uid = String(workerUserId || '').trim()
    const lid = String(wfPoolListId || '').trim()
    if (!uid) return
    if (!lid) return toast.warning('Pick a pool', 'Choose a pool first.')
    if (!online) return toast.warning('Offline', 'Reconnect to add workers.')
    if (!(canUseOps || canUseStaff)) return toast.warning('Access', 'Your role cannot edit worker pools.')
    setWfActionBusyKey(`pool-${uid}`)
    try {
      await http.post(
        `/corporate/company/worker-lists/${encodeURIComponent(lid)}/members`,
        { worker_user_id: uid, source: 'insights', source_id: null },
        { params: withCompanyParams() },
      )
      toast.success('Added to pool.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to add to pool')
    } finally {
      setWfActionBusyKey(null)
    }
  }

  async function openWorkerHistoryModal(workerUserId) {
    const uid = String(workerUserId || '').trim()
    if (!uid) return
    setWfWorkerId(uid)
    setWfWorkerModalOpen(true)
    await loadWorkerHistory(uid)
  }

  async function loadWorkerHistory(workerUserId, { days, limit } = {}) {
    const uid = String(workerUserId || '').trim()
    if (!uid) return
    if (!companyReady) return
    setWfWorkerHistoryLoading(true)
    setWfWorkerHistoryError(null)
    try {
      const d0 = days != null ? Number(days) : Math.max(30, Math.min(365, Number(wfDays || 90)))
      const l0 = limit != null ? Number(limit) : 50
      const r = await http.get(`/corporate/company/workers/${encodeURIComponent(uid)}/history`, { params: withCompanyParams({ days: d0, limit: l0 }) })
      setWfWorkerHistory(r.data ?? null)
    } catch (e) {
      setWfWorkerHistoryError(e?.response?.data?.message ?? e?.message ?? 'Failed to load worker history')
      setWfWorkerHistory(null)
    } finally {
      setWfWorkerHistoryLoading(false)
    }
  }

  async function modalPreferToggle() {
    const uid = String(wfWorkerId || '').trim()
    if (!uid) return
    const isPreferred = Boolean(wfWorkerHistory?.worker?.preferred)
    await setWorkerPreferredFromInsights(uid, !isPreferred)
    await loadWorkerHistory(uid).catch(() => {})
  }

  async function modalBlockToggle(nextBlocked) {
    const uid = String(wfWorkerId || '').trim()
    if (!uid) return
    await setWorkerBlockedFromInsights(uid, Boolean(nextBlocked))
    await loadWorkerHistory(uid).catch(() => {})
  }

  async function modalAddToPool() {
    const uid = String(wfWorkerId || '').trim()
    if (!uid) return
    await addWorkerToPoolFromInsights(uid)
  }

  async function loadDepartments() {
    if (!companyReady) return
    setDepartmentsLoading(true)
    setDepartmentsError(null)
    try {
      const r = await http.get('/corporate/company/departments', { params: withCompanyParams() })
      setDepartments(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setDepartmentsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load departments')
      setDepartments([])
    } finally {
      setDepartmentsLoading(false)
    }
  }

  async function loadBudgets() {
    if (!companyReady) return
    setBudgetsLoading(true)
    setBudgetsError(null)
    try {
      const r = await http.get('/corporate/company/budgets', { params: withCompanyParams() })
      setBudgets(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setBudgetsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load budgets')
      setBudgets([])
    } finally {
      setBudgetsLoading(false)
    }
  }

  async function saveDepartment() {
    if (!companyReady || !canManageDepartments) return
    const name = String(deptName || '').trim()
    if (!name) return toast.warning('Name required', 'Enter department name.')
    setDepartmentsBusy(true)
    try {
      if (editingDeptId) {
        await http.put(
          `/corporate/company/departments/${encodeURIComponent(editingDeptId)}`,
          { name, slug: deptSlug || null, location: deptLocation || null },
          { params: withCompanyParams() },
        )
        toast.success('Department updated.')
      } else {
        await http.post(
          '/corporate/company/departments',
          { name, slug: deptSlug || null, location: deptLocation || null },
          { params: withCompanyParams() },
        )
        toast.success('Department added.')
      }
      setDeptName('')
      setDeptSlug('')
      setDeptLocation('')
      setEditingDeptId(null)
      await loadDepartments()
      await loadCompanyAnalytics(Number(wfDays || 30))
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save')
    } finally {
      setDepartmentsBusy(false)
    }
  }

  async function deleteDepartment(id) {
    if (!companyReady || !canManageDepartments) return
    if (!window.confirm('Delete this department? Shifts linked to it will be unlinked.')) return
    setDepartmentsBusy(true)
    try {
      await http.delete(`/corporate/company/departments/${encodeURIComponent(id)}`, { params: withCompanyParams() })
      toast.success('Department removed.')
      await loadDepartments()
      await loadCompanyAnalytics(Number(wfDays || 30))
      setEditingDeptId(null)
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete')
    } finally {
      setDepartmentsBusy(false)
    }
  }

  async function saveBudget() {
    if (!companyReady || !canManageBudgets) return
    const limit = Number(budgetLimit)
    if (!Number.isFinite(limit) || limit < 0) return toast.warning('Limit required', 'Enter budget limit (GHS).')
    if (!editingBudgetId) {
      const start = String(budgetPeriodStart || '').trim()
      const end = String(budgetPeriodEnd || '').trim()
      if (!start || !end) return toast.warning('Period required', 'Enter period start and end.')
      if (end < start) return toast.warning('Invalid period', 'End must be >= start.')
    }
    setBudgetsBusy(true)
    try {
      if (editingBudgetId) {
        await http.put(
          `/corporate/company/budgets/${encodeURIComponent(editingBudgetId)}`,
          { spent_ghs: Number(budgetSpent) || 0, budget_limit_ghs: limit, notes: budgetNotes || null },
          { params: withCompanyParams() },
        )
        toast.success('Budget updated.')
        setEditingBudgetId(null)
      } else {
        await http.post(
          '/corporate/company/budgets',
          {
            department_id: budgetDeptId || null,
            period_start: start,
            period_end: end,
            budget_limit_ghs: limit,
            spent_ghs: Number(budgetSpent) || 0,
            notes: budgetNotes || null,
          },
          { params: withCompanyParams() },
        )
        toast.success('Budget added.')
      }
      setBudgetDeptId('')
      setBudgetPeriodStart('')
      setBudgetPeriodEnd('')
      setBudgetLimit('')
      setBudgetSpent('')
      setBudgetNotes('')
      await loadBudgets()
      await loadCompanyAnalytics(Number(wfDays || 30))
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save')
    } finally {
      setBudgetsBusy(false)
    }
  }

  async function syncBudgetFromPayroll(id) {
    if (!companyReady || !canManageBudgets) return
    setSyncBudgetBusyKey(id)
    try {
      const r = await http.post(`/corporate/company/budgets/${encodeURIComponent(id)}/sync-from-payroll`, {}, { params: withCompanyParams() })
      const updated = r.data ?? null
      if (updated) {
        setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, spent_ghs: updated.spent_ghs, utilisation_pct: Number(updated.budget_limit_ghs) > 0 ? Math.round((100 * Number(updated.spent_ghs ?? 0)) / Number(updated.budget_limit_ghs)) : 0 } : b)))
        toast.success(`Synced: ₵${Number(updated.spent_ghs ?? 0).toLocaleString()} from payroll.`)
      }
      await loadCompanyAnalytics(Number(wfDays || 30))
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to sync')
    } finally {
      setSyncBudgetBusyKey(null)
    }
  }

  async function deleteBudget(id) {
    if (!companyReady || !canManageBudgets) return
    if (!window.confirm('Delete this budget?')) return
    setBudgetsBusy(true)
    try {
      await http.delete(`/corporate/company/budgets/${encodeURIComponent(id)}`, { params: withCompanyParams() })
      toast.success('Budget removed.')
      await loadBudgets()
      await loadCompanyAnalytics(Number(wfDays || 30))
      setEditingBudgetId(null)
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete')
    } finally {
      setBudgetsBusy(false)
    }
  }

  useEffect(() => {
    if (!companyReady) return
    if (tab === 'insights') {
      loadMembers().catch(() => {})
      loadInvites().catch(() => {})
      loadAudit({ reset: true }).catch(() => {})
      loadCompanyAnalytics().catch(() => {})
      loadDepartments().catch(() => {})
      loadBudgets().catch(() => {})
      loadWorkforceInsights().catch(() => {})
      if (canUseOps || canUseStaff) loadWorkerLists().catch(() => {})
    }
    if (tab === 'ops') loadDepartments().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyReady, tab])

  async function savePayrollSettings() {
    setPsBusy(true)
    try {
      const payload = {
        currency: String(psCurrency || 'GHS').trim() || 'GHS',
        tax_rate_pct: Number(psTaxPct || 0),
        ni_rate_pct: Number(psNiPct || 0),
        pension_rate_pct: Number(psPensionPct || 0),
      }
      const r = await http.put('/corporate/company/payroll/settings', payload, { params: withCompanyParams() })
      setPayrollSettings(r.data ?? null)
      toast.success('Payroll settings saved.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to save settings')
    } finally {
      setPsBusy(false)
    }
  }

  async function addEmployee() {
    setEmpBusy(true)
    try {
      const payload = {
        worker_user_id: empUserId.trim() || null,
        full_name: empName.trim() || null,
        email: empEmail.trim() || null,
        phone: empPhone.trim() || null,
        pay_basis: empPayBasis || 'salary',
        pay_rate: empPayRate ? Number(empPayRate) : 0,
        pay_period: empPayPeriod || 'month',
        tax_code: empTaxCode.trim() || null,
      }
      const r = await http.post('/corporate/company/payroll/employees', payload, { params: withCompanyParams() })
      setPayrollEmployees((prev) => [r.data, ...(Array.isArray(prev) ? prev : [])])
      setEmpName('')
      setEmpEmail('')
      setEmpPhone('')
      setEmpUserId('')
      setEmpPayBasis('salary')
      setEmpPayRate('')
      setEmpPayPeriod('month')
      setEmpTaxCode('')
      toast.success('Employee added.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to add employee')
    } finally {
      setEmpBusy(false)
    }
  }

  async function deactivateEmployee(id) {
    const ok = window.confirm('Remove this employee from payroll? (They will be set inactive.)')
    if (!ok) return
    try {
      await http.delete(`/corporate/company/payroll/employees/${encodeURIComponent(id)}`, { params: withCompanyParams() })
      setPayrollEmployees((prev) => (Array.isArray(prev) ? prev.map((e) => (e.id === id ? { ...e, active: false } : e)) : prev))
      toast.success('Employee deactivated.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to remove employee')
    }
  }

  async function createPayRun() {
    if (!runStart || !runEnd) {
      toast.warning('Pick a period start/end first.')
      return
    }
    setRunBusy(true)
    try {
      const payload = {
        period_start: runStart,
        period_end: runEnd,
        pay_date: runPayDate || null,
        hours_by_employee_id: hoursByEmpId,
      }
      const r = await http.post('/corporate/company/payroll/runs', payload, { params: withCompanyParams() })
      setLastRun(r.data ?? null)
      toast.success('Draft pay run created.')
    } catch (err) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to create pay run')
    } finally {
      setRunBusy(false)
    }
  }

  async function loadOpsCoverage({ daysOverride } = {}) {
    if (!companyReady) return
    const days = daysOverride != null ? Number(daysOverride) : Number(opsCoverageDays || 14)
    if (!Number.isFinite(days) || days <= 0) return
    setOpsCoverageLoading(true)
    setOpsCoverageError(null)
    try {
      const r = await http.get('/corporate/company/shifts/coverage', {
        params: withCompanyParams({
          days,
          limit: 250,
          only_unfilled: Boolean(opsCoverageOnlyUnfilled),
          include_past: false,
        }),
      })
      setOpsCoverage(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setOpsCoverageError(e?.response?.data?.message ?? e?.message ?? 'Failed to load coverage')
      setOpsCoverage([])
    } finally {
      setOpsCoverageLoading(false)
    }
  }

  function filterOpsShiftItems(items) {
    const text = String(opsShiftFilterText || '').trim().toLowerCase()
    const role = String(opsShiftFilterRole || '').trim().toLowerCase()
    const loc = String(opsShiftFilterLocation || '').trim().toLowerCase()
    const arr = Array.isArray(items) ? items : []
    if (!text && !role && !loc) return arr
    return arr.filter((s) => {
      if (!s) return false
      const title = String(s.title || '').toLowerCase()
      const roleTag = String(s.role_tag || '').toLowerCase()
      const location = String(s.location || '').toLowerCase()
      if (role && roleTag !== role) return false
      if (loc && !location.includes(loc)) return false
      if (text) {
        const hay = `${title} ${roleTag} ${location}`
        if (!hay.includes(text)) return false
      }
      return true
    })
  }

  const opsShiftRoleOptions = useMemo(() => {
    const set = new Set()
    for (const s of [...(Array.isArray(opsCoverage) ? opsCoverage : []), ...(Array.isArray(opsCalItems) ? opsCalItems : [])]) {
      const v = String(s?.role_tag || '').trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [opsCoverage, opsCalItems])

  const opsCoverageFiltered = useMemo(
    () => filterOpsShiftItems(opsCoverage),
    [opsCoverage, opsShiftFilterText, opsShiftFilterRole, opsShiftFilterLocation],
  )

  const opsCalFiltered = useMemo(
    () => filterOpsShiftItems(opsCalItems),
    [opsCalItems, opsShiftFilterText, opsShiftFilterRole, opsShiftFilterLocation],
  )

  function dateKeyLocal(d) {
    try {
      const x = d instanceof Date ? d : new Date(d)
      const y = x.getFullYear()
      const m = String(x.getMonth() + 1).padStart(2, '0')
      const day = String(x.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    } catch {
      return null
    }
  }

  async function loadOpsCalendar({ daysOverride } = {}) {
    if (!companyReady) return
    const days = daysOverride != null ? Number(daysOverride) : Number(opsCalDays || 14)
    if (!Number.isFinite(days) || days <= 0) return
    setOpsCalLoading(true)
    setOpsCalError(null)
    try {
      const r = await http.get('/corporate/company/shifts/coverage', {
        params: withCompanyParams({
          days,
          limit: 500,
          only_unfilled: Boolean(opsCalOnlyUnfilled),
          include_past: false,
        }),
      })
      setOpsCalItems(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setOpsCalError(e?.response?.data?.message ?? e?.message ?? 'Failed to load calendar')
      setOpsCalItems([])
    } finally {
      setOpsCalLoading(false)
    }
  }

  async function loadOpsAutopilotSettings() {
    if (!companyReady) return
    setOpsAutoLoading(true)
    setOpsAutoError(null)
    try {
      const r = await http.get('/corporate/company/ops/settings', { params: withCompanyParams() })
      const row = r.data ?? null
      setOpsAutoEnabled(Boolean(row?.coverage_auto_fill_enabled))
      setOpsAutoListId(row?.coverage_auto_fill_list_id ? String(row.coverage_auto_fill_list_id) : '')
      setOpsAutoDays(String(row?.coverage_auto_fill_days ?? 14))
      setOpsAutoMaxShifts(String(row?.coverage_auto_fill_max_shifts ?? 25))
      setOpsAutoMaxInvitesPerDay(String(row?.coverage_auto_fill_max_invites_per_day ?? 200))
      setOpsAutoLastRunAt(row?.coverage_auto_fill_last_run_at ?? null)
      setOpsCoverageAlertEnabled(Boolean(row?.coverage_alert_enabled ?? true))
      setOpsCoverageAlertLookaheadHours(String(row?.coverage_alert_lookahead_hours ?? 72))
      setOpsCoverageAlertMinOpenSlots(String(row?.coverage_alert_min_open_slots ?? 1))
      setOpsCoverageAlertLastSentAt(row?.coverage_alert_last_sent_at ?? null)
      setOpsReliabilityAlertEnabled(Boolean(row?.reliability_alert_enabled ?? true))
      setOpsReliabilityAlertThresholdPct(String(row?.reliability_alert_threshold_noshow_pct ?? 30))
      setOpsReliabilityAlertLastSentAt(row?.reliability_alert_last_sent_at ?? null)
      setOpsWeeklyDigestEnabled(Boolean(row?.weekly_digest_enabled ?? true))
      setOpsWeeklyDigestLastSentAt(row?.weekly_digest_last_sent_at ?? null)
    } catch (e) {
      setOpsAutoError(e?.response?.data?.message ?? e?.message ?? 'Failed to load autopilot settings')
    } finally {
      setOpsAutoLoading(false)
    }
  }

  async function loadOpsAutopilotRuns() {
    if (!companyReady) return
    setOpsAutoRunsLoading(true)
    setOpsAutoRunsError(null)
    try {
      const r = await http.get('/corporate/company/ops/autopilot/runs', { params: withCompanyParams({ limit: 12 }) })
      setOpsAutoRuns(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setOpsAutoRunsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load run log')
      setOpsAutoRuns([])
    } finally {
      setOpsAutoRunsLoading(false)
    }
  }

  async function loadCompanyOpsAlerts() {
    if (!companyReady) return
    setOpsAlertsLoading(true)
    setOpsAlertsError(null)
    try {
      const r = await http.get('/corporate/company/ops/alerts', { params: withCompanyParams({ status: 'open', limit: 50 }) })
      setOpsAlerts(Array.isArray(r.data?.items) ? r.data.items : [])
    } catch (e) {
      setOpsAlertsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load ops alerts')
      setOpsAlerts([])
    } finally {
      setOpsAlertsLoading(false)
    }
  }

  async function resolveCompanyOpsAlert(id) {
    const aid = String(id || '').trim()
    if (!aid) return
    if (!online) return toast.warning('Offline', 'Reconnect to resolve alerts.')
    if (!canSaveOpsSettings) return toast.warning('Access', 'Only owner/ops can resolve alerts.')
    setOpsAlertResolvingId(aid)
    try {
      await http.post(`/corporate/company/ops/alerts/${encodeURIComponent(aid)}/resolve`, null, { params: withCompanyParams() })
      toast.success('Resolved.')
      await loadCompanyOpsAlerts()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to resolve alert')
    } finally {
      setOpsAlertResolvingId(null)
    }
  }

  async function viewAlert(a) {
    const type = String(a?.type || '')
    const payload = a?.payload || {}

    if (type === 'company_ops_coverage_risk') {
      const lookaheadH = Number(payload?.lookahead_hours ?? 72)
      const days = Math.min(30, Math.max(1, Math.ceil((Number.isFinite(lookaheadH) ? lookaheadH : 72) / 24)))
      setOpsCoverageOnlyUnfilled(true)
      setOpsCoverageDays(String(days))
      await loadOpsCoverage({ daysOverride: days }).catch(() => {})
      try {
        document.getElementById('ops-coverage-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        // ignore
      }
      return
    }

    if (type === 'company_ops_reliability_risk') {
      setWfDays('90')
      setTabInUrl('insights')
      await loadWorkforceInsights(90).catch(() => {})
      const top = Array.isArray(payload?.top) ? payload.top : []
      const first = top[0]?.id ? String(top[0].id) : ''
      if (first) {
        await openWorkerHistoryModal(first).catch(() => {})
      }
      return
    }

    // default: no-op
  }

  async function saveOpsAutopilotSettings() {
    if (!companyReady) return
    if (!online) return toast.warning('Offline', 'Reconnect to save settings.')
    if (!canSaveOpsSettings) return toast.warning('Access', 'Only owner/ops can save autopilot settings.')
    const enabled = Boolean(opsAutoEnabled)
    const days = Number(opsAutoDays || 14)
    const maxShifts = Number(opsAutoMaxShifts || 25)
    const maxInvitesPerDay = Number(opsAutoMaxInvitesPerDay || 200)
    const lookaheadH = Number(opsCoverageAlertLookaheadHours || 72)
    const minOpenSlots = Number(opsCoverageAlertMinOpenSlots || 1)
    const riskPct = Number(opsReliabilityAlertThresholdPct || 30)
    if (enabled && !opsAutoListId) return toast.warning('Pick a pool', 'Select a worker pool to enable autopilot.')
    if (!Number.isFinite(days) || days < 1 || days > 90) return toast.warning('Invalid', 'Days must be 1–90.')
    if (!Number.isFinite(maxShifts) || maxShifts < 1 || maxShifts > 200) return toast.warning('Invalid', 'Max shifts must be 1–200.')
    if (!Number.isFinite(maxInvitesPerDay) || maxInvitesPerDay < 1 || maxInvitesPerDay > 2000) return toast.warning('Invalid', 'Daily invite cap must be 1–2000.')
    if (!Number.isFinite(lookaheadH) || lookaheadH < 12 || lookaheadH > 336) return toast.warning('Invalid', 'Coverage lookahead must be 12–336 hours.')
    if (!Number.isFinite(minOpenSlots) || minOpenSlots < 1 || minOpenSlots > 500) return toast.warning('Invalid', 'Min open slots must be 1–500.')
    if (!Number.isFinite(riskPct) || riskPct < 10 || riskPct > 95) return toast.warning('Invalid', 'No-show threshold must be 10–95%.')
    setOpsAutoBusy(true)
    setOpsAutoError(null)
    try {
      const payload = {
        coverage_auto_fill_enabled: enabled,
        coverage_auto_fill_list_id: opsAutoListId || null,
        coverage_auto_fill_days: days,
        coverage_auto_fill_max_shifts: maxShifts,
        coverage_auto_fill_max_invites_per_day: maxInvitesPerDay,
        coverage_alert_enabled: Boolean(opsCoverageAlertEnabled),
        coverage_alert_lookahead_hours: lookaheadH,
        coverage_alert_min_open_slots: minOpenSlots,
        reliability_alert_enabled: Boolean(opsReliabilityAlertEnabled),
        reliability_alert_threshold_noshow_pct: riskPct,
        weekly_digest_enabled: Boolean(opsWeeklyDigestEnabled),
      }
      const r = await http.put('/corporate/company/ops/settings', payload, { params: withCompanyParams() })
      setOpsAutoEnabled(Boolean(r.data?.coverage_auto_fill_enabled))
      setOpsAutoListId(r.data?.coverage_auto_fill_list_id ? String(r.data.coverage_auto_fill_list_id) : opsAutoListId)
      setOpsAutoDays(String(r.data?.coverage_auto_fill_days ?? days))
      setOpsAutoMaxShifts(String(r.data?.coverage_auto_fill_max_shifts ?? maxShifts))
      setOpsAutoMaxInvitesPerDay(String(r.data?.coverage_auto_fill_max_invites_per_day ?? maxInvitesPerDay))
      setOpsAutoLastRunAt(r.data?.coverage_auto_fill_last_run_at ?? null)
      setOpsCoverageAlertEnabled(Boolean(r.data?.coverage_alert_enabled ?? opsCoverageAlertEnabled))
      setOpsCoverageAlertLookaheadHours(String(r.data?.coverage_alert_lookahead_hours ?? lookaheadH))
      setOpsCoverageAlertMinOpenSlots(String(r.data?.coverage_alert_min_open_slots ?? minOpenSlots))
      setOpsCoverageAlertLastSentAt(r.data?.coverage_alert_last_sent_at ?? opsCoverageAlertLastSentAt)
      setOpsReliabilityAlertEnabled(Boolean(r.data?.reliability_alert_enabled ?? opsReliabilityAlertEnabled))
      setOpsReliabilityAlertThresholdPct(String(r.data?.reliability_alert_threshold_noshow_pct ?? riskPct))
      setOpsReliabilityAlertLastSentAt(r.data?.reliability_alert_last_sent_at ?? opsReliabilityAlertLastSentAt)
      setOpsWeeklyDigestEnabled(Boolean(r.data?.weekly_digest_enabled ?? opsWeeklyDigestEnabled))
      setOpsWeeklyDigestLastSentAt(r.data?.weekly_digest_last_sent_at ?? opsWeeklyDigestLastSentAt)
      toast.success('Autopilot settings saved.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save settings')
    } finally {
      setOpsAutoBusy(false)
    }
  }

  async function openShiftFromCoverage(shiftId) {
    const sid = String(shiftId || '').trim()
    if (!sid) return
    setSelectedShiftId(sid)
    await loadShiftDetail(sid)
  }

  async function setShiftAutofillDisabled(shiftId, disabled) {
    const sid = String(shiftId || '').trim()
    if (!sid) return
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    if (!canUseOps) return toast.warning('Access', 'Your role cannot change shift ops settings.')
    setShiftBusy(true)
    try {
      const r = await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/autofill`,
        { coverage_auto_fill_disabled: !!disabled },
        { params: withCompanyParams() },
      )
      toast.success(r.data?.coverage_auto_fill_disabled ? 'Autopilot disabled for this shift.' : 'Autopilot enabled for this shift.')
      loadShiftDetail(sid).catch(() => {})
      loadOpsCoverage().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update shift setting')
    } finally {
      setShiftBusy(false)
    }
  }

  async function inviteRemainingFromCoverage(shiftId) {
    const sid = String(shiftId || '').trim()
    if (!sid) return
    if (!selectedListId) return toast.warning('Select a worker pool first.')
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    setOpsCoverageBusyKey(`fill:${sid}`)
    try {
      const r = await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/fill-from-pool`,
        { list_id: selectedListId, mode: 'remaining' },
        { params: withCompanyParams() },
      )
      toast.success(`Invited ${Number(r.data?.inserted_count ?? 0)} worker(s).`)
      await loadOpsCoverage().catch(() => {})
      loadOpsCalendar().catch(() => {})
      loadShiftDetail(sid).catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to invite remaining slots')
    } finally {
      setOpsCoverageBusyKey(null)
    }
  }

  async function inviteAllRemainingFromCalendar() {
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    if (!selectedListId) return toast.warning('Pick a pool', 'Select a worker pool first.')
    const targets = filterOpsShiftItems(opsCalItems).filter((s) => Number(s?.open_slots ?? 0) > 0)
    if (targets.length === 0) return toast.success('No open slots', 'All shifts in this window are already covered.')
    const ok = window.confirm(`Invite remaining headcount for ${targets.length} filtered shift(s) using the selected pool?`)
    if (!ok) return

    setOpsCalBusyKey('bulk')
    try {
      setOpsCalBulk({ total: targets.length, done: 0, invited: 0, failed: 0 })
      const r = await http.post(
        `/corporate/company/shifts/fill-from-pool/bulk`,
        { list_id: selectedListId, mode: 'remaining', shift_ids: targets.map((s) => s.id).filter(Boolean) },
        { params: withCompanyParams() },
      )
      const insertedTotal = Number(r.data?.inserted_total ?? 0)
      const notFoundCount = Array.isArray(r.data?.not_found) ? r.data.not_found.length : Number(r.data?.not_found_count ?? 0)
      const skippedCount = Array.isArray(r.data?.skipped) ? r.data.skipped.length : Number(r.data?.skipped_count ?? 0)
      const results = Array.isArray(r.data?.results) ? r.data.results : []
      const failed = results.filter((x) => x && x.ok === false).length
      setOpsCalBulk({ total: targets.length, done: targets.length, invited: insertedTotal, failed: failed + notFoundCount })
      toast.success(
        'Bulk invite complete',
        `Invited ${insertedTotal} worker(s) across ${targets.length} shift(s).${notFoundCount ? ` ${notFoundCount} not found.` : ''}${skippedCount ? ` ${skippedCount} skipped (cap).` : ''}${failed ? ` ${failed} failed.` : ''}`,
      )
      await loadOpsCalendar().catch(() => {})
      loadOpsCoverage().catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } finally {
      setOpsCalBusyKey(null)
      setOpsCalBulk(null)
    }
  }

  async function inviteRemainingForDay(dayKey, list) {
    const shifts = (Array.isArray(list) ? list : []).filter((s) => Number(s?.open_slots ?? 0) > 0)
    if (shifts.length === 0) return toast.success('No open slots', 'This day is already covered.')
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    if (!selectedListId) return toast.warning('Pick a pool', 'Select a worker pool first.')
    const ok = window.confirm(`Invite remaining headcount for ${shifts.length} shift(s) on ${dayKey}?`)
    if (!ok) return

    setOpsCalBusyKey(`day:${dayKey}`)
    try {
      const r = await http.post(
        `/corporate/company/shifts/fill-from-pool/bulk`,
        { list_id: selectedListId, mode: 'remaining', shift_ids: shifts.map((s) => s.id).filter(Boolean) },
        { params: withCompanyParams() },
      )
      const insertedTotal = Number(r.data?.inserted_total ?? 0)
      const notFoundCount = Array.isArray(r.data?.not_found) ? r.data.not_found.length : Number(r.data?.not_found_count ?? 0)
      const skippedCount = Array.isArray(r.data?.skipped) ? r.data.skipped.length : Number(r.data?.skipped_count ?? 0)
      toast.success(
        'Invites sent',
        `Invited ${insertedTotal} worker(s).${notFoundCount ? ` ${notFoundCount} not found.` : ''}${skippedCount ? ` ${skippedCount} skipped (cap).` : ''}`,
      )
      await loadOpsCalendar().catch(() => {})
      loadOpsCoverage().catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } finally {
      setOpsCalBusyKey(null)
    }
  }

  async function inviteAllRemainingFromCoverage() {
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    if (!selectedListId) return toast.warning('Select a worker pool first.')
    const targets = filterOpsShiftItems(opsCoverage).filter((s) => Number(s?.open_slots ?? 0) > 0)
    if (targets.length === 0) return toast.success('No open slots', 'All shifts in this window are already covered.')

    const ok = window.confirm(`Invite remaining headcount for ${targets.length} filtered shift(s) using the selected pool?`)
    if (!ok) return

    setOpsCoverageBusyKey('bulk')
    try {
      setOpsCoverageBulk({ total: targets.length, done: 0, invited: 0, failed: 0 })
      const r = await http.post(
        `/corporate/company/shifts/fill-from-pool/bulk`,
        { list_id: selectedListId, mode: 'remaining', shift_ids: targets.map((s) => s.id).filter(Boolean) },
        { params: withCompanyParams() },
      )
      const insertedTotal = Number(r.data?.inserted_total ?? 0)
      const notFoundCount = Array.isArray(r.data?.not_found) ? r.data.not_found.length : Number(r.data?.not_found_count ?? 0)
      const skippedCount = Array.isArray(r.data?.skipped) ? r.data.skipped.length : Number(r.data?.skipped_count ?? 0)
      const results = Array.isArray(r.data?.results) ? r.data.results : []
      const failed = results.filter((x) => x && x.ok === false).length
      setOpsCoverageBulk({ total: targets.length, done: targets.length, invited: insertedTotal, failed: failed + notFoundCount })
      toast.success(
        'Bulk invite complete',
        `Invited ${insertedTotal} worker(s) across ${targets.length} shift(s).${notFoundCount ? ` ${notFoundCount} not found.` : ''}${skippedCount ? ` ${skippedCount} skipped (cap).` : ''}${failed ? ` ${failed} failed.` : ''}`,
      )
      await loadOpsCoverage().catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } finally {
      setOpsCoverageBusyKey(null)
      setOpsCoverageBulk(null)
    }
  }

  useEffect(() => {
    if (!companyReady) return
    // Load per-tab to avoid noisy 403s for role-limited members.
    if (tab === 'staff') {
      loadWorkerLists().catch(() => {})
    } else if (tab === 'ops') {
      loadWorkforceOverview().catch(() => {})
      loadShifts().catch(() => {})
      loadWorkerLists().catch(() => {})
      loadTemplates().catch(() => {})
      loadSeries().catch(() => {})
      loadOpsAutopilotSettings().catch(() => {})
      loadOpsAutopilotRuns().catch(() => {})
      loadCompanyOpsAlerts().catch(() => {})
      loadOpsCoverage().catch(() => {})
      loadOpsCalendar().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyReady, tab])

  useEffect(() => {
    if (!companyReady) return
    if (!selectedListId) return
    loadWorkers(selectedListId).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyReady, selectedListId])

  // Restore drafts if the forms are blank (useful after refresh or offline).
  useEffect(() => {
    const emptyCompany = !name && !industry && !website && !location && !description && !logoUrl && !coverUrl
    if (emptyCompany) {
      const d = companyDraft.load()
      if (d) {
        setName(String(d.name ?? ''))
        setIndustry(String(d.industry ?? ''))
        setSizeRange(String(d.sizeRange ?? '1-10'))
        setWebsite(String(d.website ?? ''))
        setLocation(String(d.location ?? ''))
        setDescription(String(d.description ?? ''))
        setLogoUrl(String(d.logoUrl ?? ''))
        setCoverUrl(String(d.coverUrl ?? ''))
      }
    }
    const emptyJob = !jobTitle && !jobLocation && !jobDesc && !jobTags && !jobPayMin && !jobPayMax
    if (emptyJob) {
      const d = jobDraft.load()
      if (d) {
        setJobTitle(String(d.jobTitle ?? ''))
        setJobLocation(String(d.jobLocation ?? ''))
        setJobType(String(d.jobType ?? 'full_time'))
        setJobMode(String(d.jobMode ?? 'onsite'))
        setJobPayMin(String(d.jobPayMin ?? ''))
        setJobPayMax(String(d.jobPayMax ?? ''))
        setJobPayPeriod(String(d.jobPayPeriod ?? 'month'))
        setJobTerm(String(d.jobTerm ?? 'permanent'))
        setJobScheduleText(String(d.jobScheduleText ?? ''))
        setJobBenefits(String(d.jobBenefits ?? ''))
        setJobTags(String(d.jobTags ?? ''))
        setJobDesc(String(d.jobDesc ?? ''))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function persistCompanyProfile({ nextLogoUrl, nextCoverUrl, source } = {}) {
    const src = String(source || '')
    if (!online) {
      toast.warning('Offline', 'Reconnect to save.')
      return null
    }
    const nm = String(name || '').trim()
    if (!nm) {
      toast.warning('Missing company name', 'Add your company name, then try again.')
      return null
    }

    setBusy(true)
    try {
      const cleanedLinks = (Array.isArray(profileLinks) ? profileLinks : [])
        .map((l) => ({ label: String(l?.label || '').trim(), url: String(l?.url || '').trim() }))
        .filter((l) => l.label && l.url)
      const payload = {
        name: nm,
        industry: industry || null,
        size_range: sizeRange || null,
        website: website || null,
        location: location || null,
        description: description || null,
        logo_url: (nextLogoUrl ?? logoUrl) || null,
        cover_url: (nextCoverUrl ?? coverUrl) || null,
        profile_links: cleanedLinks.length ? cleanedLinks : null,
        private_profile: privateProfile,
      }
      const res = await http.post('/corporate/company/me', payload, { params: withCompanyParams() })
      setCompany(res.data ?? null)
      companyDraft.clear()
      if (src === 'upload') toast.success('Saved', 'Image uploaded and saved to your public company page.')
      return res.data ?? null
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save company')
      return null
    } finally {
      setBusy(false)
    }
  }

  async function uploadCompanyImage(kind, fileOverride) {
    const k = String(kind || '')
    const f = fileOverride ?? (k === 'logo' ? logoFile : coverFile)
    if (!f) return
    if (!online) return toast.warning('Offline', 'Reconnect to upload.')
    const nm = String(name || '').trim()
    if (!nm) return toast.warning('Missing company name', 'Add your company name first, then upload images.')

    setUploadBusy(true)
    try {
      const res = await uploadMediaFiles([f])
      const url = res?.[0]?.url ? String(res[0].url) : ''
      if (!url) throw new Error('Upload failed')
      if (k === 'logo') {
        setLogoUrl(url)
        setLogoFile(null)
        await persistCompanyProfile({ nextLogoUrl: url, nextCoverUrl: coverUrl, source: 'upload' }).catch(() => {})
      } else {
        setCoverUrl(url)
        setCoverFile(null)
        await persistCompanyProfile({ nextLogoUrl: logoUrl, nextCoverUrl: url, source: 'upload' }).catch(() => {})
      }
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function saveCompany(e) {
    e.preventDefault()
    const r = await persistCompanyProfile({ source: 'manual' })
    if (r) toast.success('Company profile saved.')
  }

  async function postJob(e) {
    e.preventDefault()
    if (!online) {
      toast.warning('Offline', 'You are offline. Your draft is saved — reconnect to post.')
      return
    }
    setBusy(true)
    try {
      const tags = String(jobTags || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await http.post(
        '/corporate/company/jobs',
        {
          title: jobTitle,
          description: jobDesc,
          location: jobLocation || null,
          employment_type: jobType || null,
          work_mode: jobMode || null,
          pay_min: jobPayMin ? Number(jobPayMin) : null,
          pay_max: jobPayMax ? Number(jobPayMax) : null,
          pay_period: jobPayPeriod || null,
          job_term: jobTerm || null,
          schedule_text: jobScheduleText.trim() || null,
          benefits: String(jobBenefits || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 30),
          tags: tags.length ? tags : null,
        },
        { params: withCompanyParams() },
      )
      trackEvent('job_posted')
      toast.success('Job posted.')
      setJobs((prev) => [res.data, ...(Array.isArray(prev) ? prev : [])])
      setJobTitle('')
      setJobLocation('')
      setJobPayMin('')
      setJobPayMax('')
      setJobPayPeriod('month')
      setJobTerm('permanent')
      setJobScheduleText('')
      setJobBenefits('')
      setJobTags('')
      setJobDesc('')
      jobDraft.clear()
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to post job')
    } finally {
      setBusy(false)
    }
  }

  async function createWorkerList(e) {
    e.preventDefault()
    if (!online) return toast.warning('Offline', 'Reconnect to create a list.')
    if (!newListName.trim()) return
    setListBusy(true)
    try {
      const r = await http.post(
        '/corporate/company/worker-lists',
        { name: newListName.trim(), description: newListDesc.trim() || null },
        { params: withCompanyParams() },
      )
      toast.success('List created.')
      setNewListName('')
      setNewListDesc('')
      setWorkerLists((prev) => [r.data, ...(Array.isArray(prev) ? prev : [])])
      if (r.data?.id) setSelectedListId(r.data.id)
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to create list')
    } finally {
      setListBusy(false)
    }
  }

  async function addWorkerToList(listId, workerUserId, meta = {}) {
    const lid = String(listId || '').trim()
    const uid = String(workerUserId || '').trim()
    if (!lid || !uid) return
    if (!online) return toast.warning('Offline', 'Reconnect to add workers.')
    setListBusy(true)
    try {
      await http.post(
        `/corporate/company/worker-lists/${encodeURIComponent(lid)}/members`,
        {
          worker_user_id: uid,
          source: meta?.source ?? 'manual',
          source_id: meta?.source_id ?? null,
        },
        { params: withCompanyParams() },
      )
      toast.success('Added to pool.')
      setAddWorkerUserId('')
      loadWorkers(lid).catch(() => {})
      loadWorkerLists().catch(() => {})
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to add worker')
    } finally {
      setListBusy(false)
    }
  }

  async function removeWorkerFromList(listId, workerUserId) {
    const lid = String(listId || '').trim()
    const uid = String(workerUserId || '').trim()
    if (!lid || !uid) return
    setListBusy(true)
    try {
      await http.delete(`/corporate/company/worker-lists/${encodeURIComponent(lid)}/members/${encodeURIComponent(uid)}`, { params: withCompanyParams() })
      toast.success('Removed from pool.')
      loadWorkers(lid).catch(() => {})
      loadWorkerLists().catch(() => {})
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to remove worker')
    } finally {
      setListBusy(false)
    }
  }

  async function saveWorkerNote(workerUserId) {
    const uid = String(workerUserId || '').trim()
    if (!uid) return
    if (!online) return toast.warning('Offline', 'Reconnect to save notes.')
    setNoteBusyUserId(uid)
    try {
      const d = noteDraftByUserId?.[uid] ?? {}
      await http.put(
        `/corporate/company/workers/${encodeURIComponent(uid)}/note`,
        {
          rating: d?.rating == null || d?.rating === '' ? null : Number(d.rating),
          notes: d?.notes ?? null,
          preferred: !!d?.preferred,
          blocked: !!d?.blocked,
        },
        { params: withCompanyParams() },
      )
      toast.success('Saved.')
      loadWorkers(selectedListId).catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save note')
    } finally {
      setNoteBusyUserId(null)
    }
  }

  async function createShift(e) {
    e.preventDefault()
    if (!online) return toast.warning('Offline', 'Reconnect to create a shift.')
    if (!shiftTitle.trim()) return
    if (!shiftStartAt || !shiftEndAt) return toast.error('Please set start and end time.')
    setShiftBusy(true)
    try {
      const r = await http.post(
        '/corporate/company/shifts',
        {
          title: shiftTitle.trim(),
          role_tag: shiftRoleTag.trim() || null,
          location: shiftLoc.trim() || null,
          department_id: shiftDepartmentId.trim() || null,
          start_at: new Date(shiftStartAt).toISOString(),
          end_at: new Date(shiftEndAt).toISOString(),
          headcount: shiftHeadcount ? Number(shiftHeadcount) : 1,
          checkin_geo_required: !!shiftGeoRequired,
          checkin_geo_radius_m: shiftGeoRequired ? (shiftGeoRadiusM ? Number(shiftGeoRadiusM) : null) : null,
          checkin_geo_lat: shiftGeoRequired ? (shiftGeoLat ? Number(shiftGeoLat) : null) : null,
          checkin_geo_lng: shiftGeoRequired ? (shiftGeoLng ? Number(shiftGeoLng) : null) : null,
        },
        { params: withCompanyParams() },
      )
      toast.success('Shift created.')
      setShiftTitle('')
      setShiftRoleTag('')
      setShiftLoc('')
      setShiftDepartmentId('')
      setShiftStartAt('')
      setShiftEndAt('')
      setShiftHeadcount('1')
      setShiftGeoRequired(false)
      setShiftGeoRadiusM('250')
      setShiftGeoLat('')
      setShiftGeoLng('')
      setShifts((prev) => [r.data, ...(Array.isArray(prev) ? prev : [])])
      setSelectedShiftId(r.data?.id ?? '')
      loadShiftDetail(r.data?.id).catch(() => {})
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? e2?.message ?? 'Failed to create shift')
    } finally {
      setShiftBusy(false)
    }
  }

  async function assignWorkersToShift() {
    const sid = String(selectedShiftId || '').trim()
    if (!sid) return
    const ids = Object.entries(assignSelected || {})
      .filter(([, v]) => !!v)
      .map(([k]) => k)
    if (ids.length === 0) return toast.warning('Select at least 1 worker.')
    setShiftBusy(true)
    try {
      await http.post(`/corporate/company/shifts/${encodeURIComponent(sid)}/assign`, { worker_user_ids: ids }, { params: withCompanyParams() })
      toast.success('Workers invited.')
      setAssignSelected({})
      loadShiftDetail(sid).catch(() => {})
      loadWorkers(selectedListId).catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to assign workers')
    } finally {
      setShiftBusy(false)
    }
  }

  async function setAssignmentStatus(shiftId, workerUserId, status) {
    const sid = String(shiftId || '').trim()
    const uid = String(workerUserId || '').trim()
    if (!sid || !uid) return
    setAssignmentBusyKey(`${sid}:${uid}`)
    try {
      await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/assignments/${encodeURIComponent(uid)}/status`,
        { status },
        { params: withCompanyParams() },
      )
      loadShiftDetail(sid).catch(() => {})
      loadWorkers(selectedListId).catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update status')
    } finally {
      setAssignmentBusyKey(null)
    }
  }

  async function bulkSetAssignmentStatus() {
    const sid = String(shiftDetail?.shift?.id ?? '').trim()
    if (!sid) return
    const ids = Object.entries(assignmentBulkSelected || {})
      .filter(([, v]) => !!v)
      .map(([k]) => k)
    if (ids.length === 0) return toast.warning('Select at least 1 worker.')
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')

    setAssignmentBulkBusy(true)
    try {
      await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/assignments/bulk-status`,
        {
          worker_user_ids: ids,
          status: assignmentBulkStatus,
        },
        { params: withCompanyParams() },
      )
      toast.success('Updated.')
      setAssignmentBulkSelected({})
      loadShiftDetail(sid).catch(() => {})
      loadWorkers(selectedListId).catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Bulk update failed')
    } finally {
      setAssignmentBulkBusy(false)
    }
  }

  async function fillFromSelectedPool() {
    const sid = String(shiftDetail?.shift?.id ?? '').trim()
    if (!sid) return
    if (!selectedListId) return toast.warning('Select a worker pool first.')
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    const count = fillCount ? Number(fillCount) : 1
    if (!Number.isFinite(count) || count <= 0) return toast.warning('Invalid count')

    setShiftBusy(true)
    try {
      const r = await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/fill-from-pool`,
        {
          list_id: selectedListId,
          mode: 'count',
          count,
        },
        { params: withCompanyParams() },
      )
      toast.success(`Invited ${Number(r.data?.inserted_count ?? 0)} worker(s).`)
      loadShiftDetail(sid).catch(() => {})
      loadWorkers(selectedListId).catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to invite replacements')
    } finally {
      setShiftBusy(false)
    }
  }

  function staffingHolesForShift(detail) {
    const headcount = Number(detail?.shift?.headcount ?? 1)
    const list = Array.isArray(detail?.assignments) ? detail.assignments : []
    const active = list.filter((a) => ['invited', 'accepted', 'checked_in', 'checked_out', 'completed'].includes(String(a.status))).length
    const holes = Math.max(0, headcount - active)
    const noShows = list.filter((a) => String(a.status) === 'no_show').length
    return { headcount, active, holes, noShows }
  }

  async function fillRemainingToHeadcount() {
    const sid = String(shiftDetail?.shift?.id ?? '').trim()
    if (!sid) return
    if (!selectedListId) return toast.warning('Select a worker pool first.')
    const { holes } = staffingHolesForShift(shiftDetail)
    if (holes <= 0) return toast.success('Already at headcount.')
    setShiftBusy(true)
    try {
      const r = await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/fill-from-pool`,
        {
          list_id: selectedListId,
          mode: 'remaining',
        },
        { params: withCompanyParams() },
      )
      toast.success(`Invited ${Number(r.data?.inserted_count ?? 0)} worker(s).`)
      loadShiftDetail(sid).catch(() => {})
      loadWorkers(selectedListId).catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to fill remaining slots')
    } finally {
      setShiftBusy(false)
    }
  }

  async function replaceNoShows() {
    const sid = String(shiftDetail?.shift?.id ?? '').trim()
    if (!sid) return
    if (!selectedListId) return toast.warning('Select a worker pool first.')
    const { noShows } = staffingHolesForShift(shiftDetail)
    if (noShows <= 0) return toast.success('No no-shows to replace.')
    setShiftBusy(true)
    try {
      const r = await http.post(
        `/corporate/company/shifts/${encodeURIComponent(sid)}/fill-from-pool`,
        {
          list_id: selectedListId,
          mode: 'replace_no_shows',
        },
        { params: withCompanyParams() },
      )
      toast.success(`Invited ${Number(r.data?.inserted_count ?? 0)} worker(s).`)
      loadShiftDetail(sid).catch(() => {})
      loadWorkers(selectedListId).catch(() => {})
      loadWorkforceOverview().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to replace no-shows')
    } finally {
      setShiftBusy(false)
    }
  }

  async function rotateCheckinCode(shiftId) {
    const sid = String(shiftId || '').trim()
    if (!sid) return
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    setCheckinBusyShiftId(sid)
    try {
      const r = await http.post(`/corporate/company/shifts/${encodeURIComponent(sid)}/checkin/rotate`, null, { params: withCompanyParams() })
      const code = String(r.data?.code ?? '').trim()
      if (code) setCheckinCodeByShiftId((m) => ({ ...(m || {}), [sid]: code }))
      toast.success('Check-in code rotated.')
      loadShiftDetail(sid).catch(() => {})
      loadShifts().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to rotate code')
    } finally {
      setCheckinBusyShiftId(null)
    }
  }

  async function disableCheckinCode(shiftId) {
    const sid = String(shiftId || '').trim()
    if (!sid) return
    setCheckinBusyShiftId(sid)
    try {
      await http.post(`/corporate/company/shifts/${encodeURIComponent(sid)}/checkin/disable`, null, { params: withCompanyParams() })
      setCheckinCodeByShiftId((m) => {
        const next = { ...(m || {}) }
        delete next[sid]
        return next
      })
      toast.success('Code check-in disabled.')
      loadShiftDetail(sid).catch(() => {})
      loadShifts().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to disable code')
    } finally {
      setCheckinBusyShiftId(null)
    }
  }

  async function getBrowserPosition() {
    return await new Promise((resolve, reject) => {
      if (!navigator?.geolocation) return reject(new Error('Geolocation not supported'))
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err || new Error('Failed to get location')),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      )
    })
  }

  async function useMyLocationForNewShift() {
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    try {
      const pos = await getBrowserPosition()
      setShiftGeoLat(String(pos?.coords?.latitude ?? ''))
      setShiftGeoLng(String(pos?.coords?.longitude ?? ''))
      toast.success('Location captured.')
    } catch (e) {
      toast.error(e?.message ?? 'Failed to get location')
    }
  }

  async function saveGeoCheckin(shiftId) {
    const sid = String(shiftId || '').trim()
    if (!sid) return
    const d = geoCheckinDraftByShiftId?.[sid] ?? {}
    const required = Boolean(d.required)
    const payload = {
      required,
      radius_m: d.radius_m == null || d.radius_m === '' ? null : Number(d.radius_m),
      lat: d.lat == null || d.lat === '' ? null : Number(d.lat),
      lng: d.lng == null || d.lng === '' ? null : Number(d.lng),
    }
    setCheckinBusyShiftId(sid)
    try {
      await http.post(`/corporate/company/shifts/${encodeURIComponent(sid)}/checkin/geo`, payload, { params: withCompanyParams() })
      toast.success('Geo check-in updated.')
      loadShiftDetail(sid).catch(() => {})
      loadShifts().catch(() => {})
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update geo check-in')
    } finally {
      setCheckinBusyShiftId(null)
    }
  }

  async function loadApplications(jobId) {
    setSelectedJobId(jobId)
    setAppsLoading(true)
    setAppsError(null)
    try {
      const res = await http.get(`/corporate/company/jobs/${encodeURIComponent(jobId)}/applications`, { params: withCompanyParams() })
      setApplications(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      setAppsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load applicants')
      setApplications([])
    } finally {
      setAppsLoading(false)
    }
  }

  async function updateApplicationStatus(jobId, appId, status) {
    setAppsLoading(true)
    setAppsError(null)
    try {
      const res = await http.post(`/corporate/company/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(appId)}/status`, { status })
      setApplications((prev) => (prev || []).map((a) => (a.id === appId ? { ...a, status: res.data?.status ?? status, updated_at: res.data?.updated_at ?? a.updated_at } : a)))
      toast.success('Applicant status updated.')
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to update applicant'
      setAppsError(msg)
      toast.error(msg)
    } finally {
      setAppsLoading(false)
    }
  }

  function templateText(key, applicantName) {
    const name = applicantName ? String(applicantName).split(/\s+/)[0] : 'there'
    if (key === 'thanks') {
      return `Hi ${name} — thanks for applying. Please confirm:\n1) Your availability (start date)\n2) Your expected salary range (GHS)\n3) Your current location\n\nReply here and we’ll continue.`
    }
    if (key === 'interview') {
      return `Hi ${name} — you’ve been shortlisted. Can we schedule a quick interview?\nPlease share 2 available time slots (today/tomorrow) and your phone will remain protected in chat for safety.`
    }
    if (key === 'docs') {
      return `Hi ${name} — please share any relevant experience/certifications and your preferred work mode (on-site/remote/hybrid).`
    }
    return `Hi ${name} — thanks for applying.`
  }

  async function sendTemplate(jobId, applicantUserId, applicantName, key) {
    try {
      const msg = templateText(key, applicantName)
      await http.post(`/messages/job-posts/${encodeURIComponent(jobId)}?with=${encodeURIComponent(applicantUserId)}`, { message: msg })
      toast.success('Message sent.')
      // Move to contacted (unless already rejected/hired)
      const target = applications.find((x) => x.applicant_user_id === applicantUserId)
      const st = String(target?.status || 'submitted')
      if (st !== 'rejected' && st !== 'hired') {
        await updateApplicationStatus(jobId, target?.id, 'contacted')
      }
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to send message')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ImageCropperModal
        open={!!crop}
        file={crop?.file ?? null}
        title={crop?.kind === 'cover' ? 'Adjust cover photo' : 'Adjust company logo'}
        aspect={crop?.kind === 'cover' ? 3 : 1}
        outputMaxWidth={crop?.kind === 'cover' ? 1600 : 800}
        onCancel={() => setCrop(null)}
        onConfirm={async (croppedFile) => {
          const kind = crop?.kind
          setCrop(null)
          if (!kind) return
          if (kind === 'logo') setLogoFile(croppedFile)
          if (kind === 'cover') setCoverFile(croppedFile)
          await uploadCompanyImage(kind, croppedFile)
        }}
      />

      {wfWorkerModalOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setWfWorkerModalOpen(false)
              setWfWorkerId(null)
              setWfWorkerHistory(null)
              setWfWorkerHistoryError(null)
            }}
            aria-label="Close worker modal"
          />
          <div className="absolute left-1/2 top-1/2 w-[94%] max-w-3xl -translate-x-1/2 -translate-y-1/2">
            <Card className="p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={wfWorkerHistory?.worker?.profile_pic || '/locallink-logo.png'}
                    alt="avatar"
                    className="h-10 w-10 rounded-2xl border object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{wfWorkerHistory?.worker?.name || 'Worker'}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Last {wfWorkerHistory?.window_days ?? Math.max(30, Math.min(365, Number(wfDays || 90)))} days
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!online || wfWorkerHistoryLoading || !canSetWorkerPreferred || wfActionBusyKey === `preferred-${wfWorkerId}`}
                    onClick={modalPreferToggle}
                    title={!canSetWorkerPreferred ? 'Your role cannot change preferred status' : undefined}
                  >
                    {wfActionBusyKey === `preferred-${wfWorkerId}` ? 'Working…' : wfWorkerHistory?.worker?.preferred ? 'Unprefer' : 'Prefer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!online || wfWorkerHistoryLoading || !canSetWorkerBlocked || wfActionBusyKey === `blocked-${wfWorkerId}`}
                    onClick={() => modalBlockToggle(!(wfWorkerHistory?.worker?.blocked ?? false))}
                    title={!canSetWorkerBlocked ? 'Only owner/ops can block workers' : undefined}
                  >
                    {wfActionBusyKey === `blocked-${wfWorkerId}` ? 'Working…' : wfWorkerHistory?.worker?.blocked ? 'Unblock' : 'Block'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!online || wfWorkerHistoryLoading || !(canUseOps || canUseStaff) || !wfPoolListId || wfActionBusyKey === `pool-${wfWorkerId}`}
                    onClick={modalAddToPool}
                    title={!wfPoolListId ? 'Pick a pool on the Insights card first' : undefined}
                  >
                    {wfActionBusyKey === `pool-${wfWorkerId}` ? 'Working…' : 'Add to pool'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setWfWorkerModalOpen(false)
                      setWfWorkerId(null)
                      setWfWorkerHistory(null)
                      setWfWorkerHistoryError(null)
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="px-5 py-4">
                {wfWorkerHistoryError ? <div className="text-sm text-red-700">{wfWorkerHistoryError}</div> : null}
                {wfWorkerHistoryLoading ? <div className="text-sm text-slate-600">Loading…</div> : null}

                {!wfWorkerHistoryLoading && wfWorkerHistory ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">Recent assignments</div>
                      {(wfWorkerHistory.items || []).length === 0 ? (
                        <div className="mt-2 text-sm text-slate-600">No assignments found in this window.</div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {(wfWorkerHistory.items || []).slice(0, 50).map((it) => (
                            <div key={it.assignment_id || `${it.shift_id}-${it.start_at}`} className="rounded-xl border bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">{it.shift_title || 'Shift'}</div>
                                  <div className="mt-0.5 text-xs text-slate-600">
                                    {it.start_at ? fmtDate(it.start_at) : '—'} → {it.end_at ? fmtDate(it.end_at) : '—'}
                                    {it.location ? ` • ${it.location}` : ''}
                                    {it.role_tag ? ` • ${it.role_tag}` : ''}
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-600">
                                  <div className="font-semibold text-slate-900">{String(it.status || 'invited')}</div>
                                  {it.check_in_at ? <div>check-in: {fmtDate(it.check_in_at)}</div> : null}
                                  {it.no_show_confirmed_at ? <div className="text-red-700">no-show: {fmtDate(it.no_show_confirmed_at)}</div> : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <PageHeader
        kicker="Employers"
        title="Company dashboard"
        subtitle="Create your company profile, post jobs, and review applicants."
        actions={
          <div className="flex flex-wrap gap-2">
            {myCompanies.length > 0 ? (
              <Select
                value={companyIdFromUrl || myCompanies[0]?.id || ''}
                onChange={(e) => setCompanyInUrl(e.target.value)}
                disabled={myCompaniesLoading}
                title={myCompaniesError ? String(myCompaniesError) : undefined}
              >
                {myCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Button variant="secondary" size="sm" disabled>
                {myCompaniesLoading ? 'Loading companies…' : 'No companies'}
              </Button>
            )}
            <Link to="/feed?compose=1">
              <Button>Post an update</Button>
            </Link>
            <Link to="/jobs">
              <Button variant="secondary">Jobs board</Button>
            </Link>
            {company?.slug ? (
              <Link to={`/c/${company.slug}`}>
                <Button variant="secondary">Public page</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {loading || (!companyIdFromUrl && myCompaniesLoading) ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card className="p-5">
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : !companyReady && user?.role !== 'company' && !isWorkspaceMember ? (
        <Card className="p-5">
          <div className="text-sm font-semibold">No workspace access</div>
          <div className="mt-2 text-sm text-slate-600">
            You’re logged in, but you don’t belong to a company workspace yet.
            Ask a company owner to invite you (you must accept using the same email as your LocalLink account).
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/people">
              <Button variant="secondary">Go to People</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={tab === 'profile' ? undefined : 'secondary'} onClick={() => setTabInUrl('profile')}>
                Profile
              </Button>
              <Button
                type="button"
                variant={tab === 'hiring' ? undefined : 'secondary'}
                onClick={() => setTabInUrl('hiring')}
                disabled={companyReady && !canUseHiring}
                title={companyReady && !canUseHiring ? 'Your workspace role does not have access to Hiring.' : undefined}
              >
                Hiring
              </Button>
              <Button
                type="button"
                variant={tab === 'staff' ? undefined : 'secondary'}
                onClick={() => setTabInUrl('staff')}
                disabled={companyReady && !canUseStaff}
                title={companyReady && !canUseStaff ? 'Your workspace role does not have access to Staff.' : undefined}
              >
                Staff
              </Button>
              <Button
                type="button"
                variant={tab === 'ops' ? undefined : 'secondary'}
                onClick={() => setTabInUrl('ops')}
                disabled={companyReady && !canUseOps}
                title={companyReady && !canUseOps ? 'Your workspace role does not have access to Shifts.' : undefined}
              >
                Shifts
              </Button>
              <Button
                type="button"
                variant={tab === 'payroll' ? undefined : 'secondary'}
                onClick={() => setTabInUrl('payroll')}
                disabled={companyReady && !canUsePayroll}
                title={companyReady && !canUsePayroll ? 'Only owners/finance can access Payroll.' : undefined}
              >
                Payroll
              </Button>
              <Button
                type="button"
                variant={tab === 'insights' ? undefined : 'secondary'}
                onClick={() => setTabInUrl('insights')}
                disabled={companyReady && !canUseInsights}
                title={companyReady && !canUseInsights ? 'Your workspace role does not have access to Insights.' : undefined}
              >
                Insights
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              {tab === 'profile'
                ? 'Set up your public company page (logo, cover, description).'
                : tab === 'hiring'
                  ? 'Post jobs, review applicants, and message candidates.'
                  : tab === 'staff'
                    ? 'Build private worker pools with ratings + internal notes.'
                    : tab === 'ops'
                      ? 'Create shifts, manage assignments, and run check-ins.'
                      : tab === 'payroll'
                        ? 'Set up employees and export pay runs (beta).'
                        : 'Workspace access, audit history, and exports.'}
              {!companyReady ? (
                <span className="ml-2 text-amber-800">
                  Step 1: complete your company profile to unlock everything.
                  <button type="button" className="ml-2 font-semibold underline" onClick={() => setTabInUrl('profile')}>
                    Go to Profile
                  </button>
                </span>
              ) : null}
            </div>
          </Card>

          {tab === 'profile' ? (
          <Card className="p-5">
            <div className="text-sm font-semibold">Company profile</div>
            <div className="mt-1 text-xs text-slate-500">
              Changes here appear on both your company page and your profile.
            </div>
            {companyReady && !canEditCompanyProfile ? (
              <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Your workspace role doesn’t have permission to edit the company profile. Ask an owner/ops/HR member.
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div>Draft autosaves while you type.</div>
              <div className="flex items-center gap-2">
                {companyDraft.savedAt ? <span className="text-emerald-700">Saved</span> : <span>Not saved yet</span>}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => companyDraft.clear()}
                >
                  Clear draft
                </Button>
              </div>
            </div>
            <form onSubmit={saveCompany} className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Company name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required disabled={companyReady && !canEditCompanyProfile} />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Construction, FMCG, Logistics…"
                    disabled={companyReady && !canEditCompanyProfile}
                  />
                </div>
                <div>
                  <Label>Size</Label>
                  <Select value={sizeRange} onChange={(e) => setSizeRange(e.target.value)} disabled={companyReady && !canEditCompanyProfile}>
                    <option value="1-10">1-10</option>
                    <option value="11-50">11-50</option>
                    <option value="51-200">51-200</option>
                    <option value="200+">200+</option>
                  </Select>
                </div>
                <div>
                  <Label>Website</Label>
                  <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" disabled={companyReady && !canEditCompanyProfile} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Accra, Tema…" disabled={companyReady && !canEditCompanyProfile} />
                </div>
                <div>
                  <Label>Logo (upload)</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-2xl border bg-slate-50">
                      {logoUrl ? <img src={logoUrl} alt="logo preview" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadBusy || (companyReady && !canEditCompanyProfile)}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          e.target.value = ''
                          if (!f) return
                          setCrop({ kind: 'logo', file: f })
                        }}
                        className="block w-full text-sm"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={uploadBusy || !logoFile || (companyReady && !canEditCompanyProfile)}
                          onClick={() => uploadCompanyImage('logo')}
                        >
                          {uploadBusy ? 'Uploading…' : 'Upload logo'}
                        </Button>
                        {logoFile ? (
                          <Button type="button" size="sm" variant="secondary" disabled={uploadBusy} onClick={() => setLogoFile(null)}>
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Optional: paste a URL instead.</div>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="/api/uploads/… or https://…"
                    disabled={companyReady && !canEditCompanyProfile}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Cover (upload)</Label>
                  <div className="mt-1 grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <div className="h-24 w-full overflow-hidden rounded-2xl border bg-slate-50">
                        {coverUrl ? <img src={coverUrl} alt="cover preview" className="h-full w-full object-cover" /> : null}
                      </div>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadBusy || (companyReady && !canEditCompanyProfile)}
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          e.target.value = ''
                          if (!f) return
                          setCrop({ kind: 'cover', file: f })
                        }}
                        className="block w-full text-sm"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={uploadBusy || !coverFile || (companyReady && !canEditCompanyProfile)}
                          onClick={() => uploadCompanyImage('cover')}
                        >
                          {uploadBusy ? 'Uploading…' : 'Upload cover'}
                        </Button>
                        {coverFile ? (
                          <Button type="button" size="sm" variant="secondary" disabled={uploadBusy} onClick={() => setCoverFile(null)}>
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Optional: paste a URL instead.</div>
                  <Input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="/api/uploads/… or https://…"
                    disabled={companyReady && !canEditCompanyProfile}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <div className="mt-0.5 mb-1 text-xs text-slate-500">
                  This appears as the bio on your public profile (the page visitors see when they click your company).
                </div>
                <textarea
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What do you do? What kind of people are you hiring?"
                  disabled={companyReady && !canEditCompanyProfile}
                />
              </div>
              <div>
                <Label>Profile links</Label>
                <div className="mt-2 space-y-2">
                  {(Array.isArray(profileLinks) ? profileLinks : []).map((l, idx) => (
                    <div key={idx} className="grid gap-2 md:grid-cols-6">
                      <div className="md:col-span-2">
                        <Input
                          value={l?.label ?? ''}
                          onChange={(e) =>
                            setProfileLinks((arr) => arr.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                          }
                          placeholder="Label"
                          disabled={companyReady && !canEditCompanyProfile}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Input
                          value={l?.url ?? ''}
                          onChange={(e) =>
                            setProfileLinks((arr) => arr.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                          }
                          placeholder="https://…"
                          disabled={companyReady && !canEditCompanyProfile}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setProfileLinks((arr) => arr.filter((_, i) => i !== idx))}
                          disabled={(companyReady && !canEditCompanyProfile) || (Array.isArray(profileLinks) ? profileLinks : []).length <= 1}
                          className="w-full"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setProfileLinks((arr) => [...arr, { label: '', url: '' }])}
                    disabled={companyReady && !canEditCompanyProfile || (Array.isArray(profileLinks) ? profileLinks : []).length >= 8}
                  >
                    Add link
                  </Button>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Examples: Instagram, WhatsApp business link, portfolio, Google Maps.
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="text-sm font-semibold text-slate-900">Owner profile</div>
                <div className="mt-1 text-xs text-slate-500">
                  Settings for your public profile (shown when visitors view your company).
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={privateProfile}
                    onChange={(e) => setPrivateProfile(e.target.checked)}
                    disabled={companyReady && !canEditCompanyProfile}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">Private profile</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      When enabled, visitors must request to follow and you must approve before they can view your full profile.
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Tip: keep this OFF for business discovery; turn it ON for more privacy.
                    </div>
                  </div>
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link to="/profile" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
                    Edit more in My Profile →
                  </Link>
                  <span className="text-xs text-slate-400">
                    Resume, work history, badges, and other personal details.
                  </span>
                </div>
              </div>

              <Button disabled={busy || (companyReady && !canEditCompanyProfile)}>
                {busy ? 'Saving…' : !canEditCompanyProfile && companyReady ? 'No permission' : 'Save company profile'}
              </Button>
            </form>
          </Card>
          ) : null}

          {tab === 'hiring' ? (
            <>
              <Card className="p-5">
                <div className="text-sm font-semibold">Post a job</div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div>Draft autosaves while you type.</div>
                  <div className="flex items-center gap-2">
                    {jobDraft.savedAt ? <span className="text-emerald-700">Saved</span> : <span>Not saved yet</span>}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        jobDraft.clear()
                        setJobTitle('')
                        setJobLocation('')
                        setJobType('full_time')
                        setJobMode('onsite')
                        setJobPayMin('')
                        setJobPayMax('')
                        setJobPayPeriod('month')
                        setJobTerm('permanent')
                        setJobScheduleText('')
                        setJobBenefits('')
                        setJobTags('')
                        setJobDesc('')
                      }}
                    >
                      Clear draft
                    </Button>
                  </div>
                </div>
                {!companyReady ? (
                  <div className="mt-2 text-sm text-slate-600">Save your company profile first.</div>
                ) : (
                  <form onSubmit={postJob} className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Label>Job title</Label>
                        <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required />
                      </div>
                      <div>
                        <Label>Location</Label>
                        <Input value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} placeholder="Tema / Accra…" />
                      </div>
                      <div>
                        <Label>Employment type</Label>
                        <Select value={jobType} onChange={(e) => setJobType(e.target.value)}>
                          <option value="full_time">Full-time</option>
                          <option value="part_time">Part-time</option>
                          <option value="contract">Contract</option>
                          <option value="shift">Shift</option>
                          <option value="internship">Internship</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Job term</Label>
                        <Select value={jobTerm} onChange={(e) => setJobTerm(e.target.value)}>
                          <option value="permanent">Permanent</option>
                          <option value="temporary">Temporary</option>
                          <option value="contract">Contract</option>
                          <option value="internship">Internship</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Work mode</Label>
                        <Select value={jobMode} onChange={(e) => setJobMode(e.target.value)}>
                          <option value="onsite">On-site</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Pay is per</Label>
                        <Select value={jobPayPeriod} onChange={(e) => setJobPayPeriod(e.target.value)}>
                          <option value="hour">Hour</option>
                          <option value="day">Day</option>
                          <option value="week">Week</option>
                          <option value="month">Month</option>
                          <option value="year">Year</option>
                          <option value="shift">Shift</option>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Pay min (GHS)</Label>
                          <Input type="number" min="0" value={jobPayMin} onChange={(e) => setJobPayMin(e.target.value)} />
                        </div>
                        <div>
                          <Label>Pay max (GHS)</Label>
                          <Input type="number" min="0" value={jobPayMax} onChange={(e) => setJobPayMax(e.target.value)} />
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <Label>Shift & schedule (optional)</Label>
                        <Input
                          value={jobScheduleText}
                          onChange={(e) => setJobScheduleText(e.target.value)}
                          placeholder="Monday to Friday • 9am–5:30pm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Benefits (optional, comma separated)</Label>
                        <Input
                          value={jobBenefits}
                          onChange={(e) => setJobBenefits(e.target.value)}
                          placeholder="Company pension, Employee discount, On-site parking"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Tags (comma separated)</Label>
                        <Input value={jobTags} onChange={(e) => setJobTags(e.target.value)} placeholder="warehouse, forklift, electrician…" />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <textarea
                        className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        rows={7}
                        value={jobDesc}
                        onChange={(e) => setJobDesc(e.target.value)}
                        placeholder="Role summary, responsibilities, requirements, how to succeed…"
                        required
                      />
                    </div>
                    <Button disabled={busy || !online} title={!online ? 'Reconnect to post' : undefined}>
                      {busy ? 'Posting…' : !online ? 'Offline' : 'Post job'}
                    </Button>
                  </form>
                )}
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Your jobs</div>
                {jobs.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600">No jobs yet.</div>
                ) : (
                  <div className="mt-3 divide-y">
                    {jobs.map((j) => (
                      <div key={j.id} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{j.title}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              status: {j.status} • created: {fmtDate(j.created_at)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/jobs/${j.id}`}>
                              <Button variant="secondary">View</Button>
                            </Link>
                            <Button variant="secondary" onClick={() => loadApplications(j.id)} disabled={appsLoading && selectedJobId === j.id}>
                              {appsLoading && selectedJobId === j.id ? 'Loading…' : 'Applicants'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Applicants</div>
                {!selectedJobId ? (
                  <div className="mt-2 text-sm text-slate-600">Select a job and click “Applicants”.</div>
                ) : appsLoading ? (
                  <div className="mt-2 text-sm text-slate-600">Loading…</div>
                ) : appsError ? (
                  <div className="mt-2 text-sm text-red-700">{appsError}</div>
                ) : applications.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600">No applicants yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {applications.map((a) => (
                      <div key={a.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{a.full_name || a.email || 'Applicant'}</div>
                            <div className="mt-1 text-xs text-slate-600">
                              {a.email ? `email: ${a.email} ` : ''}
                              {a.phone ? `• phone: ${a.phone} ` : ''}
                              {a.applicant_role ? `• role: ${a.applicant_role}` : ''}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">{fmtDate(a.created_at)}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xs font-semibold text-slate-700">Status</div>
                            <Select
                              value={a.status || 'submitted'}
                              onChange={(e) => updateApplicationStatus(selectedJobId, a.id, e.target.value)}
                              disabled={appsLoading}
                            >
                              <option value="submitted">submitted</option>
                              <option value="shortlisted">shortlisted</option>
                              <option value="contacted">contacted</option>
                              <option value="rejected">rejected</option>
                              <option value="hired">hired</option>
                            </Select>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {workerLists?.length ? (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={poolListByApplicantId[a.id] ?? selectedListId ?? workerLists[0]?.id ?? ''}
                                  onChange={(e) => setPoolListByApplicantId((m) => ({ ...(m || {}), [a.id]: e.target.value }))}
                                  disabled={listBusy || appsLoading}
                                >
                                  {workerLists.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  variant="secondary"
                                  disabled={listBusy || !online}
                                  onClick={() =>
                                    addWorkerToList(poolListByApplicantId[a.id] ?? selectedListId ?? workerLists[0]?.id, a.applicant_user_id, {
                                      source: 'job_application',
                                      source_id: a.id,
                                    })
                                  }
                                  title={!online ? 'Reconnect to add' : undefined}
                                >
                                  Add to pool
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">Create a worker pool to save good applicants.</span>
                            )}
                            <Link to={`/messages/jobpost/${selectedJobId}?with=${encodeURIComponent(a.applicant_user_id)}`}>
                              <Button variant="secondary">Contact</Button>
                            </Link>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2">
                          <div className="min-w-[200px]">
                            <Label>Quick message</Label>
                            <Select
                              value={templateByApplicantId[a.id] ?? 'thanks'}
                              onChange={(e) => setTemplateByApplicantId((m) => ({ ...m, [a.id]: e.target.value }))}
                              disabled={appsLoading}
                            >
                              <option value="thanks">Thanks + questions</option>
                              <option value="interview">Interview scheduling</option>
                              <option value="docs">Request experience/docs</option>
                            </Select>
                          </div>
                          <Button
                            variant="secondary"
                            disabled={appsLoading}
                            onClick={() => sendTemplate(selectedJobId, a.applicant_user_id, a.full_name || a.email, templateByApplicantId[a.id] ?? 'thanks')}
                          >
                            Send
                          </Button>
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{a.cover_letter}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : null}

          {tab === 'staff' ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Worker pools (private)</div>
                  <div className="mt-1 text-sm text-slate-600">Build a reliable pool you can re-use. Notes and stats are private to your company.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      loadWorkerLists().catch(() => {})
                      if (selectedListId) loadWorkers(selectedListId).catch(() => {})
                    }}
                    disabled={workerListsLoading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {!companyReady ? (
                <div className="mt-3 text-sm text-slate-600">Save your company profile first.</div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <Label>Pool</Label>
                      <Select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} disabled={workerListsLoading || listBusy}>
                        <option value="">Select a list…</option>
                        {workerLists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.member_count ?? 0})
                          </option>
                        ))}
                      </Select>
                      {workerListsError ? <div className="mt-1 text-xs text-red-700">{workerListsError}</div> : null}
                    </div>
                    <div>
                      <Label>Add worker (User ID)</Label>
                      <div className="flex gap-2">
                        <Input value={addWorkerUserId} onChange={(e) => setAddWorkerUserId(e.target.value)} placeholder="uuid…" />
                        <Button
                          variant="secondary"
                          disabled={!selectedListId || !addWorkerUserId.trim() || listBusy || !online}
                          onClick={() => addWorkerToList(selectedListId, addWorkerUserId.trim(), { source: 'manual' })}
                          title={!online ? 'Reconnect to add' : undefined}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Tip: use “Add to pool” from Applicants for a better flow.</div>
                    </div>
                  </div>

                  <form onSubmit={createWorkerList} className="mt-5 rounded-2xl border bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-700">Create a new pool</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <div className="md:col-span-1">
                        <Label>Name</Label>
                        <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Preferred electricians" />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Description (optional)</Label>
                        <Input value={newListDesc} onChange={(e) => setNewListDesc(e.target.value)} placeholder="Trusted for weekend call-outs…" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Button disabled={listBusy || !newListName.trim() || !online}>{listBusy ? 'Saving…' : !online ? 'Offline' : 'Create list'}</Button>
                    </div>
                  </form>

                  <div className="mt-5">
                    <div className="text-xs font-semibold text-slate-700">Workers in this pool</div>
                    {workersLoading ? (
                      <div className="mt-2 text-sm text-slate-600">Loading…</div>
                    ) : workersError ? (
                      <div className="mt-2 text-sm text-red-700">{workersError}</div>
                    ) : !selectedListId ? (
                      <div className="mt-2 text-sm text-slate-600">Select a pool to see workers.</div>
                    ) : workers.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-600">No workers yet. Add from Applicants or paste a User ID.</div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {workers.slice(0, 60).map((w) => {
                          const d = noteDraftByUserId?.[w.id] ?? {
                            rating: w.rating ?? null,
                            notes: w.notes ?? '',
                            preferred: !!w.preferred,
                            blocked: !!w.blocked,
                          }
                          const accepted = Number(w.shifts_accepted ?? 0)
                          const checkIns = Number(w.shifts_checked_in ?? 0)
                          const attendancePct = accepted > 0 ? Math.round((checkIns / accepted) * 100) : null
                          return (
                            <div key={w.id} className="rounded-2xl border bg-white p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-slate-900">{w.name ?? 'Worker'}</div>
                                    <div className="text-xs text-slate-500">{w.role}</div>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    completed: {w.shifts_completed ?? 0} • no-shows: {w.shifts_no_show ?? 0}
                                    {attendancePct != null ? ` • attendance: ${attendancePct}%` : ''}
                                    {w.reliability_pct != null ? ` • reliability: ${Number(w.reliability_pct)}%` : ''}
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-500 break-all">id: {w.id}</div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button variant="secondary" size="sm" disabled={listBusy} onClick={() => removeWorkerFromList(selectedListId, w.id)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>

                              <div className="mt-3 grid gap-2 md:grid-cols-6">
                                <div className="md:col-span-1">
                                  <Label>Rating</Label>
                                  <Select
                                    value={d.rating ?? ''}
                                    onChange={(e) =>
                                      setNoteDraftByUserId((m) => ({ ...(m || {}), [w.id]: { ...(m?.[w.id] || d), rating: e.target.value ? Number(e.target.value) : null } }))
                                    }
                                  >
                                    <option value="">—</option>
                                    <option value="5">5</option>
                                    <option value="4">4</option>
                                    <option value="3">3</option>
                                    <option value="2">2</option>
                                    <option value="1">1</option>
                                  </Select>
                                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={!!d.preferred}
                                        onChange={(e) =>
                                          setNoteDraftByUserId((m) => ({
                                            ...(m || {}),
                                            [w.id]: { ...(m?.[w.id] || d), preferred: e.target.checked, blocked: e.target.checked ? false : !!(m?.[w.id] || d)?.blocked },
                                          }))
                                        }
                                      />
                                      <span>Preferred</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={!!d.blocked}
                                        onChange={(e) =>
                                          setNoteDraftByUserId((m) => ({
                                            ...(m || {}),
                                            [w.id]: { ...(m?.[w.id] || d), blocked: e.target.checked, preferred: e.target.checked ? false : !!(m?.[w.id] || d)?.preferred },
                                          }))
                                        }
                                      />
                                      <span>Blocked</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="md:col-span-4">
                                  <Label>Internal notes</Label>
                                  <Input
                                    value={d.notes ?? ''}
                                    onChange={(e) =>
                                      setNoteDraftByUserId((m) => ({ ...(m || {}), [w.id]: { ...(m?.[w.id] || d), notes: e.target.value } }))
                                    }
                                    placeholder="Reliable, arrives early, prefers weekends…"
                                  />
                                </div>
                                <div className="md:col-span-1 flex items-end">
                                  <Button
                                    className="w-full"
                                    variant="secondary"
                                    disabled={noteBusyUserId === w.id || !online}
                                    onClick={() => saveWorkerNote(w.id)}
                                    title={!online ? 'Reconnect to save' : undefined}
                                  >
                                    {noteBusyUserId === w.id ? 'Saving…' : 'Save'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {workers.length > 60 ? <div className="text-xs text-slate-500">Showing 60 of {workers.length} workers.</div> : null}
                      </div>
                    )}
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {tab === 'ops' ? (
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Scheduling (v1)</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Create shift blocks and assign workers from your pool. (Worker acceptance + check-in codes + geo check-in supported.)
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => loadSeries().catch(() => {})} disabled={seriesLoading}>
                    {seriesLoading ? 'Loading…' : 'Refresh recurring'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => loadWorkforceOverview().catch(() => {})} disabled={workforceLoading}>
                    {workforceLoading ? 'Loading…' : 'Refresh metrics'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => loadShifts().catch(() => {})} disabled={shiftsLoading}>
                    Refresh shifts
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => loadOpsCoverage().catch(() => {})} disabled={opsCoverageLoading}>
                    {opsCoverageLoading ? 'Loading…' : 'Refresh coverage'}
                  </Button>
                </div>
              </div>

              {!companyReady ? (
                <div className="mt-3 text-sm text-slate-600">Save your company profile first.</div>
              ) : (
                <>
                  <div className="mt-4 rounded-2xl border bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">Ops Autopilot (beta)</div>
                        <div className="mt-1 text-sm text-slate-600">
                          Automatically invites workers to fill open slots on upcoming shifts (uses preferred/blocked rules). Runs in the background.
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => loadOpsAutopilotSettings().catch(() => {})} disabled={opsAutoLoading}>
                          {opsAutoLoading ? 'Loading…' : 'Refresh'}
                        </Button>
                      </div>
                    </div>

                    {opsAutoError ? <div className="mt-2 text-sm text-red-700">{opsAutoError}</div> : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-6">
                      <label className="md:col-span-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!opsAutoEnabled}
                          onChange={(e) => setOpsAutoEnabled(e.target.checked)}
                          disabled={opsAutoLoading || opsAutoBusy}
                        />
                        <span className="font-medium text-slate-900">Enable autopilot</span>
                      </label>

                      <div className="md:col-span-2">
                        <Label>Worker pool</Label>
                        <Select
                          value={opsAutoListId}
                          onChange={(e) => setOpsAutoListId(e.target.value)}
                          disabled={opsAutoLoading || opsAutoBusy || workerListsLoading}
                          title={workerListsLoading ? 'Loading pools…' : undefined}
                        >
                          <option value="">Select…</option>
                          {(Array.isArray(workerLists) ? workerLists : []).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name || 'Pool'} ({l.member_count ?? 0})
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="md:col-span-1">
                        <Label>Days ahead</Label>
                        <Input type="number" min="1" max="90" value={opsAutoDays} onChange={(e) => setOpsAutoDays(e.target.value)} disabled={opsAutoLoading || opsAutoBusy} />
                      </div>
                      <div className="md:col-span-1">
                        <Label>Max shifts/run</Label>
                        <Input
                          type="number"
                          min="1"
                          max="200"
                          value={opsAutoMaxShifts}
                          onChange={(e) => setOpsAutoMaxShifts(e.target.value)}
                          disabled={opsAutoLoading || opsAutoBusy}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Daily invite cap</Label>
                        <Input
                          type="number"
                          min="1"
                          max="2000"
                          value={opsAutoMaxInvitesPerDay}
                          onChange={(e) => setOpsAutoMaxInvitesPerDay(e.target.value)}
                          disabled={opsAutoLoading || opsAutoBusy}
                          placeholder="200"
                        />
                      </div>

                      <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-slate-500">
                          Last run: {opsAutoLastRunAt ? fmtDate(opsAutoLastRunAt) : '—'}
                        </div>
                        <Button
                          size="sm"
                          disabled={opsAutoBusy || opsAutoLoading || !online || !canSaveOpsSettings}
                          onClick={() => saveOpsAutopilotSettings().catch(() => {})}
                          title={!canSaveOpsSettings ? 'Only owner/ops can save settings' : undefined}
                        >
                          {opsAutoBusy ? 'Working…' : 'Save settings'}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Tip: For full control, keep your pools clean. Blocked workers are excluded; preferred workers are invited first.
                    </div>

                    <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-700">Ops alerts</div>
                          <div className="mt-1 text-sm text-slate-600">Actionable issues detected by background monitoring.</div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => loadCompanyOpsAlerts().catch(() => {})} disabled={opsAlertsLoading}>
                          {opsAlertsLoading ? 'Loading…' : 'Refresh'}
                        </Button>
                      </div>

                      {opsAlertsError ? <div className="mt-2 text-sm text-red-700">{opsAlertsError}</div> : null}
                      {opsAlertsLoading && opsAlerts.length === 0 ? <div className="mt-2 text-sm text-slate-600">Loading…</div> : null}

                      {!opsAlertsLoading && opsAlerts.length === 0 ? (
                        <div className="mt-2 text-sm text-slate-600">No open alerts.</div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {opsAlerts.slice(0, 20).map((a) => {
                            const sev = String(a.severity || 'warning')
                            const sevClass = sev === 'critical' ? 'text-red-700' : sev === 'info' ? 'text-slate-600' : 'text-amber-700'
                            const canView = String(a.type || '') === 'company_ops_coverage_risk' || String(a.type || '') === 'company_ops_reliability_risk'
                            return (
                              <div key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border bg-white p-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900">
                                    <span className={sevClass}>{sev}</span> • {String(a.type || 'alert')}
                                  </div>
                                  <div className="mt-0.5 text-xs text-slate-600">{a.message || '—'}</div>
                                  <div className="mt-0.5 text-xs text-slate-500">
                                    seen: {a.last_seen_at ? fmtDate(a.last_seen_at) : '—'}
                                    {a.count ? ` • count: ${a.count}` : ''}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {canView ? (
                                    <Button size="sm" variant="secondary" onClick={() => viewAlert(a).catch(() => {})}>
                                      View
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!canSaveOpsSettings || !online || opsAlertResolvingId === a.id}
                                    onClick={() => resolveCompanyOpsAlert(a.id)}
                                    title={!canSaveOpsSettings ? 'Only owner/ops can resolve alerts' : undefined}
                                  >
                                    {opsAlertResolvingId === a.id ? 'Resolving…' : 'Resolve'}
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                          {opsAlerts.length > 20 ? <div className="text-xs text-slate-500">Showing 20 of {opsAlerts.length} alerts.</div> : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">Alerts + weekly digest</div>
                      <div className="mt-1 text-sm text-slate-600">Get notified when coverage is at risk, and receive a weekly operations summary.</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-6">
                        <label className="md:col-span-3 flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!opsCoverageAlertEnabled} onChange={(e) => setOpsCoverageAlertEnabled(e.target.checked)} disabled={opsAutoBusy || opsAutoLoading} />
                          <span className="font-medium text-slate-900">Coverage alerts</span>
                        </label>
                        <div className="md:col-span-1">
                          <Label>Lookahead (h)</Label>
                          <Input type="number" min="12" max="336" value={opsCoverageAlertLookaheadHours} onChange={(e) => setOpsCoverageAlertLookaheadHours(e.target.value)} disabled={opsAutoBusy || opsAutoLoading} />
                        </div>
                        <div className="md:col-span-1">
                          <Label>Min open</Label>
                          <Input type="number" min="1" max="500" value={opsCoverageAlertMinOpenSlots} onChange={(e) => setOpsCoverageAlertMinOpenSlots(e.target.value)} disabled={opsAutoBusy || opsAutoLoading} />
                        </div>
                        <div className="md:col-span-1 text-xs text-slate-500 flex items-end">
                          {opsCoverageAlertLastSentAt ? `last: ${fmtDate(opsCoverageAlertLastSentAt)}` : 'last: —'}
                        </div>

                        <label className="md:col-span-3 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!opsReliabilityAlertEnabled}
                            onChange={(e) => setOpsReliabilityAlertEnabled(e.target.checked)}
                            disabled={opsAutoBusy || opsAutoLoading}
                          />
                          <span className="font-medium text-slate-900">Reliability alerts</span>
                        </label>
                        <div className="md:col-span-2">
                          <Label>No-show threshold (%)</Label>
                          <Input type="number" min="10" max="95" value={opsReliabilityAlertThresholdPct} onChange={(e) => setOpsReliabilityAlertThresholdPct(e.target.value)} disabled={opsAutoBusy || opsAutoLoading} />
                        </div>
                        <div className="md:col-span-1 text-xs text-slate-500 flex items-end">
                          {opsReliabilityAlertLastSentAt ? `last: ${fmtDate(opsReliabilityAlertLastSentAt)}` : 'last: —'}
                        </div>

                        <label className="md:col-span-3 flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!opsWeeklyDigestEnabled} onChange={(e) => setOpsWeeklyDigestEnabled(e.target.checked)} disabled={opsAutoBusy || opsAutoLoading} />
                          <span className="font-medium text-slate-900">Weekly digest</span>
                        </label>
                        <div className="md:col-span-3 text-xs text-slate-500 flex items-end">
                          {opsWeeklyDigestLastSentAt ? `last: ${fmtDate(opsWeeklyDigestLastSentAt)}` : 'last: —'}
                        </div>
                      </div>
                    </div>

                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">Recent autopilot runs</div>
                        <div className="mt-1 text-sm text-slate-600">A log of background sweeps and what they changed.</div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => loadOpsAutopilotRuns().catch(() => {})} disabled={opsAutoRunsLoading}>
                        {opsAutoRunsLoading ? 'Loading…' : 'Refresh log'}
                      </Button>
                    </div>

                    {opsAutoRunsError ? <div className="mt-2 text-sm text-red-700">{opsAutoRunsError}</div> : null}
                    {opsAutoRunsLoading && opsAutoRuns.length === 0 ? <div className="mt-2 text-sm text-slate-600">Loading…</div> : null}

                    {!opsAutoRunsLoading && opsAutoRuns.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-600">No runs recorded yet.</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {opsAutoRuns.slice(0, 12).map((r) => (
                          <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border bg-white p-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">
                                {String(r.kind || 'coverage_auto_fill')} •{' '}
                                <span className={String(r.status) === 'failed' ? 'text-red-700' : String(r.status) === 'partial' ? 'text-amber-700' : 'text-emerald-700'}>
                                  {String(r.status || 'ok')}
                                </span>
                              </div>
                              <div className="mt-0.5 text-xs text-slate-600">
                                invited: {r.invited_workers ?? 0} • shifts: {r.processed_shifts ?? 0}
                                {Number(r.failed_shifts ?? 0) > 0 ? ` • failed: ${r.failed_shifts}` : ''}
                                {r.window_days ? ` • window: ${r.window_days}d` : ''}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {r.created_at ? fmtDate(r.created_at) : r.finished_at ? fmtDate(r.finished_at) : '—'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>

                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4" id="ops-filters-section">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">Ops filters</div>
                        <div className="mt-1 text-sm text-slate-600">Filters apply to both Coverage + Calendar (and bulk invite actions).</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => copyCurrentLink().catch(() => {})}>
                          Copy link
                        </Button>
                        <Button size="sm" variant="secondary" disabled={downloadBusyKey === 'ops-shifts-filtered.csv'} onClick={() => exportOpsFilteredShiftsCsv().catch(() => {})}>
                          {downloadBusyKey === 'ops-shifts-filtered.csv' ? 'Exporting…' : 'Export CSV'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setOpsShiftFilterText('')
                            setOpsShiftFilterLocation('')
                            setOpsShiftFilterRole('')
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-6">
                      <div className="md:col-span-2">
                        <Label>Search</Label>
                        <Input value={opsShiftFilterText} onChange={(e) => setOpsShiftFilterText(e.target.value)} placeholder="cleaner, security, night…" />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Location</Label>
                        <Input value={opsShiftFilterLocation} onChange={(e) => setOpsShiftFilterLocation(e.target.value)} placeholder="Accra, Tema…" />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Role tag</Label>
                        <Select value={opsShiftFilterRole} onChange={(e) => setOpsShiftFilterRole(e.target.value)}>
                          <option value="">All</option>
                          {opsShiftRoleOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="md:col-span-6 text-xs text-slate-500">
                        Coverage: {opsCoverageFiltered.length}/{opsCoverage.length || 0} • Calendar: {opsCalFiltered.length}/{opsCalItems.length || 0}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4" id="ops-coverage-section">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">Coverage (next days)</div>
                        <div className="mt-1 text-sm text-slate-600">See upcoming shifts, open slots, and invite remaining headcount from a pool.</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={opsCoverageDays} onChange={(e) => setOpsCoverageDays(e.target.value)} disabled={opsCoverageLoading}>
                          <option value="7">Next 7</option>
                          <option value="14">Next 14</option>
                          <option value="30">Next 30</option>
                        </Select>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!opsCoverageOnlyUnfilled}
                            onChange={(e) => setOpsCoverageOnlyUnfilled(e.target.checked)}
                            disabled={opsCoverageLoading}
                          />
                          <span>Only unfilled</span>
                        </label>
                        <Select value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)} disabled={workerListsLoading || !online} title={!online ? 'Reconnect to use pools' : workerListsLoading ? 'Loading pools…' : undefined}>
                          <option value="">{workerListsLoading ? 'Loading pools…' : 'Pool (required to invite)'}</option>
                          {(Array.isArray(workerLists) ? workerLists : []).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name || 'Pool'} ({l.member_count ?? 0})
                            </option>
                          ))}
                        </Select>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => loadOpsCoverage({ daysOverride: Number(opsCoverageDays) }).catch(() => {})}
                          disabled={opsCoverageLoading}
                        >
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          disabled={opsCoverageLoading || opsCoverageBusyKey === 'bulk' || !online || !selectedListId}
                          onClick={() => inviteAllRemainingFromCoverage().catch(() => {})}
                          title={!selectedListId ? 'Pick a pool to invite from' : undefined}
                        >
                          {opsCoverageBusyKey === 'bulk'
                            ? `Inviting… ${opsCoverageBulk?.done ?? 0}/${opsCoverageBulk?.total ?? 0}`
                            : 'Invite all remaining (filtered)'}
                        </Button>
                      </div>
                    </div>

                    {opsCoverageError ? <div className="mt-2 text-sm text-red-700">{opsCoverageError}</div> : null}
                    {opsCoverageLoading && opsCoverage.length === 0 ? <div className="mt-2 text-sm text-slate-600">Loading…</div> : null}

                    {!opsCoverageLoading && opsCoverage.length === 0 ? (
                      <div className="mt-2 text-sm text-slate-600">No shifts in this window.</div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {opsCoverageFiltered.slice(0, 50).map((s) => {
                          const open = Number(s.open_slots ?? 0)
                          const head = Number(s.headcount ?? 1)
                          const active = Number(s.active_count ?? 0)
                          const soon = s.start_at ? new Date(s.start_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 : false
                          const autoOff = Boolean(s.coverage_auto_fill_disabled)
                          return (
                            <div key={s.id} className="rounded-xl border bg-white p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-900 truncate">
                                    {s.title || 'Shift'}{' '}
                                    {open > 0 ? (
                                      <span className={`ml-2 text-xs ${soon ? 'text-red-700' : 'text-amber-700'}`}>open {open}</span>
                                    ) : (
                                      <span className="ml-2 text-xs text-emerald-700">filled</span>
                                    )}
                                    {autoOff ? <span className="ml-2 text-xs text-slate-500">autopilot off</span> : null}
                                  </div>
                                  <div className="mt-0.5 text-xs text-slate-600">
                                    {s.start_at ? fmtDate(s.start_at) : '—'} → {s.end_at ? fmtDate(s.end_at) : '—'}
                                    {s.location ? ` • ${s.location}` : ''}
                                    {s.role_tag ? ` • ${s.role_tag}` : ''}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    coverage: {active}/{head} • invited: {s.invited ?? 0} • accepted: {s.accepted ?? 0} • no-shows: {s.no_shows ?? 0}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button size="sm" variant="secondary" onClick={() => openShiftFromCoverage(s.id).catch(() => {})}>
                                    Open
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!online || !selectedListId || open <= 0 || opsCoverageBusyKey === `fill:${s.id}` || opsCoverageBusyKey === 'bulk'}
                                    onClick={() => inviteRemainingFromCoverage(s.id)}
                                    title={!selectedListId ? 'Pick a pool to invite from' : open <= 0 ? 'No open slots' : undefined}
                                  >
                                    {opsCoverageBusyKey === `fill:${s.id}` ? 'Inviting…' : 'Invite remaining'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {opsCoverageFiltered.length > 50 ? <div className="text-xs text-slate-500">Showing 50 of {opsCoverageFiltered.length} filtered shifts.</div> : null}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4" id="ops-calendar-section">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">Calendar (next days)</div>
                        <div className="mt-1 text-sm text-slate-600">Day-by-day view of shifts with quick fill actions.</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={opsCalDays} onChange={(e) => setOpsCalDays(e.target.value)} disabled={opsCalLoading}>
                          <option value="7">Next 7</option>
                          <option value="14">Next 14</option>
                          <option value="30">Next 30</option>
                        </Select>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={!!opsCalOnlyUnfilled} onChange={(e) => setOpsCalOnlyUnfilled(e.target.checked)} disabled={opsCalLoading} />
                          <span>Only unfilled</span>
                        </label>
                        <Select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          disabled={workerListsLoading || !online || opsCalLoading}
                          title={!online ? 'Reconnect to use pools' : workerListsLoading ? 'Loading pools…' : undefined}
                        >
                          <option value="">{workerListsLoading ? 'Loading pools…' : 'Pool (for invites)'}</option>
                          {(Array.isArray(workerLists) ? workerLists : []).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name || 'Pool'} ({l.member_count ?? 0})
                            </option>
                          ))}
                        </Select>
                        <Button size="sm" variant="secondary" onClick={() => loadOpsCalendar({ daysOverride: Number(opsCalDays) }).catch(() => {})} disabled={opsCalLoading}>
                          {opsCalLoading ? 'Loading…' : 'Refresh'}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!online || !selectedListId || opsCalBusyKey === 'bulk' || opsCalLoading}
                          onClick={() => inviteAllRemainingFromCalendar().catch(() => {})}
                          title={!selectedListId ? 'Pick a pool to invite from' : undefined}
                        >
                          {opsCalBusyKey === 'bulk' ? `Inviting… ${opsCalBulk?.done ?? 0}/${opsCalBulk?.total ?? 0}` : 'Invite all remaining (filtered)'}
                        </Button>
                      </div>
                    </div>

                    {opsCalError ? <div className="mt-2 text-sm text-red-700">{opsCalError}</div> : null}
                    {opsCalLoading && opsCalItems.length === 0 ? <div className="mt-2 text-sm text-slate-600">Loading…</div> : null}

                    {!opsCalLoading ? (
                      (() => {
                        const days = Math.min(30, Math.max(1, Number(opsCalDays || 14)))
                        const byDay = new Map()
                        for (const it of Array.isArray(opsCalFiltered) ? opsCalFiltered : []) {
                          const k = it?.start_at ? dateKeyLocal(new Date(it.start_at)) : null
                          if (!k) continue
                          const arr = byDay.get(k) || []
                          arr.push(it)
                          byDay.set(k, arr)
                        }
                        const out = []
                        const now = new Date()
                        for (let i = 0; i < days; i++) {
                          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 0, 0, 0, 0)
                          const k = dateKeyLocal(d)
                          out.push({ key: k, date: d, items: (byDay.get(k) || []).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()) })
                        }
                        return (
                          <div className="mt-3 space-y-3">
                            {out.map((day) => {
                              const list = day.items || []
                              const openSlots = list.reduce((a, s) => a + Number(s?.open_slots ?? 0), 0)
                              return (
                                <div key={day.key} className="rounded-2xl border bg-white p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">{day.key}</div>
                                      <div className="mt-0.5 text-xs text-slate-600">
                                        shifts: {list.length} {openSlots ? `• open slots: ${openSlots}` : ''}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={!online || !selectedListId || opsCalLoading || opsCalBusyKey === 'bulk' || opsCalBusyKey === `day:${day.key}` || openSlots <= 0}
                                        onClick={() => inviteRemainingForDay(day.key, list).catch(() => {})}
                                        title={!selectedListId ? 'Pick a pool to invite from' : openSlots <= 0 ? 'No open slots' : undefined}
                                      >
                                        {opsCalBusyKey === `day:${day.key}` ? 'Inviting…' : 'Invite remaining (day)'}
                                      </Button>
                                    </div>
                                  </div>

                                  {list.length === 0 ? (
                                    <div className="mt-2 text-sm text-slate-600">No shifts.</div>
                                  ) : (
                                    <div className="mt-3 space-y-2">
                                      {list.slice(0, 20).map((s) => {
                                        const open = Number(s.open_slots ?? 0)
                                        const active = Number(s.active_count ?? 0)
                                        const head = Number(s.headcount ?? 1)
                                        const autoOff = Boolean(s.coverage_auto_fill_disabled)
                                        return (
                                          <div key={s.id} className="rounded-xl border bg-slate-50 p-3">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 truncate">
                                                  {s.title || 'Shift'}{' '}
                                                  {open > 0 ? <span className="ml-2 text-xs text-amber-700">open {open}</span> : <span className="ml-2 text-xs text-emerald-700">filled</span>}
                                                  {autoOff ? <span className="ml-2 text-xs text-slate-500">autopilot off</span> : null}
                                                </div>
                                                <div className="mt-0.5 text-xs text-slate-600">
                                                  {s.start_at ? fmtDate(s.start_at) : '—'} → {s.end_at ? fmtDate(s.end_at) : '—'}
                                                  {s.location ? ` • ${s.location}` : ''}
                                                  {s.role_tag ? ` • ${s.role_tag}` : ''}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-600">coverage: {active}/{head}</div>
                                              </div>
                                              <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => openShiftFromCoverage(s.id).catch(() => {})}>
                                                  Open
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="secondary"
                                                  disabled={
                                                    !online ||
                                                    !selectedListId ||
                                                    open <= 0 ||
                                                    opsCoverageBusyKey === `fill:${s.id}` ||
                                                    opsCoverageBusyKey === 'bulk' ||
                                                    opsCalBusyKey === 'bulk'
                                                  }
                                                  onClick={() => inviteRemainingFromCoverage(s.id)}
                                                  title={!selectedListId ? 'Pick a pool in Coverage first' : open <= 0 ? 'No open slots' : undefined}
                                                >
                                                  {opsCoverageBusyKey === `fill:${s.id}` ? 'Inviting…' : 'Invite remaining'}
                                                </Button>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                      {list.length > 20 ? <div className="text-xs text-slate-500">Showing 20 of {list.length} shifts for this day.</div> : null}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-700">Recurring shifts (weekly)</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Create templates, then create a weekly series, then generate the next 60 days of shift blocks.
                    </div>
                    {templatesError ? <div className="mt-2 text-sm text-red-700">{templatesError}</div> : null}
                    {seriesError ? <div className="mt-2 text-sm text-red-700">{seriesError}</div> : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border bg-white p-4">
                        <div className="text-xs font-semibold text-slate-700">1) Shift template</div>
                        <form onSubmit={createTemplate} className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="md:col-span-1">
                            <Label>Template name</Label>
                            <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Weekend cleaners" />
                          </div>
                          <div className="md:col-span-1">
                            <Label>Shift title</Label>
                            <Input value={tplTitle} onChange={(e) => setTplTitle(e.target.value)} placeholder="Cleaning crew" />
                          </div>
                          <div className="md:col-span-1">
                            <Label>Role tag</Label>
                            <Input value={tplRoleTag} onChange={(e) => setTplRoleTag(e.target.value)} placeholder="cleaner" />
                          </div>
                          <div className="md:col-span-1">
                            <Label>Headcount</Label>
                            <Input type="number" min="1" max="500" value={tplHeadcount} onChange={(e) => setTplHeadcount(e.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Location</Label>
                            <Input value={tplLocation} onChange={(e) => setTplLocation(e.target.value)} placeholder="Accra / Tema…" />
                          </div>
                          <div className="md:col-span-2 rounded-xl border bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700">Geo check-in (optional)</div>
                            <div className="mt-2 grid gap-2 md:grid-cols-6">
                              <label className="md:col-span-2 flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={tplGeoRequired} onChange={(e) => setTplGeoRequired(e.target.checked)} />
                                <span>Require geo check-in</span>
                              </label>
                              <div className="md:col-span-1">
                                <Label>Radius (m)</Label>
                                <Input type="number" min="50" max="50000" value={tplGeoRadiusM} onChange={(e) => setTplGeoRadiusM(e.target.value)} disabled={!tplGeoRequired} />
                              </div>
                              <div className="md:col-span-1">
                                <Label>Lat</Label>
                                <Input value={tplGeoLat} onChange={(e) => setTplGeoLat(e.target.value)} disabled={!tplGeoRequired} placeholder="5.56…" />
                              </div>
                              <div className="md:col-span-1">
                                <Label>Lng</Label>
                                <Input value={tplGeoLng} onChange={(e) => setTplGeoLng(e.target.value)} disabled={!tplGeoRequired} placeholder="-0.20…" />
                              </div>
                              <div className="md:col-span-1 flex items-end">
                                <Button type="submit" className="w-full" disabled={!canManageRecurring || tplBusy || !online} title={!canManageRecurring ? 'Only owners/ops can manage recurring settings.' : undefined}>
                                  {tplBusy ? 'Saving…' : 'Create'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </form>

                        <div className="mt-4 text-xs text-slate-600">
                          {templatesLoading ? 'Loading templates…' : templates.length ? `${templates.length} template(s)` : 'No templates yet.'}
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="text-xs font-semibold text-slate-700">2) Weekly series</div>
                        {editingSeriesId ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-slate-50 p-3">
                            <div className="text-sm text-slate-700">
                              Editing series: <span className="font-mono text-xs">{String(editingSeriesId).slice(0, 8)}</span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setEditingSeriesId('')
                                  setSeriesPreview([])
                                  setSeriesPreviewError(null)
                                }}
                              >
                                Cancel edit
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        <form onSubmit={createSeries} className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <Label>Template</Label>
                            <Select value={seriesTemplateId} onChange={(e) => setSeriesTemplateId(e.target.value)} disabled={templatesLoading}>
                              <option value="">Select…</option>
                              {templates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} — {t.title}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="md:col-span-1">
                            <Label>Start date</Label>
                            <Input type="date" value={seriesStartDate} onChange={(e) => setSeriesStartDate(e.target.value)} />
                          </div>
                          <div className="md:col-span-1">
                            <Label>End date (optional)</Label>
                            <Input type="date" value={seriesEndDate} onChange={(e) => setSeriesEndDate(e.target.value)} />
                          </div>
                          <div className="md:col-span-1">
                            <Label>Start time</Label>
                            <Input type="time" value={seriesStartTime} onChange={(e) => setSeriesStartTime(e.target.value)} />
                          </div>
                          <div className="md:col-span-1">
                            <Label>End time</Label>
                            <Input type="time" value={seriesEndTime} onChange={(e) => setSeriesEndTime(e.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Every (weeks)</Label>
                            <Input type="number" min="1" max="52" value={seriesIntervalWeeks} onChange={(e) => setSeriesIntervalWeeks(e.target.value)} />
                          </div>
                          <div className="md:col-span-2">
                            <Label>Days of week</Label>
                            <div className="mt-2 flex flex-wrap gap-3 text-sm">
                              {[
                                [0, 'Sun'],
                                [1, 'Mon'],
                                [2, 'Tue'],
                                [3, 'Wed'],
                                [4, 'Thu'],
                                [5, 'Fri'],
                                [6, 'Sat'],
                              ].map(([k, label]) => (
                                <label key={k} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={!!seriesDaysOfWeek?.[k]}
                                    onChange={(e) => setSeriesDaysOfWeek((m) => ({ ...(m || {}), [k]: e.target.checked }))}
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2 rounded-xl border bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700">Auto-invite + auto-generate (saved)</div>
                            <div className="mt-2 grid gap-2 md:grid-cols-6">
                              <label className="md:col-span-3 flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={seriesAutoFillEnabled}
                                  onChange={(e) => {
                                    const v = e.target.checked
                                    setSeriesAutoFillEnabled(v)
                                    if (!v) setSeriesAutoFillListId('')
                                  }}
                                  disabled={!canManageRecurring}
                                />
                                <span className="font-medium text-slate-900">Auto-invite from pool</span>
                              </label>
                              <label className="md:col-span-3 flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={seriesAutoGenerateEnabled}
                                  onChange={(e) => setSeriesAutoGenerateEnabled(e.target.checked)}
                                  disabled={!canManageRecurring}
                                />
                                <span className="font-medium text-slate-900">Auto-generate in background</span>
                              </label>

                              {seriesAutoFillEnabled ? (
                                <>
                                  <div className="md:col-span-3">
                                    <Label>Worker pool</Label>
                                    <Select
                                      value={seriesAutoFillListId}
                                      onChange={(e) => setSeriesAutoFillListId(e.target.value)}
                                      disabled={workerListsLoading}
                                      title={workerListsLoading ? 'Loading pools…' : undefined}
                                    >
                                      <option value="">Select…</option>
                                      {workerLists.map((l) => (
                                        <option key={l.id} value={l.id}>
                                          {l.name} ({l.member_count ?? 0})
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label>Invite rule</Label>
                                    <Select value={seriesAutoFillMode} onChange={(e) => setSeriesAutoFillMode(e.target.value)} disabled={!canManageRecurring}>
                                      <option value="headcount">Fill to headcount</option>
                                      <option value="count">Invite a fixed count</option>
                                    </Select>
                                  </div>
                                  <div className="md:col-span-1">
                                    <Label>#</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="200"
                                      value={seriesAutoFillCount}
                                      onChange={(e) => setSeriesAutoFillCount(e.target.value)}
                                      disabled={!canManageRecurring || seriesAutoFillMode !== 'count'}
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="md:col-span-6 text-xs text-slate-600">
                                  If enabled, blocked workers are excluded and preferred workers are invited first.
                                </div>
                              )}

                              {seriesAutoGenerateEnabled ? (
                                <div className="md:col-span-2">
                                  <Label>Generate days ahead</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="90"
                                    value={seriesAutoGenerateDays}
                                    onChange={(e) => setSeriesAutoGenerateDays(e.target.value)}
                                    disabled={!canManageRecurring}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <Button disabled={!canManageRecurring || seriesBusy || !online} title={!canManageRecurring ? 'Only owners/ops can manage recurring settings.' : undefined}>
                              {seriesBusy ? 'Saving…' : !online ? 'Offline' : editingSeriesId ? 'Save changes' : 'Create series'}
                            </Button>
                          </div>
                        </form>

                        <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-700">Generate shift blocks</div>
                          <div className="mt-2 text-xs text-slate-500">
                            Auto-invite rules are now saved on each series (create a series with auto-invite enabled, then click Generate).
                          </div>
                          <div className="mt-2 space-y-2">
                            {seriesLoading ? (
                              <div className="text-sm text-slate-600">Loading series…</div>
                            ) : series.length === 0 ? (
                              <div className="text-sm text-slate-600">No series yet.</div>
                            ) : (
                              series.slice(0, 10).map((s) => (
                                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900">{s.template_name || 'Series'}</div>
                                    <div className="text-xs text-slate-600">
                                      {String(s.status || 'active')} • every {s.interval_weeks || 1} week(s) • {String(s.start_time)}→{String(s.end_time)}
                                      {s.auto_fill_list_id ? <span className="text-slate-500"> • auto-invite</span> : null}
                                      {s.auto_generate_enabled ? <span className="text-slate-500"> • auto-generate</span> : null}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="secondary" disabled={seriesBusy || !canManageRecurring} title={!canManageRecurring ? 'Only owners/ops can manage recurring settings.' : undefined} onClick={() => startEditingSeries(s)}>
                                      Edit
                                    </Button>
                                    <Button size="sm" variant="secondary" disabled={seriesBusy || !canManageRecurring} title={!canManageRecurring ? 'Only owners/ops can manage recurring settings.' : undefined} onClick={() => toggleSeriesStatus(s)}>
                                      {String(s.status || 'active') === 'active' ? 'Pause' : 'Resume'}
                                    </Button>
                                    <Button size="sm" variant="secondary" disabled={seriesBusy || !online} onClick={() => generateSeries(s.id, 60)}>
                                      Generate 60d
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="mt-3 text-xs text-slate-500">Tip: generating is safe to run multiple times (it won’t duplicate).</div>
                        </div>

                        {editingSeriesId ? (
                          <div className="mt-3 rounded-xl border bg-slate-50 p-3">
                            <div className="text-xs font-semibold text-slate-700">Preview next 14 days</div>
                            {seriesPreviewError ? <div className="mt-2 text-sm text-red-700">{seriesPreviewError}</div> : null}
                            {seriesPreviewLoading ? (
                              <div className="mt-2 text-sm text-slate-600">Loading preview…</div>
                            ) : seriesPreview.length === 0 ? (
                              <div className="mt-2 text-sm text-slate-600">No occurrences in this window.</div>
                            ) : (
                              <div className="mt-2 space-y-2">
                                {seriesPreview.slice(0, 30).map((it) => (
                                  <div key={it.on_date} className="rounded-xl border bg-white p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-semibold text-slate-900">{it.on_date}</div>
                                      <div className="text-xs text-slate-600">
                                        {it.skipped ? 'Skipped' : it.already_generated ? 'Generated' : 'Planned'}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-600">
                                      {String(it.start_at || '').replace('T', ' ').slice(0, 16)} → {String(it.end_at || '').replace('T', ' ').slice(0, 16)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}

                        <div className="mt-3 rounded-xl border bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-700">Skip a date</div>
                          <form onSubmit={skipSeriesDate} className="mt-2 grid gap-2 md:grid-cols-3">
                            <div className="md:col-span-2">
                              <Label>Series</Label>
                              <Select value={skipSeriesId} onChange={(e) => setSkipSeriesId(e.target.value)}>
                                <option value="">Select…</option>
                                {series.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.template_name || s.id}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="md:col-span-1">
                              <Label>Date</Label>
                              <Input type="date" value={skipDate} onChange={(e) => setSkipDate(e.target.value)} />
                            </div>
                            <div className="md:col-span-3">
                              <Button size="sm" variant="secondary" disabled={seriesBusy || !online}>
                                Save skip
                              </Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-700">Workforce overview</div>
                    {workforceError ? <div className="mt-2 text-sm text-red-700">{workforceError}</div> : null}
                    {!workforceOverview && workforceLoading ? (
                      <div className="mt-2 text-sm text-slate-600">Loading…</div>
                    ) : workforceOverview ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border bg-white p-4">
                          <div className="text-xs text-slate-600">Today shifts</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{workforceOverview?.today?.shifts ?? 0}</div>
                        </div>
                        <div className="rounded-2xl border bg-white p-4">
                          <div className="text-xs text-slate-600">Today assigned</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{workforceOverview?.today?.assignments ?? 0}</div>
                        </div>
                        <div className="rounded-2xl border bg-white p-4">
                          <div className="text-xs text-slate-600">Today checked in</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{workforceOverview?.today?.by_status?.checked_in ?? 0}</div>
                          <div className="text-xs text-slate-500">
                            + checked out/completed: {(workforceOverview?.today?.by_status?.checked_out ?? 0) + (workforceOverview?.today?.by_status?.completed ?? 0)}
                          </div>
                        </div>
                        <div className="rounded-2xl border bg-white p-4">
                          <div className="text-xs text-slate-600">Today no-shows</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{workforceOverview?.today?.by_status?.no_show ?? 0}</div>
                        </div>

                        <div className="rounded-2xl border bg-white p-4 md:col-span-2">
                          <div className="text-xs text-slate-600">Last 30 days</div>
                          <div className="mt-2 grid grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs text-slate-500">Shifts</div>
                              <div className="text-lg font-semibold text-slate-900">{workforceOverview?.totals?.shifts ?? 0}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Assignments</div>
                              <div className="text-lg font-semibold text-slate-900">{workforceOverview?.totals?.assignments ?? 0}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">No-shows</div>
                              <div className="text-lg font-semibold text-slate-900">{workforceOverview?.totals?.by_status?.no_show ?? 0}</div>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border bg-white p-4 md:col-span-2">
                          <div className="text-xs text-slate-600">Outcomes (last 30 days)</div>
                          <div className="mt-2 grid grid-cols-3 gap-3">
                            <div>
                              <div className="text-xs text-slate-500">Accepted</div>
                              <div className="text-lg font-semibold text-slate-900">{workforceOverview?.totals?.by_status?.accepted ?? 0}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Checked in</div>
                              <div className="text-lg font-semibold text-slate-900">
                                {(workforceOverview?.totals?.by_status?.checked_in ?? 0) +
                                  (workforceOverview?.totals?.by_status?.checked_out ?? 0) +
                                  (workforceOverview?.totals?.by_status?.completed ?? 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Completed</div>
                              <div className="text-lg font-semibold text-slate-900">{workforceOverview?.totals?.by_status?.completed ?? 0}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-600">No metrics yet.</div>
                    )}
                  </div>

                  <form onSubmit={createShift} className="mt-4 grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <Label>Title</Label>
                      <Input value={shiftTitle} onChange={(e) => setShiftTitle(e.target.value)} placeholder="Weekend cleaning crew" />
                    </div>
                    <div className="md:col-span-1">
                      <Label>Role tag</Label>
                      <Input value={shiftRoleTag} onChange={(e) => setShiftRoleTag(e.target.value)} placeholder="cleaner" />
                    </div>
                    <div className="md:col-span-1">
                      <Label>Headcount</Label>
                      <Input type="number" min="1" max="500" value={shiftHeadcount} onChange={(e) => setShiftHeadcount(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Location</Label>
                      <Input value={shiftLoc} onChange={(e) => setShiftLoc(e.target.value)} placeholder="Accra / Tema…" />
                    </div>
                    {departments.length > 0 ? (
                      <div className="md:col-span-2">
                        <Label>Department</Label>
                        <Select value={shiftDepartmentId} onChange={(e) => setShiftDepartmentId(e.target.value)}>
                          <option value="">—</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </Select>
                      </div>
                    ) : null}
                    <div className="md:col-span-3">
                      <Label>Start</Label>
                      <Input type="datetime-local" value={shiftStartAt} onChange={(e) => setShiftStartAt(e.target.value)} />
                    </div>
                    <div className="md:col-span-3">
                      <Label>End</Label>
                      <Input type="datetime-local" value={shiftEndAt} onChange={(e) => setShiftEndAt(e.target.value)} />
                    </div>
                    <div className="md:col-span-6 rounded-2xl border bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">On-site geo check-in (optional)</div>
                      <div className="mt-1 text-xs text-slate-600">
                        If enabled, workers must be within the radius to check in. (Works alongside code check-in.)
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-6">
                        <label className="md:col-span-2 flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={shiftGeoRequired} onChange={(e) => setShiftGeoRequired(e.target.checked)} />
                          <span>Require geo check-in</span>
                        </label>
                        <div className="md:col-span-1">
                          <Label>Radius (m)</Label>
                          <Input
                            type="number"
                            min="50"
                            max="50000"
                            value={shiftGeoRadiusM}
                            onChange={(e) => setShiftGeoRadiusM(e.target.value)}
                            disabled={!shiftGeoRequired}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <Label>Lat</Label>
                          <Input value={shiftGeoLat} onChange={(e) => setShiftGeoLat(e.target.value)} disabled={!shiftGeoRequired} placeholder="5.56…" />
                        </div>
                        <div className="md:col-span-1">
                          <Label>Lng</Label>
                          <Input value={shiftGeoLng} onChange={(e) => setShiftGeoLng(e.target.value)} disabled={!shiftGeoRequired} placeholder="-0.20…" />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                          <Button type="button" variant="secondary" disabled={!shiftGeoRequired} onClick={useMyLocationForNewShift}>
                            Use my location
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="md:col-span-6">
                      <Button disabled={shiftBusy || !online}>{shiftBusy ? 'Saving…' : !online ? 'Offline' : 'Create shift'}</Button>
                    </div>
                  </form>

                  {shiftsError ? <div className="mt-3 text-sm text-red-700">{shiftsError}</div> : null}
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">Shifts</div>
                      {shiftsLoading ? (
                        <div className="mt-2 text-sm text-slate-600">Loading…</div>
                      ) : shifts.length === 0 ? (
                        <div className="mt-2 text-sm text-slate-600">No shifts yet.</div>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {shifts.slice(0, 30).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedShiftId(s.id)
                                loadShiftDetail(s.id).catch(() => {})
                              }}
                              className={[
                                'w-full rounded-xl border bg-white p-3 text-left hover:bg-slate-50',
                                selectedShiftId === s.id ? 'border-slate-900' : 'border-slate-200',
                              ].join(' ')}
                            >
                              <div className="text-sm font-semibold text-slate-900">{s.title}</div>
                              <div className="mt-1 text-xs text-slate-600">
                                {fmtDate(s.start_at)} → {fmtDate(s.end_at)} • headcount: {s.headcount} • assigned: {s.assigned ?? 0}
                                {s.department_id && departments.find((d) => d.id === s.department_id) ? (
                                  <span> • {departments.find((d) => d.id === s.department_id).name}</span>
                                ) : null}
                                {s.checkin_enabled ? <span className="text-slate-500"> • code check-in</span> : null}
                                {s.checkin_geo_required ? <span className="text-slate-500"> • geo check-in</span> : null}
                              </div>
                            </button>
                          ))}
                          {shifts.length > 30 ? <div className="text-xs text-slate-500">Showing 30 of {shifts.length}.</div> : null}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">Shift detail</div>
                      {!selectedShiftId ? (
                        <div className="mt-2 text-sm text-slate-600">Select a shift to manage assignments.</div>
                      ) : shiftDetailLoading ? (
                        <div className="mt-2 text-sm text-slate-600">Loading…</div>
                      ) : !shiftDetail ? (
                        <div className="mt-2 text-sm text-slate-600">No detail.</div>
                      ) : (
                        <>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{shiftDetail?.shift?.title}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {fmtDate(shiftDetail?.shift?.start_at)} → {fmtDate(shiftDetail?.shift?.end_at)}
                          </div>

                          <div className="mt-3 rounded-xl border bg-white p-3">
                            <div className="text-xs font-semibold text-slate-700">Autopilot</div>
                            <div className="mt-1 text-xs text-slate-500">Exclude this shift from background auto-invites.</div>
                            <label className="mt-2 flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={!!shiftDetail?.shift?.coverage_auto_fill_disabled}
                                onChange={(e) => setShiftAutofillDisabled(shiftDetail.shift.id, e.target.checked)}
                                disabled={!online || shiftBusy || !canUseOps}
                              />
                              <span className="font-medium text-slate-900">Disable autopilot for this shift</span>
                            </label>
                          </div>

                          <div className="mt-3 rounded-xl border bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-semibold text-slate-700">Edit shift</div>
                                <div className="mt-1 text-xs text-slate-500">Editing is restricted after the shift starts.</div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" disabled={!online || shiftBusy || String(shiftDetail?.shift?.status) === 'cancelled'} onClick={cancelShift}>
                                  Cancel shift
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <Label>Title</Label>
                                <Input value={shiftEditTitle} onChange={(e) => setShiftEditTitle(e.target.value)} disabled={shiftBusy || !online} />
                              </div>
                              <div className="md:col-span-1">
                                <Label>Role tag</Label>
                                <Input value={shiftEditRoleTag} onChange={(e) => setShiftEditRoleTag(e.target.value)} disabled={shiftBusy || !online} placeholder="cleaner" />
                              </div>
                              <div className="md:col-span-1">
                                <Label>Headcount</Label>
                                <Input type="number" min="1" max="500" value={shiftEditHeadcount} onChange={(e) => setShiftEditHeadcount(e.target.value)} disabled={shiftBusy || !online} />
                              </div>
                              <div className="md:col-span-2">
                                <Label>Location</Label>
                                <Input value={shiftEditLocation} onChange={(e) => setShiftEditLocation(e.target.value)} disabled={shiftBusy || !online} placeholder="Accra / Tema…" />
                              </div>
                              {departments.length > 0 ? (
                                <div className="md:col-span-2">
                                  <Label>Department</Label>
                                  <Select value={shiftEditDepartmentId} onChange={(e) => setShiftEditDepartmentId(e.target.value)} disabled={shiftBusy || !online}>
                                    <option value="">—</option>
                                    {departments.map((d) => (
                                      <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                  </Select>
                                </div>
                              ) : null}
                              <div className="md:col-span-1">
                                <Label>Start</Label>
                                <Input type="datetime-local" value={shiftEditStartAt} onChange={(e) => setShiftEditStartAt(e.target.value)} disabled={shiftBusy || !online} />
                              </div>
                              <div className="md:col-span-1">
                                <Label>End</Label>
                                <Input type="datetime-local" value={shiftEditEndAt} onChange={(e) => setShiftEditEndAt(e.target.value)} disabled={shiftBusy || !online} />
                              </div>
                              <div className="md:col-span-2 flex justify-end">
                                <Button disabled={!online || shiftBusy || !shiftEditTitle.trim()} onClick={saveShiftEdits}>
                                  {shiftBusy ? 'Saving…' : 'Save changes'}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-700">Check-in code (QR/code)</div>
                                <div className="mt-1 text-sm text-slate-700">
                                  {shiftDetail?.shift?.checkin_enabled ? (
                                    <>
                                      Enabled
                                      {checkinCodeByShiftId?.[shiftDetail.shift.id] ? (
                                        <>
                                          {' '}
                                          • code:{' '}
                                          <span className="font-mono font-semibold tracking-widest text-slate-900">
                                            {checkinCodeByShiftId[shiftDetail.shift.id]}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="text-slate-500"> • rotate to display the current code</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-slate-500">Disabled</span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Use this for on-site attendance: display the code and have workers check in from “My shifts”.
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => rotateCheckinCode(shiftDetail.shift.id)}
                                  disabled={checkinBusyShiftId === shiftDetail.shift.id || !online}
                                >
                                  {checkinBusyShiftId === shiftDetail.shift.id ? 'Working…' : shiftDetail?.shift?.checkin_enabled ? 'Rotate code' : 'Enable + generate'}
                                </Button>
                                {shiftDetail?.shift?.checkin_enabled ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => disableCheckinCode(shiftDetail.shift.id)}
                                    disabled={checkinBusyShiftId === shiftDetail.shift.id || !online}
                                  >
                                    Disable
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-700">Autopilot</div>
                                <div className="mt-1 text-sm text-slate-700">
                                  {shiftDetail?.shift?.coverage_auto_fill_disabled ? (
                                    <span className="text-amber-700">Excluded from autopilot invites</span>
                                  ) : (
                                    <span className="text-emerald-700">Eligible for autopilot invites</span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">Use this if a shift must be staffed manually (VIP, sensitive roles, etc.).</div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!online || shiftBusy}
                                  onClick={() => setShiftAutofillDisabled(shiftDetail.shift.id, !shiftDetail?.shift?.coverage_auto_fill_disabled)}
                                >
                                  {shiftBusy ? 'Working…' : shiftDetail?.shift?.coverage_auto_fill_disabled ? 'Allow autopilot' : 'Exclude from autopilot'}
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border bg-white p-3">
                            <div className="text-xs font-semibold text-slate-700">Geo check-in</div>
                            <div className="mt-1 text-xs text-slate-600">
                              If enabled, workers must be near the shift location to check in.
                            </div>
                            {(() => {
                              const sid = shiftDetail?.shift?.id
                              const base = shiftDetail?.shift ?? {}
                              const d = geoCheckinDraftByShiftId?.[sid] ?? {
                                required: !!base.checkin_geo_required,
                                radius_m: base.checkin_geo_radius_m ?? 250,
                                lat: base.checkin_geo_lat ?? '',
                                lng: base.checkin_geo_lng ?? '',
                              }
                              const busy = checkinBusyShiftId === sid
                              return (
                                <div className="mt-3 grid gap-2 md:grid-cols-6">
                                  <label className="md:col-span-2 flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={!!d.required}
                                      onChange={(e) =>
                                        setGeoCheckinDraftByShiftId((m) => ({ ...(m || {}), [sid]: { ...(m?.[sid] || d), required: e.target.checked } }))
                                      }
                                    />
                                    <span>Require geo check-in</span>
                                  </label>
                                  <div className="md:col-span-1">
                                    <Label>Radius (m)</Label>
                                    <Input
                                      type="number"
                                      min="50"
                                      max="50000"
                                      value={d.radius_m ?? ''}
                                      disabled={!d.required}
                                      onChange={(e) =>
                                        setGeoCheckinDraftByShiftId((m) => ({ ...(m || {}), [sid]: { ...(m?.[sid] || d), radius_m: e.target.value } }))
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <Label>Lat</Label>
                                    <Input
                                      value={d.lat ?? ''}
                                      disabled={!d.required}
                                      onChange={(e) =>
                                        setGeoCheckinDraftByShiftId((m) => ({ ...(m || {}), [sid]: { ...(m?.[sid] || d), lat: e.target.value } }))
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <Label>Lng</Label>
                                    <Input
                                      value={d.lng ?? ''}
                                      disabled={!d.required}
                                      onChange={(e) =>
                                        setGeoCheckinDraftByShiftId((m) => ({ ...(m || {}), [sid]: { ...(m?.[sid] || d), lng: e.target.value } }))
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-1 flex items-end gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      disabled={busy || !online}
                                      onClick={() => saveGeoCheckin(sid)}
                                    >
                                      {busy ? 'Saving…' : 'Save'}
                                    </Button>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>

                          <div className="mt-4 rounded-xl border bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-700">Assign workers from selected pool</div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="w-24">
                                  <Input
                                    value={fillCount}
                                    onChange={(e) => setFillCount(e.target.value)}
                                    type="number"
                                    min="1"
                                    max="200"
                                    placeholder="Count"
                                    aria-label="Invite count"
                                  />
                                </div>
                                <Button size="sm" variant="secondary" onClick={fillRemainingToHeadcount} disabled={shiftBusy || !online || !selectedListId}>
                                  {shiftBusy
                                    ? 'Working…'
                                    : (() => {
                                        const { holes } = staffingHolesForShift(shiftDetail)
                                        return holes > 0 ? `Fill remaining (${holes})` : 'Fill remaining'
                                      })()}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={replaceNoShows} disabled={shiftBusy || !online || !selectedListId}>
                                  {shiftBusy
                                    ? 'Working…'
                                    : (() => {
                                        const { noShows } = staffingHolesForShift(shiftDetail)
                                        return noShows > 0 ? `Replace no-shows (${noShows})` : 'Replace no-shows'
                                      })()}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={fillFromSelectedPool} disabled={shiftBusy || !online || !selectedListId}>
                                  {shiftBusy ? 'Working…' : 'Fill from pool'}
                                </Button>
                                <Button size="sm" variant="secondary" onClick={assignWorkersToShift} disabled={shiftBusy || !online}>
                                  {shiftBusy ? 'Working…' : 'Invite selected'}
                                </Button>
                              </div>
                            </div>
                            {!selectedListId ? (
                              <div className="mt-2 text-sm text-slate-600">Select a worker pool first.</div>
                            ) : workers.length === 0 ? (
                              <div className="mt-2 text-sm text-slate-600">No workers in pool.</div>
                            ) : (
                              <div className="mt-2 max-h-48 overflow-auto space-y-2">
                                {workers.slice(0, 40).map((w) => (
                                  <label key={w.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                                    <span className="truncate">{w.name ?? 'Worker'}</span>
                                    <input
                                      type="checkbox"
                                      checked={!!assignSelected[w.id]}
                                      onChange={(e) => setAssignSelected((m) => ({ ...(m || {}), [w.id]: e.target.checked }))}
                                    />
                                  </label>
                                ))}
                                {workers.length > 40 ? <div className="text-xs text-slate-500">Showing 40 of {workers.length}.</div> : null}
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-slate-700">Assignments</div>
                              {shiftDetail?.assignments?.length ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <Select value={assignmentBulkStatus} onChange={(e) => setAssignmentBulkStatus(e.target.value)} disabled={assignmentBulkBusy}>
                                    {['invited', 'accepted', 'declined', 'checked_in', 'checked_out', 'completed', 'no_show', 'cancelled'].map((s) => (
                                      <option key={s} value={s}>
                                        Set selected → {s}
                                      </option>
                                    ))}
                                  </Select>
                                  <Button size="sm" variant="secondary" disabled={assignmentBulkBusy || !online} onClick={bulkSetAssignmentStatus}>
                                    {assignmentBulkBusy ? 'Working…' : 'Apply'}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            {shiftDetail?.assignments?.length ? (
                              <div className="mt-2 space-y-2">
                                {shiftDetail.assignments.map((a) => {
                                  const busyKey = `${shiftDetail.shift?.id}:${a.worker_user_id}`
                                  const checked = !!assignmentBulkSelected?.[a.worker_user_id]
                                  return (
                                    <div key={a.id} className="rounded-xl border bg-white p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(e) => setAssignmentBulkSelected((m) => ({ ...(m || {}), [a.worker_user_id]: e.target.checked }))}
                                              aria-label="Select assignment"
                                            />
                                            <div className="text-sm font-semibold text-slate-900">{a.worker_name ?? 'Worker'}</div>
                                          </div>
                                          <div className="mt-1 text-xs text-slate-600">status: {a.status}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Select
                                            value={a.status}
                                            disabled={assignmentBusyKey === busyKey}
                                            onChange={(e) => setAssignmentStatus(shiftDetail.shift.id, a.worker_user_id, e.target.value)}
                                          >
                                            {['invited', 'accepted', 'declined', 'checked_in', 'checked_out', 'completed', 'no_show', 'cancelled'].map((s) => (
                                              <option key={s} value={s}>
                                                {s}
                                              </option>
                                            ))}
                                          </Select>
                                          <Button size="sm" variant="secondary" disabled={assignmentBusyKey === busyKey} onClick={() => loadShiftDetail(shiftDetail.shift.id)}>
                                            {assignmentBusyKey === busyKey ? 'Saving…' : 'Refresh'}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="mt-2 text-sm text-slate-600">No assigned workers yet.</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {tab === 'payroll' ? (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Payroll (beta)</div>
                    <div className="mt-1 text-sm text-slate-600">
                      This is a lightweight payroll toolkit. It uses configurable % deductions (not full UK PAYE rules yet).
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => loadPayroll().catch(() => {})} disabled={payrollLoading}>
                    {payrollLoading ? 'Loading…' : 'Refresh'}
                  </Button>
                </div>
                {payrollError ? <div className="mt-3 text-sm text-red-700">{payrollError}</div> : null}
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Settings</div>
                {payrollSettings?.updated_at ? (
                  <div className="mt-1 text-xs text-slate-500">Last updated: {fmtDate(payrollSettings.updated_at)}</div>
                ) : null}
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div>
                    <Label>Currency</Label>
                    <Input value={psCurrency} onChange={(e) => setPsCurrency(e.target.value)} placeholder="GHS / GBP" />
                  </div>
                  <div>
                    <Label>Tax %</Label>
                    <Input type="number" min="0" max="100" value={psTaxPct} onChange={(e) => setPsTaxPct(e.target.value)} />
                  </div>
                  <div>
                    <Label>NI %</Label>
                    <Input type="number" min="0" max="100" value={psNiPct} onChange={(e) => setPsNiPct(e.target.value)} />
                  </div>
                  <div>
                    <Label>Pension %</Label>
                    <Input type="number" min="0" max="100" value={psPensionPct} onChange={(e) => setPsPensionPct(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <Button disabled={psBusy || !online} onClick={savePayrollSettings} title={!online ? 'Reconnect to save' : undefined}>
                    {psBusy ? 'Saving…' : !online ? 'Offline' : 'Save settings'}
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Employees</div>
                <div className="mt-3 grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label>Full name</Label>
                    <Input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Email (optional)</Label>
                    <Input value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} placeholder="jane@company.com" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Phone (optional)</Label>
                    <Input value={empPhone} onChange={(e) => setEmpPhone(e.target.value)} placeholder="+44…" />
                  </div>
                  <div className="md:col-span-2">
                    <Label>LocalLink User ID (optional)</Label>
                    <Input value={empUserId} onChange={(e) => setEmpUserId(e.target.value)} placeholder="uuid…" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Pay basis</Label>
                    <Select value={empPayBasis} onChange={(e) => setEmpPayBasis(e.target.value)}>
                      <option value="salary">Salary</option>
                      <option value="hourly">Hourly</option>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label>Pay period</Label>
                    <Select value={empPayPeriod} onChange={(e) => setEmpPayPeriod(e.target.value)}>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                      <option value="day">Day</option>
                      <option value="shift">Shift</option>
                      <option value="hour">Hour</option>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label>{empPayBasis === 'hourly' ? 'Rate / hour' : 'Salary amount'}</Label>
                    <Input type="number" min="0" value={empPayRate} onChange={(e) => setEmpPayRate(e.target.value)} placeholder="0" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Tax code (optional)</Label>
                    <Input value={empTaxCode} onChange={(e) => setEmpTaxCode(e.target.value)} placeholder="1257L" />
                  </div>
                  <div className="md:col-span-6">
                    <Button disabled={empBusy || !online} onClick={addEmployee} title={!online ? 'Reconnect to add' : undefined}>
                      {empBusy ? 'Adding…' : !online ? 'Offline' : 'Add employee'}
                    </Button>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {payrollEmployees.length === 0 ? (
                    <div className="text-sm text-slate-600">No employees yet.</div>
                  ) : (
                    payrollEmployees.slice(0, 50).map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{e.full_name || e.user_name || e.email || 'Employee'}</div>
                          <div className="mt-0.5 text-xs text-slate-600">
                            {e.active ? 'active' : 'inactive'} • {e.pay_basis} • {e.pay_rate} / {e.pay_period}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" disabled={!e.active} onClick={() => deactivateEmployee(e.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  {payrollEmployees.length > 50 ? <div className="text-xs text-slate-500">Showing 50 of {payrollEmployees.length}.</div> : null}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-sm font-semibold">Create pay run (draft)</div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Period start</Label>
                    <Input type="date" value={runStart} onChange={(e) => setRunStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>Period end</Label>
                    <Input type="date" value={runEnd} onChange={(e) => setRunEnd(e.target.value)} />
                  </div>
                  <div>
                    <Label>Pay date (optional)</Label>
                    <Input type="date" value={runPayDate} onChange={(e) => setRunPayDate(e.target.value)} />
                  </div>
                </div>

                {payrollEmployees.some((e) => e.active && String(e.pay_basis) === 'hourly') ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-700">Hours (hourly employees)</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {payrollEmployees
                        .filter((e) => e.active && String(e.pay_basis) === 'hourly')
                        .slice(0, 20)
                        .map((e) => (
                          <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3">
                            <div className="min-w-0 text-sm font-semibold text-slate-900 truncate">{e.full_name || e.user_name || 'Employee'}</div>
                            <div className="w-28">
                              <Input
                                type="number"
                                min="0"
                                value={hoursByEmpId?.[e.id] ?? ''}
                                onChange={(ev) => setHoursByEmpId((m) => ({ ...(m || {}), [e.id]: ev.target.value === '' ? '' : Number(ev.target.value) }))}
                                placeholder="hours"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                    {payrollEmployees.filter((e) => e.active && String(e.pay_basis) === 'hourly').length > 20 ? (
                      <div className="mt-2 text-xs text-slate-500">Showing 20 hourly employees.</div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button disabled={runBusy || !online} onClick={createPayRun} title={!online ? 'Reconnect to run' : undefined}>
                    {runBusy ? 'Working…' : !online ? 'Offline' : 'Create draft run'}
                  </Button>
                  {lastRun?.run?.id ? (
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={downloadBusyKey === `payroll-${String(lastRun.run.id).slice(0, 8)}.csv` || !online}
                      onClick={() =>
                        downloadAuthedCsv(
                          `/corporate/company/payroll/runs/${encodeURIComponent(lastRun.run.id)}/export.csv`,
                          `payroll-${String(lastRun.run.id).slice(0, 8)}.csv`,
                        )
                      }
                      title={!online ? 'Reconnect to download' : undefined}
                    >
                      {downloadBusyKey === `payroll-${String(lastRun.run.id).slice(0, 8)}.csv` ? 'Downloading…' : 'Download CSV'}
                    </Button>
                  ) : null}
                </div>

                {lastRun?.items?.length ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="text-xs font-semibold text-slate-700">Run summary</div>
                    <div className="mt-2 grid gap-2 md:grid-cols-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Employees</div>
                        <div className="font-semibold">{lastRun.items.length}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Gross total</div>
                        <div className="font-semibold">
                          {Number(lastRun.items.reduce((a, x) => a + Number(x.gross_pay ?? 0), 0)).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Deductions total</div>
                        <div className="font-semibold">
                          {Number(
                            lastRun.items.reduce(
                              (a, x) => a + Number(x.tax_deduction ?? 0) + Number(x.ni_deduction ?? 0) + Number(x.pension_deduction ?? 0),
                              0,
                            ),
                          ).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Net total</div>
                        <div className="font-semibold">
                          {Number(lastRun.items.reduce((a, x) => a + Number(x.net_pay ?? 0), 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : null}

          {tab === 'insights' ? (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Enterprise analytics</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Workforce cost and operational metrics. Last {analytics?.window_days ?? 30} days.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => loadCompanyAnalytics(Number(wfDays || 30)).catch(() => {})}
                      disabled={analyticsLoading}
                    >
                      {analyticsLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                  </div>
                </div>
                {analyticsError ? <div className="mt-3 text-sm text-red-700">{analyticsError}</div> : null}
                {analytics ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-600">Shifts</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{analytics.workforce?.shifts_total ?? 0}</div>
                      <div className="mt-0.5 text-xs text-slate-500">in period</div>
                    </div>
                    <div className="rounded-xl border bg-emerald-50 p-4">
                      <div className="text-xs font-semibold text-emerald-700">Completed</div>
                      <div className="mt-1 text-2xl font-semibold text-emerald-800">{analytics.workforce?.shifts_completed ?? 0}</div>
                      <div className="mt-0.5 text-xs text-emerald-600">assignments</div>
                    </div>
                    <div className="rounded-xl border bg-amber-50 p-4">
                      <div className="text-xs font-semibold text-amber-700">No-shows</div>
                      <div className="mt-1 text-2xl font-semibold text-amber-800">{analytics.workforce?.no_shows_total ?? 0}</div>
                      <div className="mt-0.5 text-xs text-amber-600">impact</div>
                    </div>
                    <div className="rounded-xl border bg-blue-50 p-4">
                      <div className="text-xs font-semibold text-blue-700">Preferred</div>
                      <div className="mt-1 text-2xl font-semibold text-blue-800">{analytics.workforce?.preferred_count ?? 0}</div>
                      <div className="mt-0.5 text-xs text-blue-600">workers</div>
                    </div>
                    <div className="rounded-xl border bg-indigo-50 p-4">
                      <div className="text-xs font-semibold text-indigo-700">In pools</div>
                      <div className="mt-1 text-2xl font-semibold text-indigo-800">{analytics.workforce?.workers_in_pools ?? 0}</div>
                      <div className="mt-0.5 text-xs text-indigo-600">unique workers</div>
                    </div>
                  </div>
                ) : analyticsLoading ? (
                  <div className="mt-4 text-sm text-slate-600">Loading…</div>
                ) : null}
                {analytics?.budgets?.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-700">Active budgets</div>
                    <div className="mt-2 space-y-2">
                      {analytics.budgets.slice(0, 5).map((b) => {
                        const pct = b.utilisation_pct ?? 0
                        const alertClass = pct >= 100 ? 'border-red-300 bg-red-50' : pct >= 80 ? 'border-amber-300 bg-amber-50' : ''
                        return (
                          <div key={b.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${alertClass || 'border-slate-200 bg-white'}`}>
                            <span>
                              {b.period_start} → {b.period_end}
                              {pct >= 100 ? <span className="ml-2 text-xs font-semibold text-red-700">Over budget</span> : pct >= 80 ? <span className="ml-2 text-xs font-semibold text-amber-700">Near limit</span> : null}
                            </span>
                            <span>
                              ₵{Number(b.spent_ghs).toLocaleString()} / ₵{Number(b.budget_limit_ghs).toLocaleString()} ({pct}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </Card>

              {canViewDepartments ? (
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Departments & Budgets</div>
                      <div className="mt-1 text-sm text-slate-600">
                        Track sites and workforce spend limits. Create departments, then add budgets for each period.
                      </div>
                    </div>
                  </div>
                  {departmentsError ? <div className="mt-3 text-sm text-red-700">{departmentsError}</div> : null}
                  {budgetsError ? <div className="mt-2 text-sm text-red-700">{budgetsError}</div> : null}
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700">Departments</div>
                      {canManageDepartments ? (
                        <div className="flex flex-wrap gap-2">
                          <Input
                            value={deptName}
                            onChange={(e) => setDeptName(e.target.value)}
                            placeholder="Name (e.g. Site A)"
                            className="flex-1 min-w-[120px]"
                          />
                          <Input
                            value={deptSlug}
                            onChange={(e) => setDeptSlug(e.target.value)}
                            placeholder="Slug (optional)"
                            className="flex-1 min-w-[80px]"
                          />
                          <Input
                            value={deptLocation}
                            onChange={(e) => setDeptLocation(e.target.value)}
                            placeholder="Location (optional)"
                            className="flex-1 min-w-[120px]"
                          />
                          <Button size="sm" onClick={saveDepartment} disabled={departmentsBusy}>
                            {departmentsBusy ? '…' : editingDeptId ? 'Update' : 'Add'}
                          </Button>
                          {editingDeptId ? (
                            <Button size="sm" variant="secondary" onClick={() => { setEditingDeptId(null); setDeptName(''); setDeptSlug(''); setDeptLocation(''); }}>
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {departmentsLoading ? (
                        <div className="text-sm text-slate-600">Loading…</div>
                      ) : departments.length === 0 ? (
                        <div className="text-sm text-slate-600">No departments yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {departments.map((d) => (
                            <div key={d.id} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
                              <span>{d.name || d.slug || d.id}</span>
                              {d.location ? <span className="text-xs text-slate-500">{d.location}</span> : null}
                              {canManageDepartments ? (
                                <div className="flex gap-2">
                                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { setEditingDeptId(d.id); setDeptName(d.name || ''); setDeptSlug(d.slug || ''); setDeptLocation(d.location || ''); }}>
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="secondary" className="h-7 text-xs text-red-600" onClick={() => deleteDepartment(d.id)} disabled={departmentsBusy}>
                                    Delete
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-700">Budgets</div>
                      {canManageBudgets ? (
                        <div className="flex flex-wrap gap-2 items-end">
                          <div>
                            <div className="text-xs text-slate-500">Department</div>
                            <Select value={budgetDeptId} onChange={(e) => setBudgetDeptId(e.target.value)} className="min-w-[100px]" disabled={!!editingBudgetId}>
                              <option value="">Company-wide</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </Select>
                          </div>
                          <Input type="date" value={budgetPeriodStart} onChange={(e) => setBudgetPeriodStart(e.target.value)} placeholder="Start" disabled={!!editingBudgetId} />
                          <Input type="date" value={budgetPeriodEnd} onChange={(e) => setBudgetPeriodEnd(e.target.value)} placeholder="End" disabled={!!editingBudgetId} />
                          <Input type="number" min="0" value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="Limit ₵" />
                          <Input type="number" min="0" value={budgetSpent} onChange={(e) => setBudgetSpent(e.target.value)} placeholder="Spent ₵" />
                          <Button size="sm" onClick={saveBudget} disabled={budgetsBusy}>
                            {budgetsBusy ? '…' : editingBudgetId ? 'Update' : 'Add'}
                          </Button>
                          {editingBudgetId ? (
                            <Button size="sm" variant="secondary" onClick={() => { setEditingBudgetId(null); setBudgetPeriodStart(''); setBudgetPeriodEnd(''); setBudgetLimit(''); setBudgetSpent(''); setBudgetNotes(''); }}>
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {budgetsLoading ? (
                        <div className="text-sm text-slate-600">Loading…</div>
                      ) : budgets.length === 0 ? (
                        <div className="text-sm text-slate-600">No budgets yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {budgets.slice(0, 10).map((b) => {
                            const pct = b.utilisation_pct ?? 0
                            const alertClass = pct >= 100 ? 'border-red-300 bg-red-50' : pct >= 80 ? 'border-amber-300 bg-amber-50' : ''
                            return (
                            <div key={b.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${alertClass || 'border-slate-200 bg-white'}`}>
                              <span>
                                {b.department_name || 'Company'} • {b.period_start} → {b.period_end}
                                {pct >= 100 ? <span className="ml-1 text-xs font-semibold text-red-700">Over budget</span> : pct >= 80 ? <span className="ml-1 text-xs font-semibold text-amber-700">Near limit</span> : null}
                              </span>
                              <span>₵{Number(b.spent_ghs ?? 0).toLocaleString()} / ₵{Number(b.budget_limit_ghs ?? 0).toLocaleString()} ({b.utilisation_pct ?? 0}%)</span>
                              {canManageBudgets ? (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    onClick={() => syncBudgetFromPayroll(b.id)}
                                    disabled={syncBudgetBusyKey === b.id || budgetsBusy}
                                  >
                                    {syncBudgetBusyKey === b.id ? '…' : 'Sync payroll'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setEditingBudgetId(b.id)
                                      setBudgetPeriodStart(b.period_start)
                                      setBudgetPeriodEnd(b.period_end)
                                      setBudgetLimit(String(b.budget_limit_ghs ?? ''))
                                      setBudgetSpent(String(b.spent_ghs ?? ''))
                                      setBudgetNotes(b.notes || '')
                                      setBudgetDeptId(b.department_id || '')
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button size="sm" variant="secondary" className="h-7 text-xs text-red-600" onClick={() => deleteBudget(b.id)} disabled={budgetsBusy}>
                                    Delete
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          )
                          })}
                          {budgets.length > 10 ? <div className="text-xs text-slate-500">Showing 10 of {budgets.length}</div> : null}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ) : null}

              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Workforce insights</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Reliability and risk signals from shift outcomes. Preferred/blocked rules are respected in auto-invite.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={wfDays} onChange={(e) => setWfDays(e.target.value)} disabled={wfInsightsLoading}>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                    </Select>
                    {canUseOps || canUseStaff ? (
                      <Select
                        value={wfPoolListId}
                        onChange={(e) => setWfPoolListId(e.target.value)}
                        disabled={wfInsightsLoading || workerListsLoading || !online}
                        title={!online ? 'Reconnect to use pools' : workerListsLoading ? 'Loading pools…' : undefined}
                      >
                        <option value="">{workerListsLoading ? 'Loading pools…' : 'Pool (optional)'}</option>
                        {(Array.isArray(workerLists) ? workerLists : []).map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name || 'Pool'}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => loadWorkforceInsights(Number(wfDays)).catch(() => {})}
                      disabled={wfInsightsLoading}
                    >
                      {wfInsightsLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                  </div>
                </div>

                {wfInsightsError ? <div className="mt-3 text-sm text-red-700">{wfInsightsError}</div> : null}
                {!wfInsights && wfInsightsLoading ? <div className="mt-3 text-sm text-slate-600">Loading…</div> : null}

                {wfInsights ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">Top reliable</div>
                      <div className="mt-2 space-y-2">
                        {(wfInsights.top_reliable || []).length === 0 ? (
                          <div className="text-sm text-slate-600">Not enough data yet.</div>
                        ) : (
                          (wfInsights.top_reliable || []).slice(0, 10).map((w) => (
                            <div key={w.id} className="rounded-xl border bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    className="text-left text-sm font-semibold text-slate-900 truncate hover:underline"
                                    onClick={() => openWorkerHistoryModal(w.id).catch(() => {})}
                                    title="Open worker detail"
                                  >
                                    {w.name || 'Worker'}
                                    {w.preferred ? <span className="ml-2 text-xs text-emerald-700">preferred</span> : null}
                                  </button>
                                  <div className="mt-0.5 text-xs text-slate-600">
                                    reliability: {w.reliability_pct ?? '—'}% • attendance: {w.attendance_pct ?? '—'}% • no-show: {w.no_show_rate_pct ?? '—'}%
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-600">
                                  <div>completed: {w.shifts_completed ?? 0}</div>
                                  <div>no-shows: {w.shifts_no_show ?? 0}</div>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  disabled={!online || wfInsightsLoading || !canSetWorkerPreferred || wfActionBusyKey === `preferred-${w.id}`}
                                  title={!canSetWorkerPreferred ? 'Your role cannot change preferred status' : undefined}
                                  onClick={() => setWorkerPreferredFromInsights(w.id, !w.preferred)}
                                >
                                  {wfActionBusyKey === `preferred-${w.id}` ? 'Working…' : w.preferred ? 'Unprefer' : 'Prefer'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  disabled={!online || wfInsightsLoading || !canSetWorkerBlocked || wfActionBusyKey === `blocked-${w.id}`}
                                  title={!canSetWorkerBlocked ? 'Only owner/ops can block workers' : undefined}
                                  onClick={() => setWorkerBlockedFromInsights(w.id, true)}
                                >
                                  {wfActionBusyKey === `blocked-${w.id}` ? 'Working…' : 'Block'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  disabled={
                                    !online ||
                                    wfInsightsLoading ||
                                    !(canUseOps || canUseStaff) ||
                                    !wfPoolListId ||
                                    wfActionBusyKey === `pool-${w.id}`
                                  }
                                  title={!wfPoolListId ? 'Pick a pool above first' : !(canUseOps || canUseStaff) ? 'Your role cannot edit pools' : undefined}
                                  onClick={() => addWorkerToPoolFromInsights(w.id)}
                                >
                                  {wfActionBusyKey === `pool-${w.id}` ? 'Working…' : 'Add to pool'}
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">At risk</div>
                      <div className="mt-2 space-y-2">
                        {(wfInsights.at_risk || []).length === 0 ? (
                          <div className="text-sm text-slate-600">Not enough data yet.</div>
                        ) : (
                          (wfInsights.at_risk || []).slice(0, 10).map((w) => (
                            <div key={w.id} className="rounded-xl border bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    className="text-left text-sm font-semibold text-slate-900 truncate hover:underline"
                                    onClick={() => openWorkerHistoryModal(w.id).catch(() => {})}
                                    title="Open worker detail"
                                  >
                                    {w.name || 'Worker'}
                                  </button>
                                  <div className="mt-0.5 text-xs text-slate-600">
                                    no-show: {w.no_show_rate_pct ?? '—'}% • reliability: {w.reliability_pct ?? '—'}% • invited: {w.shifts_invited ?? 0}
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-600">
                                  <div>no-shows: {w.shifts_no_show ?? 0}</div>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  disabled={!online || wfInsightsLoading || !canSetWorkerPreferred || wfActionBusyKey === `preferred-${w.id}`}
                                  title={!canSetWorkerPreferred ? 'Your role cannot change preferred status' : undefined}
                                  onClick={() => setWorkerPreferredFromInsights(w.id, true)}
                                >
                                  {wfActionBusyKey === `preferred-${w.id}` ? 'Working…' : 'Prefer'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  disabled={!online || wfInsightsLoading || !canSetWorkerBlocked || wfActionBusyKey === `blocked-${w.id}`}
                                  title={!canSetWorkerBlocked ? 'Only owner/ops can block workers' : undefined}
                                  onClick={() => setWorkerBlockedFromInsights(w.id, true)}
                                >
                                  {wfActionBusyKey === `blocked-${w.id}` ? 'Working…' : 'Block'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 px-3 text-xs"
                                  disabled={
                                    !online ||
                                    wfInsightsLoading ||
                                    !(canUseOps || canUseStaff) ||
                                    !wfPoolListId ||
                                    wfActionBusyKey === `pool-${w.id}`
                                  }
                                  title={!wfPoolListId ? 'Pick a pool above first' : !(canUseOps || canUseStaff) ? 'Your role cannot edit pools' : undefined}
                                  onClick={() => addWorkerToPoolFromInsights(w.id)}
                                >
                                  {wfActionBusyKey === `pool-${w.id}` ? 'Working…' : 'Add to pool'}
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 p-4 md:col-span-2">
                      <div className="text-xs font-semibold text-slate-700">Daily trend</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-5">
                        {(wfInsights.daily || []).slice(-5).map((d) => (
                          <div key={d.date} className="rounded-xl border bg-white p-3">
                            <div className="text-xs text-slate-600">{d.date}</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{d.assignments ?? 0} assignments</div>
                            <div className="mt-1 text-xs text-slate-600">no-shows: {d.no_shows ?? 0}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        Window: {wfInsights.window_start ? fmtDate(wfInsights.window_start) : '—'} → {wfInsights.window_end ? fmtDate(wfInsights.window_end) : '—'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>

              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Exports</div>
                    <div className="mt-1 text-sm text-slate-600">Download CSV reports for finance and operations.</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!online || downloadBusyKey === 'jobs.csv'}
                    onClick={() => downloadAuthedCsv('/corporate/company/reports/jobs.csv', 'jobs.csv')}
                    title={!online ? 'Reconnect to download' : undefined}
                  >
                    {downloadBusyKey === 'jobs.csv' ? 'Downloading…' : 'Jobs CSV'}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!online || downloadBusyKey === 'shifts.csv'}
                    onClick={() => downloadAuthedCsv('/corporate/company/reports/shifts.csv', 'shifts.csv')}
                    title={!online ? 'Reconnect to download' : undefined}
                  >
                    {downloadBusyKey === 'shifts.csv' ? 'Downloading…' : 'Shifts CSV'}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!online || downloadBusyKey === 'workers.csv'}
                    onClick={() => downloadAuthedCsv('/corporate/company/reports/workers.csv', 'workers.csv')}
                    title={!online ? 'Reconnect to download' : undefined}
                  >
                    {downloadBusyKey === 'workers.csv' ? 'Downloading…' : 'Workers CSV'}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={!online || downloadBusyKey === 'budgets.csv'}
                    onClick={() => downloadAuthedCsv('/corporate/company/reports/budgets.csv', 'budgets.csv')}
                    title={!online ? 'Reconnect to download' : undefined}
                  >
                    {downloadBusyKey === 'budgets.csv' ? 'Downloading…' : 'Budgets CSV'}
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Workspace team</div>
                    <div className="mt-1 text-sm text-slate-600">Add colleagues and control access by role.</div>
                    {myWorkspaceRole ? <div className="mt-1 text-xs text-slate-500">Your role: {myWorkspaceRole}</div> : null}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => loadMembers().catch(() => {})} disabled={membersLoading}>
                    {membersLoading ? 'Loading…' : 'Refresh'}
                  </Button>
                </div>
                {membersError ? <div className="mt-3 text-sm text-red-700">{membersError}</div> : null}

                <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Invite link (share)</div>
                      <div className="mt-1 text-sm text-slate-600">Create an invite link and share it. The user must accept using the same email.</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => loadInvites().catch(() => {})} disabled={invitesLoading}>
                      {invitesLoading ? 'Loading…' : 'Refresh invites'}
                    </Button>
                  </div>
                  {invitesError ? <div className="mt-2 text-sm text-red-700">{invitesError}</div> : null}
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="md:col-span-2">
                      <Label>Email to invite</Label>
                      <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@company.com" />
                    </div>
                    <div className="md:col-span-1">
                      <Label>Role</Label>
                      <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                        <option value="ops">Ops</option>
                        <option value="hr">HR</option>
                        <option value="finance">Finance</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="auditor">Auditor</option>
                        <option value="owner">Owner</option>
                      </Select>
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <Button
                        className="w-full"
                        disabled={!online || inviteBusy || !canInviteMembers}
                        onClick={createInvite}
                        title={!canInviteMembers ? 'Only owners/ops can create invites' : undefined}
                      >
                        {inviteBusy ? 'Working…' : !online ? 'Offline' : 'Create invite'}
                      </Button>
                    </div>
                  </div>

                  {lastInviteUrl ? (
                    <div className="mt-3 rounded-2xl border bg-white p-3">
                      <div className="text-xs font-semibold text-slate-700">Latest invite link</div>
                      <div className="mt-1 break-all text-xs text-slate-600">{lastInviteUrl}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(lastInviteUrl)
                              toast.success('Copied')
                            } catch {
                              toast.warning('Copy failed', 'Select and copy the link manually.')
                            }
                          }}
                        >
                          Copy link
                        </Button>
                        <a className="inline-flex" href={lastInviteUrl} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="secondary" type="button">
                            Open
                          </Button>
                        </a>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {invites.length === 0 ? (
                      <div className="text-sm text-slate-600">No invites yet.</div>
                    ) : (
                      invites.slice(0, 20).map((inv) => (
                        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{inv.email}</div>
                            <div className="mt-0.5 text-xs text-slate-600">
                              {inv.workspace_role} • created {fmtDate(inv.created_at)} • expires {fmtDate(inv.expires_at)}
                              {inv.accepted_at ? ` • accepted ${fmtDate(inv.accepted_at)}` : ''}
                              {inv.revoked_at ? ` • revoked ${fmtDate(inv.revoked_at)}` : ''}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" disabled={!canInviteMembers || inviteBusy || inv.accepted_at || inv.revoked_at} onClick={() => revokeInvite(inv.id)}>
                              Revoke
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                    {invites.length > 20 ? <div className="text-xs text-slate-500">Showing 20 of {invites.length} invites.</div> : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Label>Email (recommended)</Label>
                    <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="teammate@company.com" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>User ID (optional)</Label>
                    <Input value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} placeholder="uuid…" />
                  </div>
                  <div className="md:col-span-1">
                    <Label>Role</Label>
                    <Select value={memberWorkspaceRole} onChange={(e) => setMemberWorkspaceRole(e.target.value)}>
                      <option value="ops">Ops</option>
                      <option value="hr">HR</option>
                      <option value="finance">Finance</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="auditor">Auditor</option>
                      <option value="owner">Owner</option>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <Button disabled={!online || memberBusy || !canInviteMembers} onClick={addMember} title={!canInviteMembers ? 'Only owners/ops can add members' : undefined}>
                      {memberBusy ? 'Working…' : !online ? 'Offline' : 'Add member'}
                    </Button>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {members.length === 0 ? (
                    <div className="text-sm text-slate-600">No team members found.</div>
                  ) : (
                    members.map((m) => {
                      const isMe = user?.id && m?.id && String(m.id) === String(user.id)
                      return (
                        <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{m.name || m.email || 'Member'}</div>
                            <div className="mt-0.5 text-xs text-slate-600">
                              {m.email || ''} {m.user_role ? `• ${m.user_role}` : ''} {isMe ? '• you' : ''}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={String(m.workspace_role || 'ops')}
                              disabled={!canEditMemberRoles || memberBusy}
                              onChange={(e) => updateMemberRole(m.id, e.target.value)}
                              title={!canEditMemberRoles ? 'Only owners can change roles' : undefined}
                            >
                              <option value="ops">Ops</option>
                              <option value="hr">HR</option>
                              <option value="finance">Finance</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="auditor">Auditor</option>
                              <option value="owner">Owner</option>
                            </Select>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!canEditMemberRoles || memberBusy || isMe}
                              onClick={() => removeMember(m.id)}
                              title={isMe ? 'You cannot remove yourself here.' : !canEditMemberRoles ? 'Only owners can remove members' : undefined}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Audit log</div>
                    <div className="mt-1 text-sm text-slate-600">A simple history of key actions in this workspace.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAuditBefore(null)
                        loadAudit({ reset: true }).catch(() => {})
                      }}
                      disabled={auditLoading}
                    >
                      {auditLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                    {auditHasMore ? (
                      <Button size="sm" variant="secondary" onClick={() => loadAudit({ reset: false }).catch(() => {})} disabled={auditLoading}>
                        Load more
                      </Button>
                    ) : null}
                  </div>
                </div>
                {auditError ? <div className="mt-3 text-sm text-red-700">{auditError}</div> : null}
                <div className="mt-4 space-y-2">
                  {auditItems.length === 0 ? (
                    <div className="text-sm text-slate-600">No audit events yet.</div>
                  ) : (
                    auditItems.slice(0, 150).map((it) => (
                      <div key={it.id} className="rounded-2xl border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">{it.action}</div>
                          <div className="text-xs text-slate-500">{fmtDate(it.created_at)}</div>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          {it.actor_name || it.actor_email || it.actor_user_id || 'Unknown actor'}
                          {it.target_type ? ` • ${it.target_type}` : ''}
                          {it.target_id ? ` • ${String(it.target_id).slice(0, 12)}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                  {auditItems.length > 150 ? <div className="text-xs text-slate-500">Showing 150 most recent events.</div> : null}
                </div>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

