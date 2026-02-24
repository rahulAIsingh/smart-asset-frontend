import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Package,
    AlertTriangle,
    Clock,
    CalendarDays,
    Ticket,
    FilePlus2,
    ShieldAlert,
    RefreshCw,
    UserCheck,
    Building2,
    Wrench
} from 'lucide-react'
import { dataClient } from '../lib/dataClient'
import { useAuth } from '../hooks/useAuth'
import { useCategories, ICON_MAP } from '../hooks/useCategories'
import { useUserRole } from '../hooks/useUserRole'
import { requestsClient, type AssetRequest, type RequestType } from '../lib/api/requestsClient'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { toast } from 'sonner'

const ENABLE_REQUEST_WORKFLOW = (import.meta.env.VITE_ENABLE_REQUEST_WORKFLOW ?? 'true').toLowerCase() === 'true'

type RequestFormState = {
    requestType: RequestType
    department: string
    location: string
    businessJustification: string
    urgency: 'low' | 'medium' | 'high' | 'critical'
    pmApproverEmail: string
    bossApproverEmail: string
    relatedAssetId: string
    requestedCategory: string
    requestedConfigurationJson: string
    destinationUserEmail: string
    destinationManagerEmail: string
    incidentDate: string
    incidentLocation: string
    policeReportNumber: string
    tempIssueDate: string
    tempReturnDate: string
}

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
    new_asset: 'New Asset',
    upgrade: 'Upgrade',
    replacement: 'Replacement',
    transfer: 'Transfer',
    return: 'Return',
    loss_theft: 'Loss/Theft',
    damage: 'Damage',
    accessory_peripheral: 'Accessory/Peripheral',
    temporary_loan: 'Temp Device Allocation'
}

const REQUEST_CATEGORY_OPTIONS = [
    { value: 'hardware', label: 'Hardware Device' },
    { value: 'software', label: 'Software/Application' },
    { value: 'email_license', label: 'Email/License' },
    { value: 'access', label: 'Access/Permission' },
    { value: 'peripheral', label: 'Accessory/Peripheral' },
    { value: 'network', label: 'Network/Connectivity' },
    { value: 'security', label: 'Security/Compliance' },
    { value: 'other', label: 'Other' }
]

const REQUEST_STATUS_BADGE: Record<string, string> = {
    pending_pm: 'bg-amber-50 text-amber-700 border-amber-200',
    pending_boss: 'bg-orange-50 text-orange-700 border-orange-200',
    pending_it_fulfillment: 'bg-blue-50 text-blue-700 border-blue-200',
    fulfilled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected_pm: 'bg-red-50 text-red-700 border-red-200',
    rejected_boss: 'bg-red-50 text-red-700 border-red-200',
    rejected_it: 'bg-red-50 text-red-700 border-red-200',
    returned_for_info: 'bg-violet-50 text-violet-700 border-violet-200'
}

const INITIAL_FORM: RequestFormState = {
    requestType: 'new_asset',
    department: '',
    location: '',
    businessJustification: '',
    urgency: 'medium',
    pmApproverEmail: '',
    bossApproverEmail: '',
    relatedAssetId: '',
    requestedCategory: '',
    requestedConfigurationJson: '',
    destinationUserEmail: '',
    destinationManagerEmail: '',
    incidentDate: '',
    incidentLocation: '',
    policeReportNumber: '',
    tempIssueDate: '',
    tempReturnDate: ''
}

export function MyAssets({ initialTab = 'assets', requestOnly = false, historyOnly = false }: { initialTab?: 'assets' | 'tickets' | 'requests'; requestOnly?: boolean; historyOnly?: boolean }) {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { role, isAdmin, isSupport } = useUserRole()
    const { categories } = useCategories()
    const normalizedRole = String(role || '').toLowerCase()
    const hideRequestsFromMyAssets = normalizedRole === 'user' || normalizedRole === 'pm' || normalizedRole === 'support'
    const showRequestsWorkspace = ENABLE_REQUEST_WORKFLOW && (requestOnly || !hideRequestsFromMyAssets)

    const [assets, setAssets] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedAsset, setSelectedAsset] = useState<any>(null)
    const [isReportOpen, setIsReportOpen] = useState(false)
    const [myTickets, setMyTickets] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<string>(requestOnly ? 'requests' : initialTab)

    const [users, setUsers] = useState<any[]>([])
    const [requests, setRequests] = useState<AssetRequest[]>([])
    const [pendingApprovals, setPendingApprovals] = useState<AssetRequest[]>([])
    const [requestForm, setRequestForm] = useState<RequestFormState>(INITIAL_FORM)
    const [savingRequest, setSavingRequest] = useState(false)
    const [requestFilter, setRequestFilter] = useState<'mine' | 'pending'>('mine')

    useEffect(() => {
        if (user?.email) {
            void fetchInitialData()
            if (ENABLE_REQUEST_WORKFLOW) {
                void fetchRequestData()
            }
        }
    }, [user, role])

    useEffect(() => {
        setActiveTab(requestOnly ? 'requests' : initialTab)
    }, [initialTab, requestOnly])

    useEffect(() => {
        if (!requestOnly && !showRequestsWorkspace && activeTab === 'requests') {
            setActiveTab('assets')
        }
    }, [activeTab, requestOnly, showRequestsWorkspace])

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            const [allAssets, allIssuances, allUsers] = await Promise.all([
                dataClient.db.assets.list(),
                dataClient.db.issuances.list({ orderBy: { issueDate: 'desc' } }),
                dataClient.db.users.list()
            ])

            setUsers(allUsers || [])

            const assetsByDirectAssignment = allAssets.filter((a: any) => {
                const userEmail = user?.email || ''
                if (!userEmail) return false
                if (a.assignedTo === userEmail || a.assigned_to === userEmail) return true
                if (a.location === userEmail) return true
                if (a.location?.startsWith(`${userEmail} |||`)) return true
                return false
            })

            const myActiveIssuances = allIssuances.filter((i: any) =>
                i.userEmail === user?.email && i.status === 'active'
            )

            const issuanceAssetIds = myActiveIssuances.map((i: any) => i.assetId)
            const assetsByIssuance = allAssets.filter((a: any) => issuanceAssetIds.includes(a.id))

            const uniqueAssets = new Map()
            assetsByDirectAssignment.forEach((a: any) => uniqueAssets.set(a.id, a))
            assetsByIssuance.forEach((a: any) => uniqueAssets.set(a.id, a))
            setAssets(Array.from(uniqueAssets.values()))

            const userTickets = allIssuances
                .filter((t: any) => t.userEmail === user?.email && t.status?.startsWith('ticket_'))
                .map((t: any) => {
                    if (t.userName && t.userName.includes('|||')) {
                        const parts = t.userName.split(' ||| ')
                        return {
                            ...t,
                            category: parts[1],
                            priority: parts[2],
                            assetName: parts[3],
                            description: parts[4],
                            resolutionNote: parts[5]
                        }
                    }
                    return t
                })
            setMyTickets(userTickets)
        } catch (error) {
            console.error('Error loading my data:', error)
            toast.error('Failed to load asset data')
        } finally {
            setLoading(false)
        }
    }

    const fetchRequestData = async () => {
        if (!user?.email) return

        try {
            const [mine, pending] = await Promise.all([
                requestsClient.list({ requesterEmail: user.email, limit: 100 }),
                requestsClient.pendingMe(user.email, role || 'user')
            ])
            setRequests(mine)
            setPendingApprovals(pending)
        } catch (error) {
            console.error('Error loading requests:', error)
            toast.error('Failed to load request workflow data')
        }
    }

    const getTicketStatusBadge = (status: string) => {
        switch (status) {
            case 'ticket_open': return <Badge className="bg-red-50 text-red-600 border-red-100">Open</Badge>
            case 'ticket_in-progress': return <Badge className="bg-blue-50 text-blue-600 border-blue-100">In Progress</Badge>
            case 'ticket_resolved': return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">Resolved</Badge>
            case 'ticket_return': return <Badge className="bg-amber-50 text-amber-600 border-amber-100">Return Request</Badge>
            default: return <Badge variant="secondary">{status.replace('ticket_', '')}</Badge>
        }
    }

    const getCategoryIcon = (categoryValue: string) => {
        const category = categories.find(c => c.value === categoryValue)
        const Icon = ICON_MAP[category?.icon || 'default'] || ICON_MAP['default']
        return <Icon className="w-5 h-5" />
    }

    const approverCandidates = useMemo(() => users.filter((u: any) => u.email), [users])
    const pmApproverCandidates = useMemo(
        () => approverCandidates.filter((u: any) => String(u.role || '').toLowerCase() === 'pm'),
        [approverCandidates]
    )
    const bossApproverCandidates = useMemo(
        () => approverCandidates.filter((u: any) => String(u.role || '').toLowerCase() === 'boss'),
        [approverCandidates]
    )

    const resolveBossForPm = (pmEmail: string) => {
        if (!pmEmail) return ''
        const pmUser = approverCandidates.find((u: any) => String(u.email || '').toLowerCase() === pmEmail.toLowerCase())
        const hintedBossEmail =
            pmUser?.bossEmail ||
            pmUser?.bossApproverEmail ||
            pmUser?.managerEmail ||
            pmUser?.reportingToEmail ||
            ''
        if (hintedBossEmail) {
            const matched = bossApproverCandidates.find((u: any) => String(u.email || '').toLowerCase() === String(hintedBossEmail).toLowerCase())
            if (matched?.email) return matched.email
        }
        if (bossApproverCandidates.length === 1) return bossApproverCandidates[0].email
        return ''
    }

    const resetRequestForm = () => {
        setRequestForm(prev => ({
            ...INITIAL_FORM,
            department: prev.department,
            location: prev.location,
            pmApproverEmail: prev.pmApproverEmail,
            bossApproverEmail: resolveBossForPm(prev.pmApproverEmail)
        }))
    }

    useEffect(() => {
        if (!requestForm.pmApproverEmail) {
            if (requestForm.bossApproverEmail) {
                setRequestForm(prev => ({ ...prev, bossApproverEmail: '' }))
            }
            return
        }
        const nextBoss = resolveBossForPm(requestForm.pmApproverEmail)
        if (nextBoss !== requestForm.bossApproverEmail) {
            setRequestForm(prev => ({ ...prev, bossApproverEmail: nextBoss }))
        }
    }, [requestForm.pmApproverEmail, approverCandidates.length])

    const submitRequest = async () => {
        if (!user?.email) return

        if (!requestForm.pmApproverEmail || !requestForm.bossApproverEmail || !requestForm.department || !requestForm.location || !requestForm.businessJustification || !requestForm.requestedCategory) {
            toast.error('Please fill all common required fields')
            return
        }
        if (!requestForm.bossApproverEmail) {
            toast.error('Boss approver is not mapped for selected PM')
            return
        }

        if ((requestForm.requestType === 'new_asset' || requestForm.requestType === 'upgrade') && !requestForm.requestedConfigurationJson.trim()) {
            toast.error('Configuration is required for new asset and upgrade requests')
            return
        }

        if (requestForm.requestType === 'temporary_loan') {
            if (!requestForm.tempIssueDate || !requestForm.tempReturnDate) {
                toast.error('Issue date and return date are required for Temp Device Allocation')
                return
            }
            const issueDate = new Date(`${requestForm.tempIssueDate}T00:00:00`)
            const returnDate = new Date(`${requestForm.tempReturnDate}T00:00:00`)
            if (returnDate < issueDate) {
                toast.error('Return date must be after issue date')
                return
            }
        }

        try {
            setSavingRequest(true)
            const requestedConfigurationJson = (() => {
                if (requestForm.requestType !== 'temporary_loan') {
                    return requestForm.requestedConfigurationJson || undefined
                }

                const payload = {
                    mode: 'temp_device_allocation',
                    issueDate: requestForm.tempIssueDate,
                    returnDate: requestForm.tempReturnDate,
                    approvalFlow: 'standard_existing_workflow',
                    notificationLog: {
                        emailRequestedFor: [user.email, requestForm.pmApproverEmail],
                        itAdminOverdueReturnAlert: true
                    },
                    notes: requestForm.requestedConfigurationJson?.trim() || undefined
                }
                return JSON.stringify(payload, null, 2)
            })()

            const created = await requestsClient.create({
                requestType: requestForm.requestType,
                requesterEmail: user.email,
                requesterName: user.displayName || user.email.split('@')[0],
                requesterUserId: user.id,
                department: requestForm.department,
                location: requestForm.location,
                businessJustification: requestForm.businessJustification,
                urgency: requestForm.requestType === 'loss_theft' ? 'critical' : requestForm.urgency,
                pmApproverEmail: requestForm.pmApproverEmail,
                bossApproverEmail: requestForm.bossApproverEmail,
                destinationUserEmail: requestForm.destinationUserEmail || undefined,
                destinationManagerEmail: requestForm.destinationManagerEmail || undefined,
                relatedAssetId: requestForm.relatedAssetId || undefined,
                requestedCategory: requestForm.requestedCategory || undefined,
                requestedConfigurationJson,
                incidentDate: requestForm.incidentDate ? new Date(requestForm.incidentDate).toISOString() : undefined,
                incidentLocation: requestForm.incidentLocation || undefined,
                policeReportNumber: requestForm.policeReportNumber || undefined
            })

            if (requestForm.requestType === 'temporary_loan') {
                const recipients = Array.from(new Set([user.email, requestForm.pmApproverEmail].filter(Boolean)))
                const dueDateText = requestForm.tempReturnDate || '-'
                await Promise.allSettled(
                    recipients.map((recipient) =>
                        requestsClient.notify(created.id, {
                            recipientEmail: recipient,
                            channel: 'email',
                            type: 'temp_device_allocation_submitted',
                            subject: `Temp Device Allocation Request ${created.requestNumber}`,
                            html: `<p>Request <strong>${created.requestNumber}</strong> submitted.</p><p>Issue date: ${requestForm.tempIssueDate}</p><p>Return date: ${requestForm.tempReturnDate}</p><p>Reminder is planned after due date (${dueDateText}).</p>`
                        })
                    )
                )

                await requestsClient.notify(created.id, {
                    recipientEmail: 'it.support@company.com',
                    channel: 'in_app',
                    type: 'temp_device_overdue_return_watch'
                })
            }
            toast.success('Request submitted and sent for PM approval')
            resetRequestForm()
            await fetchRequestData()
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit request')
        } finally {
            setSavingRequest(false)
        }
    }

    const handleReturnRequest = async (asset: any) => {
        if (!ENABLE_REQUEST_WORKFLOW) {
            toast.error('Request workflow is disabled')
            return
        }

        if (!user?.email) return

        const remark = (window.prompt('Add return remark for PM/Boss/IT approval flow', `Returning ${asset.name || 'asset'} to IT`) || '').trim()
        if (!remark) {
            toast.error('Return remark is required')
            return
        }

        const normalizedRole = String(role || 'user').toLowerCase()
        const pmApproverEmail = normalizedRole === 'pm'
            ? user.email
            : (requestForm.pmApproverEmail || pmApproverCandidates[0]?.email || '')
        const bossApproverEmail =
            requestForm.bossApproverEmail
            || resolveBossForPm(pmApproverEmail)
            || bossApproverCandidates[0]?.email
            || ''

        if (!pmApproverEmail) {
            toast.error('PM approver is not configured')
            return
        }

        if (!bossApproverEmail) {
            toast.error('Boss approver is not configured')
            return
        }

        const requesterProfile = approverCandidates.find((u: any) =>
            String(u.email || '').toLowerCase() === user.email.toLowerCase()
        )
        const department = String(requesterProfile?.department || requestForm.department || 'General').trim()
        const location = String(asset?.location || requestForm.location || user.email).trim()
        const requestedCategory = String(asset?.category || requestForm.requestedCategory || 'hardware').trim()

        try {
            setSavingRequest(true)
            const created = await requestsClient.create({
                requestType: 'return',
                requesterEmail: user.email,
                requesterName: user.displayName || user.email.split('@')[0],
                requesterUserId: user.id,
                department,
                location,
                businessJustification: remark,
                urgency: 'medium',
                pmApproverEmail,
                bossApproverEmail,
                relatedAssetId: asset.id,
                requestedCategory
            })

            if (normalizedRole === 'pm') {
                toast.success(`Return request ${created.requestNumber} sent to Boss approval`)
            } else {
                toast.success(`Return request ${created.requestNumber} sent to PM approval`)
            }

            setActiveTab('requests')
            await fetchRequestData()
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit return request')
        } finally {
            setSavingRequest(false)
        }
    }

    const handleApprovalAction = async (request: AssetRequest, action: 'approve' | 'reject' | 'return', comment?: string) => {
        if (!user?.email) return
        const reason = (comment || window.prompt(`Enter reason to ${action} this request`, action === 'approve' ? 'Approved after review' : '') || '').trim()
        if (!reason) {
            toast.error('Reason is mandatory')
            return
        }

        try {
            if (action === 'approve') {
                await requestsClient.approve(request.id, { actorEmail: user.email, actorRole: role || 'user', comment: reason })
            } else if (action === 'reject') {
                await requestsClient.reject(request.id, { actorEmail: user.email, actorRole: role || 'user', comment: reason })
            } else {
                await requestsClient.returnForInfo(request.id, { actorEmail: user.email, actorRole: role || 'user', comment: reason })
            }

            toast.success(`Request ${action}d successfully`)
            await fetchRequestData()
        } catch (error: any) {
            toast.error(error.message || `Failed to ${action} request`)
        }
    }

    const handleItAction = async (request: AssetRequest, action: 'fulfill' | 'close') => {
        if (!user?.email) return
        const reason = (window.prompt(`Enter note to ${action} this request`, action === 'fulfill' ? 'Fulfilled by IT' : 'Rejected by IT (No Stock)') || '').trim()
        if (!reason) {
            toast.error('Reason is mandatory')
            return
        }

        try {
            if (action === 'fulfill') {
                await requestsClient.itFulfill(request.id, { actorEmail: user.email, actorRole: role || 'support', comment: reason })
                toast.success('Request marked fulfilled')
            } else {
                await requestsClient.itClose(request.id, { actorEmail: user.email, actorRole: role || 'support', comment: reason })
                toast.success('Request rejected by IT')
            }
            await fetchRequestData()
        } catch (error: any) {
            toast.error(error.message || 'IT action failed')
        }
    }

    const visibleRequests = useMemo(() => {
        if (requestFilter === 'pending') {
            return requests.filter(r => r.status === 'pending_pm' || r.status === 'pending_boss' || r.status === 'pending_it_fulfillment')
        }
        return requests
    }, [requestFilter, requests])

    const openRequestsView = () => {
        if (showRequestsWorkspace) {
            setActiveTab('requests')
            return
        }
        navigate('/my-requests')
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight" data-tour="my-assets-overview">My Assets</h1>
                <p className="text-muted-foreground">Manage assigned devices, legacy tickets, and operational requests.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border-border/50 shadow-sm">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <CardHeader className="pb-0">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <CardTitle>
                                        {activeTab === 'assets' && 'Assigned Devices'}
                                        {activeTab === 'tickets' && 'My Ticket History'}
                                        {activeTab === 'requests' && 'Request Management'}
                                    </CardTitle>
                                    <CardDescription>
                                        {activeTab === 'assets' && 'Hardware currently in your possession.'}
                                        {activeTab === 'tickets' && 'Legacy ticket stream (read-only continuity).'}
                                        {activeTab === 'requests' && 'Create and track approval-chain requests.'}
                                    </CardDescription>
                                </div>
                                <TabsList className={`grid ${requestOnly ? 'w-[140px] grid-cols-1' : (showRequestsWorkspace ? 'w-[360px] grid-cols-3' : 'w-[240px] grid-cols-2')}`} data-tour="my-assets-tabs">
                                    {!requestOnly && <TabsTrigger value="assets">Assets</TabsTrigger>}
                                    {!requestOnly && <TabsTrigger value="tickets">Tickets</TabsTrigger>}
                                    {showRequestsWorkspace && <TabsTrigger value="requests">Requests</TabsTrigger>}
                                </TabsList>
                            </div>
                        </CardHeader>

                        <CardContent>
                            {!requestOnly && (
                            <TabsContent value="assets" className="mt-0 space-y-4">
                                {loading ? (
                                    <div className="space-y-4">
                                        {[1, 2].map(i => <div key={i} className="h-24 bg-muted/30 animate-pulse rounded-xl" />)}
                                    </div>
                                ) : assets.length === 0 ? (
                                    <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed">
                                        <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-muted-foreground">No assets assigned</h3>
                                        <p className="text-sm text-muted-foreground/70">Contact IT support if this is a mistake.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {assets.map(asset => (
                                            <div key={asset.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:shadow-md transition-all">
                                                <div className="p-3 bg-muted/30 rounded-lg text-foreground">
                                                    {getCategoryIcon(asset.category)}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold">{asset.name}</h4>
                                                        <Badge variant="secondary" className="font-mono text-[10px] tracking-wide uppercase">
                                                            {asset.serialNumber}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground capitalize">{asset.category}</p>
                                                </div>
                                                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 sm:flex-none border-dashed text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                                                        data-tour="my-assets-report-issue"
                                                        onClick={() => {
                                                            setSelectedAsset(asset)
                                                            setIsReportOpen(true)
                                                        }}
                                                    >
                                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                                        Report Issue
                                                    </Button>
                                                    {ENABLE_REQUEST_WORKFLOW && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="flex-1 sm:flex-none"
                                                            disabled={savingRequest}
                                                            onClick={() => void handleReturnRequest(asset)}
                                                        >
                                                            <RefreshCw className="w-4 h-4 mr-2" />
                                                            Return
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                            )}

                            {!requestOnly && (
                            <TabsContent value="tickets" className="mt-0 space-y-4">
                                {myTickets.length === 0 ? (
                                    <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed">
                                        <Ticket className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                        <h3 className="text-lg font-medium text-muted-foreground">No tickets reported</h3>
                                        <p className="text-sm text-muted-foreground/70">Your reported issues will appear here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {myTickets.map(ticket => (
                                            <div key={ticket.id} className="p-4 rounded-xl border border-border/50 bg-card/50 flex flex-col gap-3">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm">{ticket.category}</span>
                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">
                                                                {ticket.priority}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                                                        <p className="text-[10px] text-muted-foreground/60">{new Date(ticket.issueDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {getTicketStatusBadge(ticket.status)}
                                                        <span className="text-[10px] text-muted-foreground font-mono">#{ticket.id?.slice(0, 6)}</span>
                                                    </div>
                                                </div>
                                                {ticket.resolutionNote && (
                                                    <div className="text-xs bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50 text-emerald-800 italic">
                                                        <strong>IT Note:</strong> {ticket.resolutionNote}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                            )}

                            {showRequestsWorkspace && (
                                <TabsContent value="requests" className="mt-0 space-y-5" data-tour="my-requests-workspace">
                                    {!historyOnly && (
                                    <div className="rounded-xl border p-4 bg-muted/10 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-semibold">Create New Request</h3>
                                                <p className="text-xs text-muted-foreground">Compact flow: select type first, then fill only required sections.</p>
                                            </div>
                                            <Button size="sm" variant="outline" onClick={resetRequestForm}>
                                                <RefreshCw className="w-4 h-4 mr-2" /> Reset
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {(Object.keys(REQUEST_TYPE_LABELS) as RequestType[]).map(type => (
                                                <Button key={type} variant={requestForm.requestType === type ? 'default' : 'outline'} className="justify-start" onClick={() => setRequestForm(prev => ({ ...prev, requestType: type }))}>
                                                    {type === 'loss_theft' ? <ShieldAlert className="w-4 h-4 mr-2" /> : <FilePlus2 className="w-4 h-4 mr-2" />}
                                                    {REQUEST_TYPE_LABELS[type]}
                                                </Button>
                                            ))}
                                        </div>
                                        {requestForm.requestType === 'temporary_loan' && (
                                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                                <p className="font-semibold">Demo: Temp Device Allocation meaning</p>
                                                <p className="mt-1">
                                                    Use <strong>Temp Device Allocation</strong> when an employee needs an asset only for a short period and must return it by a target date.
                                                </p>
                                            </div>
                                        )}

                                        <details open className="rounded-md border bg-background p-3">
                                            <summary className="cursor-pointer text-sm font-medium flex items-center gap-2"><Building2 className="w-4 h-4" /> Request Details</summary>
                                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                                                <Select value={requestForm.requestedCategory} onValueChange={v => setRequestForm(p => ({ ...p, requestedCategory: v }))}>
                                                    <SelectTrigger><SelectValue placeholder="Request category (mandatory)" /></SelectTrigger>
                                                    <SelectContent>
                                                        {REQUEST_CATEGORY_OPTIONS.map(option => (
                                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                        ))}
                                                        {categories.map(cat => <SelectItem key={`cat-${cat.value}`} value={cat.value}>{cat.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <Input placeholder="Department" value={requestForm.department} onChange={e => setRequestForm(p => ({ ...p, department: e.target.value }))} />
                                                <Input placeholder="Location" value={requestForm.location} onChange={e => setRequestForm(p => ({ ...p, location: e.target.value }))} />
                                                <Select value={requestForm.urgency} onValueChange={(v: any) => setRequestForm(p => ({ ...p, urgency: v }))}>
                                                    <SelectTrigger><SelectValue placeholder="Urgency" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="critical">Critical</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <div className="md:col-span-2">
                                                    <Textarea rows={3} placeholder="Business justification" value={requestForm.businessJustification} onChange={e => setRequestForm(p => ({ ...p, businessJustification: e.target.value }))} />
                                                </div>
                                            </div>
                                        </details>

                                        <details className="rounded-md border bg-background p-3">
                                            <summary className="cursor-pointer text-sm font-medium flex items-center gap-2"><UserCheck className="w-4 h-4" /> Approvers</summary>
                                            <div className="mt-3 grid md:grid-cols-2 gap-3">
                                                <Select value={requestForm.pmApproverEmail} onValueChange={v => setRequestForm(p => ({ ...p, pmApproverEmail: v }))}>
                                                    <SelectTrigger><SelectValue placeholder="Select PM approver" /></SelectTrigger>
                                                    <SelectContent>
                                                        {pmApproverCandidates.map((u: any) => (
                                                            <SelectItem key={`pm-${u.email}`} value={u.email}>
                                                                {(u.name ? `${u.name} - ` : '') + u.email}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {role === 'user' ? (
                                                    <Input
                                                        readOnly
                                                        value={requestForm.bossApproverEmail || ''}
                                                        placeholder="Auto-selected from PM mapping"
                                                    />
                                                ) : (
                                                    <Select value={requestForm.bossApproverEmail} onValueChange={v => setRequestForm(p => ({ ...p, bossApproverEmail: v }))}>
                                                        <SelectTrigger><SelectValue placeholder="Select Boss approver" /></SelectTrigger>
                                                        <SelectContent>
                                                            {bossApproverCandidates.map((u: any) => (
                                                                <SelectItem key={`boss-${u.email}`} value={u.email}>
                                                                    {(u.name ? `${u.name} - ` : '') + u.email}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                            {role === 'user' && !requestForm.bossApproverEmail && (
                                                <p className="text-xs text-amber-700">
                                                    Boss approver will auto-fill after PM is selected and mapped.
                                                </p>
                                            )}
                                        </details>

                                        {(requestForm.requestType === 'new_asset' || requestForm.requestType === 'upgrade' || requestForm.requestType === 'accessory_peripheral' || requestForm.requestType === 'temporary_loan') && (
                                            <details className="rounded-md border bg-background p-3">
                                                <summary className="cursor-pointer text-sm font-medium flex items-center gap-2"><Package className="w-4 h-4" /> Configuration</summary>
                                                <div className="mt-3 grid md:grid-cols-2 gap-3">
                                                    <div className="md:col-span-2">
                                                        <Textarea rows={4} placeholder="JSON or text config (CPU, RAM, Storage, OS, software, accessories, quantity, required-by-date)" value={requestForm.requestedConfigurationJson} onChange={e => setRequestForm(p => ({ ...p, requestedConfigurationJson: e.target.value }))} />
                                                    </div>
                                                </div>
                                            </details>
                                        )}

                                        {requestForm.requestType === 'temporary_loan' && (
                                            <details open className="rounded-md border bg-background p-3">
                                                <summary className="cursor-pointer text-sm font-medium flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Temp Allocation Dates + Approval/Notification Log</summary>
                                                <div className="mt-3 grid md:grid-cols-2 gap-3">
                                                    <Input
                                                        type="date"
                                                        value={requestForm.tempIssueDate}
                                                        onChange={e => setRequestForm(p => ({ ...p, tempIssueDate: e.target.value }))}
                                                        placeholder="Issue date"
                                                    />
                                                    <Input
                                                        type="date"
                                                        value={requestForm.tempReturnDate}
                                                        onChange={e => setRequestForm(p => ({ ...p, tempReturnDate: e.target.value }))}
                                                        placeholder="Return date"
                                                    />
                                                    <div className="md:col-span-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
                                                        <p><strong>Approval flow:</strong> Standard existing workflow (unchanged).</p>
                                                        <p><strong>Email notification log:</strong> Requester + PM are requested for email notification at submission.</p>
                                                        <p><strong>Overdue return log:</strong> IT Admin watch log is created for follow-up after return date passes ({requestForm.tempReturnDate || 'set return date'}).</p>
                                                    </div>
                                                </div>
                                            </details>
                                        )}

                                        {(requestForm.requestType === 'replacement' || requestForm.requestType === 'transfer' || requestForm.requestType === 'return' || requestForm.requestType === 'loss_theft' || requestForm.requestType === 'damage') && (
                                            <details className="rounded-md border bg-background p-3" open>
                                                <summary className="cursor-pointer text-sm font-medium flex items-center gap-2"><Wrench className="w-4 h-4" /> Asset Reference</summary>
                                                <div className="mt-3 grid md:grid-cols-2 gap-3">
                                                    <Select value={requestForm.relatedAssetId} onValueChange={v => setRequestForm(p => ({ ...p, relatedAssetId: v }))}>
                                                        <SelectTrigger><SelectValue placeholder="Related asset" /></SelectTrigger>
                                                        <SelectContent>{assets.map(asset => <SelectItem key={asset.id} value={asset.id}>{asset.name} ({asset.serialNumber || asset.id.slice(0, 6)})</SelectItem>)}</SelectContent>
                                                    </Select>

                                                    {requestForm.requestType === 'transfer' && (
                                                        <>
                                                            <Input placeholder="Destination user email" value={requestForm.destinationUserEmail} onChange={e => setRequestForm(p => ({ ...p, destinationUserEmail: e.target.value }))} />
                                                            <Input placeholder="Destination manager email" value={requestForm.destinationManagerEmail} onChange={e => setRequestForm(p => ({ ...p, destinationManagerEmail: e.target.value }))} />
                                                        </>
                                                    )}

                                                    {requestForm.requestType === 'loss_theft' && (
                                                        <>
                                                            <Input type="datetime-local" value={requestForm.incidentDate} onChange={e => setRequestForm(p => ({ ...p, incidentDate: e.target.value }))} />
                                                            <Input placeholder="Incident location" value={requestForm.incidentLocation} onChange={e => setRequestForm(p => ({ ...p, incidentLocation: e.target.value }))} />
                                                            <Input className="md:col-span-2" placeholder="Police report number (optional)" value={requestForm.policeReportNumber} onChange={e => setRequestForm(p => ({ ...p, policeReportNumber: e.target.value }))} />
                                                        </>
                                                    )}
                                                </div>
                                            </details>
                                        )}

                                        <Button onClick={submitRequest} className="w-full" disabled={savingRequest} data-tour="my-requests-submit">{savingRequest ? 'Submitting...' : 'Submit Request'}</Button>
                                    </div>
                                    )}

                                    {historyOnly && (
                                    <div className="rounded-xl border p-4 bg-background space-y-3" data-tour="my-request-history">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="text-sm font-semibold">My Request History</h3>
                                            <div className="flex gap-2">
                                                <Button size="sm" variant={requestFilter === 'mine' ? 'default' : 'outline'} onClick={() => setRequestFilter('mine')}>Mine</Button>
                                                <Button size="sm" variant={requestFilter === 'pending' ? 'default' : 'outline'} onClick={() => setRequestFilter('pending')}>Pending</Button>
                                            </div>
                                        </div>

                                        {visibleRequests.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No requests yet.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {visibleRequests.map(req => (
                                                    <details key={req.id} className="rounded-md border p-3 bg-muted/10">
                                                        <summary className="list-none cursor-pointer flex items-center justify-between gap-3">
                                                            <div className="space-y-1">
                                                                <p className="text-sm font-medium">{req.requestNumber} - {REQUEST_TYPE_LABELS[req.requestType] || req.requestType}</p>
                                                                <p className="text-xs text-muted-foreground">Owner: {req.currentApprovalLevel.toUpperCase()} | Updated {new Date(req.updatedAt).toLocaleString()}</p>
                                                            </div>
                                                            <Badge className={REQUEST_STATUS_BADGE[req.status] || 'bg-muted'}>{req.status.replace(/_/g, ' ')}</Badge>
                                                        </summary>
                                                        <div className="mt-3 text-xs text-muted-foreground space-y-1">
                                                            <p><strong>Justification:</strong> {req.businessJustification}</p>
                                                            <p><strong>Approvers:</strong> PM {req.pmApproverEmail} | Boss {req.bossApproverEmail}</p>
                                                            {req.requestType === 'temporary_loan' && req.requestedConfigurationJson && (
                                                                <>
                                                                    <p><strong>Temp Issue Date:</strong> {(() => {
                                                                        try {
                                                                            const parsed = JSON.parse(req.requestedConfigurationJson)
                                                                            return parsed?.issueDate || '-'
                                                                        } catch {
                                                                            return '-'
                                                                        }
                                                                    })()}</p>
                                                                    <p><strong>Temp Return Date:</strong> {(() => {
                                                                        try {
                                                                            const parsed = JSON.parse(req.requestedConfigurationJson)
                                                                            return parsed?.returnDate || '-'
                                                                        } catch {
                                                                            return '-'
                                                                        }
                                                                    })()}</p>
                                                                    <p><strong>Notification Log:</strong> Submission email requested for requester and PM. IT Admin overdue-return watch log created.</p>
                                                                </>
                                                            )}
                                                            {req.relatedAssetId && <p><strong>Asset:</strong> {req.relatedAssetId}</p>}
                                                            {req.requestedConfigurationJson && <p><strong>Configuration:</strong> {req.requestedConfigurationJson}</p>}
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    )}

                                    {pendingApprovals.length > 0 && (
                                        <div className="rounded-xl border p-4 bg-background space-y-3" data-tour="my-requests-pending-actions">
                                            <h3 className="text-sm font-semibold">Pending My Approval / Fulfillment</h3>
                                            <div className="space-y-2">
                                                {pendingApprovals.map(req => (
                                                    <div key={req.id} className="rounded-md border p-3 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium">{req.requestNumber} - {REQUEST_TYPE_LABELS[req.requestType] || req.requestType}</p>
                                                            <p className="text-xs text-muted-foreground">{req.requesterEmail} | {req.status.replace(/_/g, ' ')}</p>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {req.status === 'pending_it_fulfillment' && (isAdmin || isSupport)
                                                                ? (
                                                                    <>
                                                                        <Button size="sm" onClick={() => handleItAction(req, 'fulfill')}>IT Fulfill</Button>
                                                                        <Button size="sm" variant="outline" onClick={() => handleItAction(req, 'close')}>Reject (No Stock)</Button>
                                                                    </>
                                                                )
                                                                : (
                                                                    <>
                                                                        <Button size="sm" onClick={() => handleApprovalAction(req, 'approve')}>Approve</Button>
                                                                        <Button size="sm" variant="destructive" onClick={() => handleApprovalAction(req, 'reject', 'Rejected by approver')}>Reject</Button>
                                                                        <Button size="sm" variant="outline" onClick={() => handleApprovalAction(req, 'return', 'Need more details')}>Return</Button>
                                                                    </>
                                                                )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            )}
                        </CardContent>
                    </Tabs>
                </Card>

                <div className="space-y-6">
                    <Card className="border-border/50 bg-muted/5">
                        <CardHeader>
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button className="w-full justify-start" variant="outline" onClick={openRequestsView}>
                                <Package className="w-4 h-4 mr-2" />
                                Request New Asset
                            </Button>
                            <Button className="w-full justify-start" variant="outline" onClick={openRequestsView}>
                                <Clock className="w-4 h-4 mr-2" />
                                View Request History
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50" data-tour="my-assets-support-contact">
                        <CardHeader>
                            <CardTitle className="text-base">Support Contact</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">IT</div>
                                <div>
                                    <p className="font-medium text-sm">IT Support Team</p>
                                    <p className="text-xs text-muted-foreground">support@company.com</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[980px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Report Issue</DialogTitle>
                        <DialogDescription>
                            Submit an issue for <b>{selectedAsset?.name}</b>. Support team will be notified.
                        </DialogDescription>
                    </DialogHeader>

                    <ReportIssueForm
                        asset={selectedAsset}
                        user={user}
                        onSuccess={() => {
                            setIsReportOpen(false)
                            toast.success('Ticket created successfully')
                            void fetchInitialData()
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

function ReportIssueForm({ asset, user, onSuccess }: { asset: any, user: any, onSuccess: () => void }) {
    const [category, setCategory] = useState<'hardware' | 'software'>('hardware')
    const [subCategory, setSubCategory] = useState('')
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const hardwareIssues = [
        'Display/Screen', 'Keyboard/Mouse', 'Battery/Power', 'Physical Damage', 'Peripherals (Headset/Dock)', 'Overheating', 'Other'
    ]

    const softwareIssues = [
        'Operating System', 'Application/License', 'VPN/Connectivity', 'Performance/Slowness', 'Security/Access', 'Other'
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const displayName = user.displayName || user.email.split('@')[0]
            const packedName = `${displayName} ||| ${category}/${subCategory} ||| ${priority} ||| ${asset.name || 'Unknown'} ||| ${description || 'No details provided'}`

            await dataClient.db.issuances.create({
                assetId: asset.id,
                userName: packedName,
                userEmail: user.email,
                status: 'ticket_open',
                issueDate: new Date().toISOString()
            })
            onSuccess()
        } catch (error: any) {
            const errorMsg = error.message || ''
            toast.error(`Submission error: ${errorMsg || 'HTTP 500'}`)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-3">
                <label className="text-sm font-medium">Issue Type</label>
                <div className="flex gap-4">
                    <div
                        className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all ${category === 'hardware' ? 'bg-primary/5 border-primary text-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => setCategory('hardware')}
                    >
                        <div className="font-semibold text-sm">Hardware</div>
                        <div className="text-xs opacity-70">Physical device issues</div>
                    </div>
                    <div
                        className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all ${category === 'software' ? 'bg-primary/5 border-primary text-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => setCategory('software')}
                    >
                        <div className="font-semibold text-sm">Software</div>
                        <div className="text-xs opacity-70">Apps and OS issues</div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <div className="grid grid-cols-2 gap-2">
                    {(category === 'hardware' ? hardwareIssues : softwareIssues).map(issue => (
                        <div
                            key={issue}
                            className={`text-xs p-2 rounded-lg border text-center cursor-pointer transition-all ${subCategory === issue ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                            onClick={() => setSubCategory(issue)}
                        >
                            {issue}
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as const).map(p => (
                        <Button
                            key={p}
                            type="button"
                            variant={priority === p ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1 capitalize h-9 text-xs"
                            onClick={() => setPriority(p)}
                        >
                            {p}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                    required
                    placeholder="Please describe the issue in detail..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
            </div>

            <div className="pt-4">
                <Button type="submit" className="w-full" disabled={!subCategory || !description || submitting}>
                    {submitting ? 'Submitting...' : 'Submit Ticket'}
                </Button>
            </div>
        </form>
    )
}

