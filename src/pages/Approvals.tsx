import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardCheck, ListFilter, ShieldCheck, XCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useUserRole } from '../hooks/useUserRole'
import { requestsClient, type AssetRequest, type AssetRequestAudit } from '../lib/api/requestsClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { toast } from 'sonner'

const statusClass: Record<string, string> = {
    pending_pm: 'bg-amber-50 text-amber-700 border-amber-200',
    pending_boss: 'bg-orange-50 text-orange-700 border-orange-200',
    pending_it_fulfillment: 'bg-blue-50 text-blue-700 border-blue-200',
    fulfilled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    returned_for_info: 'bg-violet-50 text-violet-700 border-violet-200',
    rejected_pm: 'bg-red-50 text-red-700 border-red-200',
    rejected_boss: 'bg-red-50 text-red-700 border-red-200',
    rejected_it: 'bg-red-50 text-red-700 border-red-200'
}

const fmt = (value: string) => value.replace(/_/g, ' ')
const decisionBadgeClass: Record<string, string> = {
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    returned_for_info: 'bg-violet-50 text-violet-700 border-violet-200'
}
const actionSuccessText: Record<'approve' | 'reject' | 'return' | 'it_fulfill' | 'it_close', string> = {
    approve: 'Request approved',
    reject: 'Request rejected',
    return: 'Request returned',
    it_fulfill: 'Request fulfilled',
    it_close: 'Request closed'
}

export function Approvals() {
    const { user } = useAuth()
    const { role, isAdmin, isSupport } = useUserRole()
    const canSeeAll = isAdmin || isSupport

    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('my-approvals')
    const [myPending, setMyPending] = useState<AssetRequest[]>([])
    const [myApproverHistory, setMyApproverHistory] = useState<AssetRequest[]>([])
    const [allPending, setAllPending] = useState<AssetRequest[]>([])
    const [allRequests, setAllRequests] = useState<AssetRequest[]>([])
    const [requestAuditMap, setRequestAuditMap] = useState<Record<string, AssetRequestAudit[]>>({})
    const [auditRows, setAuditRows] = useState<AssetRequestAudit[]>([])
    const [auditRequestNumber, setAuditRequestNumber] = useState('all')
    const [auditRequesterEmail, setAuditRequesterEmail] = useState('')
    const [auditApproverEmail, setAuditApproverEmail] = useState('')
    const [auditStatus, setAuditStatus] = useState('all')
    const [auditAction, setAuditAction] = useState('all')
    const [auditDateFrom, setAuditDateFrom] = useState('')
    const [auditDateTo, setAuditDateTo] = useState('')
    const [auditPage, setAuditPage] = useState(1)
    const [auditDetailOpen, setAuditDetailOpen] = useState(false)
    const [selectedAuditRows, setSelectedAuditRows] = useState<AssetRequestAudit[]>([])
    const [selectedAuditTitle, setSelectedAuditTitle] = useState('')
    const [actionOpen, setActionOpen] = useState(false)
    const [actionReason, setActionReason] = useState('')
    const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | 'it_fulfill' | 'it_close'>('approve')
    const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null)

    useEffect(() => {
        if (user?.email) {
            void load()
        }
    }, [user?.email, role])

    const load = async () => {
        if (!user?.email) return

        try {
            setLoading(true)
            const [pendingMine, assignedToMe] = await Promise.all([
                requestsClient.pendingMe(user.email, role || 'user'),
                requestsClient.list({ approverEmail: user.email, limit: 300 })
            ])

            setMyPending(pendingMine)
            setMyApproverHistory(
                assignedToMe.filter(req => req.status !== 'pending_pm' && req.status !== 'pending_boss' && req.status !== 'pending_it_fulfillment')
            )

            if (canSeeAll) {
                const [pm, boss, it, all] = await Promise.all([
                    requestsClient.list({ status: 'pending_pm', limit: 300 }),
                    requestsClient.list({ status: 'pending_boss', limit: 300 }),
                    requestsClient.list({ status: 'pending_it_fulfillment', limit: 300 }),
                    requestsClient.list({ limit: 500 })
                ])

                const dedup = new Map<string, AssetRequest>()
                ;[...pm, ...boss, ...it].forEach(row => dedup.set(row.id, row))
                setAllPending(Array.from(dedup.values()).sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)))
                setAllRequests(all)
            } else {
                setAllPending(pendingMine)
                setAllRequests(assignedToMe)
            }

            const actionable = pendingMine.filter(req => req.status === 'pending_pm' || req.status === 'pending_boss' || req.status === 'pending_it_fulfillment')
            if (actionable.length > 0) {
                const auditEntries = await Promise.all(
                    actionable.map(async (req) => {
                        const rows = await requestsClient.auditList({ requestId: req.id, limit: 50 })
                        return [req.id, rows] as const
                    })
                )
                const nextMap: Record<string, AssetRequestAudit[]> = {}
                auditEntries.forEach(([requestId, rows]) => {
                    nextMap[requestId] = rows.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
                })
                setRequestAuditMap(nextMap)
            } else {
                setRequestAuditMap({})
            }

            await loadAudit(canSeeAll)
        } catch (error) {
            console.error(error)
            toast.error('Failed to load approvals data')
        } finally {
            setLoading(false)
        }
    }

    const doAction = async (req: AssetRequest, action: 'approve' | 'reject' | 'return', reason: string) => {
        if (!user?.email) return
        if (!reason.trim()) {
            toast.error('Reason is required')
            return
        }

        try {
            if (action === 'approve') {
                await requestsClient.approve(req.id, { actorEmail: user.email, actorRole: role || 'user', comment: reason })
            } else if (action === 'reject') {
                await requestsClient.reject(req.id, { actorEmail: user.email, actorRole: role || 'user', comment: reason })
            } else {
                await requestsClient.returnForInfo(req.id, { actorEmail: user.email, actorRole: role || 'user', comment: reason })
            }
            toast.success(actionSuccessText[action])
            await load()
        } catch (error: any) {
            toast.error(error?.message || `Failed to ${action} request`)
        }
    }

    const doItAction = async (req: AssetRequest, action: 'fulfill' | 'close', reason: string) => {
        if (!user?.email) return
        if (!reason.trim()) {
            toast.error('Reason is required')
            return
        }

        try {
            if (action === 'fulfill') {
                await requestsClient.itFulfill(req.id, { actorEmail: user.email, actorRole: role || 'support', comment: reason })
                toast.success(actionSuccessText.it_fulfill)
            } else {
                await requestsClient.itClose(req.id, { actorEmail: user.email, actorRole: role || 'support', comment: reason })
                toast.success(actionSuccessText.it_close)
            }
            await load()
        } catch (error: any) {
            toast.error(error?.message || `Failed to ${action}`)
        }
    }

    const myActionable = useMemo(() => {
        return myPending.filter(req => req.status === 'pending_pm' || req.status === 'pending_boss' || req.status === 'pending_it_fulfillment')
    }, [myPending])

    const loadAudit = async (adminLike: boolean) => {
        if (!user?.email) return

        const payload: any = { limit: 400 }
        if (!adminLike) {
            payload.actorEmail = user.email
        }

        if (auditRequestNumber !== 'all') payload.requestNumber = auditRequestNumber
        if (auditRequesterEmail.trim()) payload.requesterEmail = auditRequesterEmail.trim()
        if (auditApproverEmail.trim()) {
            payload.approverEmail = auditApproverEmail.trim()
        }
        if (auditStatus !== 'all') payload.status = auditStatus
        if (auditAction !== 'all') payload.action = auditAction
        if (auditDateFrom) payload.createdFrom = new Date(`${auditDateFrom}T00:00:00`).toISOString()
        if (auditDateTo) payload.createdTo = new Date(`${auditDateTo}T23:59:59`).toISOString()

        try {
            const rows = await requestsClient.auditList(payload)
            setAuditRows(rows)
        } catch {
            setAuditRows([])
        }
    }

    const requestNumberOptions = useMemo(() => {
        return Array.from(new Set(allRequests.map(r => r.requestNumber).filter(Boolean))).sort()
    }, [allRequests])

    const requesterOptions = useMemo(() => {
        return Array.from(new Set(allRequests.map(r => r.requesterEmail).filter(Boolean))).sort()
    }, [allRequests])

    const approverOptions = useMemo(() => {
        const values = [
            ...allRequests.map(r => r.pmApproverEmail),
            ...allRequests.map(r => r.bossApproverEmail)
        ].filter(Boolean)
        return Array.from(new Set(values)).sort()
    }, [allRequests])

    const auditSummaryRows = useMemo(() => {
        const grouped = new Map<string, AssetRequestAudit[]>()
        auditRows.forEach(row => {
            const key = row.requestId || row.requestNumber
            const current = grouped.get(key) || []
            current.push(row)
            grouped.set(key, current)
        })

        return Array.from(grouped.entries())
            .map(([key, rows]) => {
                const sorted = [...rows].sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
                const latest = sorted[0]
                const approvals = sorted.filter(r => r.action === 'approved').length
                const rejected = sorted.filter(r => r.action === 'rejected').length
                return {
                    key,
                    requestId: latest.requestId,
                    requestNumber: latest.requestNumber,
                    requestType: latest.requestType,
                    latestStatus: latest.toStatus || latest.fromStatus || 'unknown',
                    latestAction: latest.action,
                    latestActor: latest.actorEmail,
                    latestReason: latest.comment || '',
                    updatedAt: latest.createdAt,
                    approvals,
                    rejected,
                    rows: sorted
                }
            })
            .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
    }, [auditRows])

    const pageSize = 10
    const totalPages = Math.max(1, Math.ceil(auditSummaryRows.length / pageSize))
    const currentPage = Math.min(auditPage, totalPages)
    const pagedAuditRows = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return auditSummaryRows.slice(start, start + pageSize)
    }, [auditSummaryRows, currentPage])

    const applyAuditFilters = () => {
        setAuditPage(1)
        void loadAudit(canSeeAll)
    }

    const clearAuditFilters = () => {
        setAuditRequestNumber('all')
        setAuditRequesterEmail('')
        setAuditApproverEmail('')
        setAuditStatus('all')
        setAuditAction('all')
        setAuditDateFrom('')
        setAuditDateTo('')
        setAuditPage(1)
        setTimeout(() => void loadAudit(canSeeAll), 0)
    }

    const openActionDialog = (req: AssetRequest, nextAction: 'approve' | 'reject' | 'return' | 'it_fulfill' | 'it_close') => {
        setSelectedRequest(req)
        setActionType(nextAction)
        setActionReason('')
        setActionOpen(true)
    }

    const submitAction = async () => {
        if (!selectedRequest) return
        if (!actionReason.trim()) {
            toast.error('Reason is required')
            return
        }

        if (actionType === 'it_fulfill') {
            await doItAction(selectedRequest, 'fulfill', actionReason)
        } else if (actionType === 'it_close') {
            await doItAction(selectedRequest, 'close', actionReason)
        } else {
            await doAction(selectedRequest, actionType, actionReason)
        }

        setActionOpen(false)
    }

    const pickLatest = (rows: AssetRequestAudit[]) => {
        if (rows.length === 0) return null
        return rows.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))[0]
    }

    const getStageDecisions = (requestId: string) => {
        const rows = (requestAuditMap[requestId] || []).filter(a => a.action === 'approved' || a.action === 'rejected' || a.action === 'returned_for_info')

        const pmRows = rows.filter(a =>
            a.actorRole === 'pm' ||
            a.fromStatus === 'pending_pm' ||
            a.toStatus === 'pending_boss'
        )
        const bossRows = rows.filter(a =>
            a.actorRole === 'boss' ||
            a.fromStatus === 'pending_boss' ||
            a.toStatus === 'pending_it_fulfillment'
        )

        return {
            pm: pickLatest(pmRows),
            boss: pickLatest(bossRows),
            total: rows.length
        }
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
                    <p className="text-muted-foreground">Central approval and workflow visibility for PM, Boss, and IT.</p>
                </div>
                <Button variant="outline" onClick={() => void load()}>
                    <ListFilter className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 max-w-xl">
                    <TabsTrigger value="my-approvals">My Approvals</TabsTrigger>
                    <TabsTrigger value="pending">Pending Queue</TabsTrigger>
                    <TabsTrigger value="audit">Audit Trail</TabsTrigger>
                </TabsList>

                <TabsContent value="my-approvals" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Assigned to Me</CardTitle>
                            <CardDescription>Requests where you are PM/Boss approver or IT fulfiller.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : myActionable.length === 0 ? <p className="text-sm text-muted-foreground">No pending approvals assigned to you.</p> : myActionable.map(req => (
                                <div key={req.id} className="rounded-lg border p-3 bg-muted/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <p className="font-medium">{req.requestNumber} - {req.requestType}</p>
                                        <p className="text-xs text-muted-foreground">Requester: {req.requesterEmail} | Owner: {req.currentApprovalLevel.toUpperCase()}</p>
                                        {(req.status === 'pending_boss' || req.status === 'pending_it_fulfillment') && (() => {
                                            const stage = getStageDecisions(req.id)
                                            return (
                                                <div className="mt-3 rounded-md border bg-background p-3">
                                                    <p className="font-medium text-xs mb-2">Decision Summary Before You</p>
                                                    <div className="space-y-2 text-xs">
                                                        <div className="rounded-md border p-2 bg-muted/30">
                                                            <p className="font-medium">Step 1: PM Decision</p>
                                                            {stage.pm ? (
                                                                <div className="mt-1 space-y-1">
                                                                    <Badge className={decisionBadgeClass[stage.pm.action] || 'bg-muted'}>{fmt(stage.pm.action)}</Badge>
                                                                    <p className="text-muted-foreground">By: {stage.pm.actorEmail}</p>
                                                                    <p className="text-muted-foreground">At: {new Date(stage.pm.createdAt).toLocaleString()}</p>
                                                                    <p><strong>Reason:</strong> {stage.pm.comment || 'No reason captured'}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-muted-foreground mt-1">Not decided yet.</p>
                                                            )}
                                                        </div>

                                                        <div className="rounded-md border p-2 bg-muted/30">
                                                            <p className="font-medium">Step 2: Boss Decision</p>
                                                            {stage.boss ? (
                                                                <div className="mt-1 space-y-1">
                                                                    <Badge className={decisionBadgeClass[stage.boss.action] || 'bg-muted'}>{fmt(stage.boss.action)}</Badge>
                                                                    <p className="text-muted-foreground">By: {stage.boss.actorEmail}</p>
                                                                    <p className="text-muted-foreground">At: {new Date(stage.boss.createdAt).toLocaleString()}</p>
                                                                    <p><strong>Reason:</strong> {stage.boss.comment || 'No reason captured'}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-muted-foreground mt-1">Pending boss decision.</p>
                                                            )}
                                                        </div>

                                                        {stage.total === 0 && <p className="text-muted-foreground">No prior approval history found.</p>}
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge className={statusClass[req.status] || 'bg-muted'}>{fmt(req.status)}</Badge>
                                                            {req.status === 'pending_it_fulfillment' && canSeeAll ? (
                                            <>
                                                <Button size="sm" onClick={() => openActionDialog(req, 'it_fulfill')}><ShieldCheck className="w-4 h-4 mr-1" />Fulfill</Button>
                                                <Button size="sm" variant="outline" onClick={() => openActionDialog(req, 'it_close')}><CheckCircle2 className="w-4 h-4 mr-1" />Reject (No Stock)</Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button size="sm" onClick={() => openActionDialog(req, 'approve')}><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
                                                <Button size="sm" variant="destructive" onClick={() => openActionDialog(req, 'reject')}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                                                <Button size="sm" variant="outline" onClick={() => openActionDialog(req, 'return')}>Return</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pending" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{canSeeAll ? 'All Pending Requests' : 'My Pending Queue'}</CardTitle>
                            <CardDescription>
                                {canSeeAll ? 'Admin/IT view across PM, Boss and IT stages.' : 'Only requests currently waiting for your action.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : allPending.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : allPending.map(req => (
                                <div key={req.id} className="rounded-lg border p-3 bg-background flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium">{req.requestNumber} - {req.requestType}</p>
                                        <p className="text-xs text-muted-foreground">Created by {req.requesterEmail} | PM {req.pmApproverEmail} | Boss {req.bossApproverEmail}</p>
                                    </div>
                                    <Badge className={statusClass[req.status] || 'bg-muted'}>{fmt(req.status)}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>{canSeeAll ? 'End-to-End Request Flow' : 'My Approval History'}</CardTitle>
                            <CardDescription>
                                {canSeeAll ? 'Full request visibility: creator, approvers, and final state.' : 'Requests where you were an approver.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                <Select value={auditRequestNumber} onValueChange={setAuditRequestNumber}>
                                    <SelectTrigger><SelectValue placeholder="Request no" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Requests</SelectItem>
                                        {requestNumberOptions.map(value => (
                                            <SelectItem key={value} value={value}>{value}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={auditRequesterEmail || 'all'} onValueChange={(value) => setAuditRequesterEmail(value === 'all' ? '' : value)}>
                                    <SelectTrigger><SelectValue placeholder="Requester" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Requesters</SelectItem>
                                        {requesterOptions.map(value => (
                                            <SelectItem key={value} value={value}>{value}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={auditApproverEmail || 'all'} onValueChange={(value) => setAuditApproverEmail(value === 'all' ? '' : value)}>
                                    <SelectTrigger><SelectValue placeholder="Approver" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Approvers</SelectItem>
                                        {approverOptions.map(value => (
                                            <SelectItem key={value} value={value}>{value}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={auditStatus} onValueChange={setAuditStatus}>
                                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="pending_pm">Pending PM</SelectItem>
                                        <SelectItem value="pending_boss">Pending Boss</SelectItem>
                                        <SelectItem value="pending_it_fulfillment">Pending IT</SelectItem>
                                        <SelectItem value="fulfilled">Fulfilled</SelectItem>
                                        <SelectItem value="closed">Closed</SelectItem>
                                        <SelectItem value="rejected_pm">Rejected PM</SelectItem>
                                        <SelectItem value="rejected_boss">Rejected Boss</SelectItem>
                                        <SelectItem value="rejected_it">Rejected IT</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} />
                                <Input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} />
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" onClick={clearAuditFilters}>Reset</Button>
                                <Button variant="outline" onClick={applyAuditFilters}>Apply Filters</Button>
                            </div>

                            {loading ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                            ) : pagedAuditRows.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No audit history found.</p>
                            ) : (
                                <div className="space-y-2">
                                    {pagedAuditRows.map((row) => (
                                        <div key={row.key} className="rounded-lg border p-3 bg-background">
                                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-sm">
                                                <div className="md:col-span-2">
                                                    <p className="font-medium">{row.requestNumber}</p>
                                                    <p className="text-xs text-muted-foreground">{row.requestType}</p>
                                                </div>
                                                <div>
                                                    <Badge className={statusClass[row.latestStatus] || 'bg-muted'}>{fmt(row.latestStatus)}</Badge>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Last Action</p>
                                                    <p>{fmt(row.latestAction)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">By</p>
                                                    <p className="truncate">{row.latestActor}</p>
                                                </div>
                                                <div className="flex items-center justify-between md:justify-end gap-2">
                                                    <p className="text-xs text-muted-foreground">{new Date(row.updatedAt).toLocaleString()}</p>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedAuditRows(row.rows)
                                                            setSelectedAuditTitle(`${row.requestNumber} - ${row.requestType}`)
                                                            setAuditDetailOpen(true)
                                                        }}
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </div>
                                            {row.latestReason && (
                                                <p className="text-xs mt-2"><strong>Reason:</strong> {row.latestReason}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {auditSummaryRows.length > pageSize && (
                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-xs text-muted-foreground">
                                        Page {currentPage} of {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setAuditPage(p => Math.max(1, p - 1))}>
                                            Prev
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))}>
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ClipboardCheck className="w-5 h-5" />Visibility Rules</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                    <p>PM/Boss: see and act only on requests assigned to them.</p>
                    <p>Admin/IT: see all pending stages and full audit trail.</p>
                    <p>Users: do not get global queue access; they continue using My Assets for their own requests.</p>
                </CardContent>
            </Card>

            <Dialog open={auditDetailOpen} onOpenChange={setAuditDetailOpen}>
                <DialogContent className="sm:max-w-[680px]">
                    <DialogHeader>
                        <DialogTitle>{selectedAuditTitle || 'Request Timeline'}</DialogTitle>
                        <DialogDescription>Complete approval and action timeline for this request.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto space-y-2">
                        {selectedAuditRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No timeline entries.</p>
                        ) : (
                            selectedAuditRows.map((row) => (
                                <div key={row.id} className="rounded-md border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className={decisionBadgeClass[row.action] || 'bg-muted'}>{fmt(row.action)}</Badge>
                                            <span className="text-sm font-medium">{row.actorEmail}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {row.fromStatus || 'n/a'} {'->'} {row.toStatus || 'n/a'} | Decision: {row.decision || 'n/a'}
                                    </p>
                                    {row.comment && <p className="text-sm mt-1"><strong>Reason:</strong> {row.comment}</p>}
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={actionOpen} onOpenChange={setActionOpen}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Action Reason Required</DialogTitle>
                        <DialogDescription>
                            Add a clear reason for {actionType.replace('_', ' ')} on {selectedRequest?.requestNumber}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Textarea
                            rows={5}
                            placeholder="Reason for this decision (mandatory)"
                            value={actionReason}
                            onChange={e => setActionReason(e.target.value)}
                        />
                        <Button className="w-full" onClick={() => void submitAction()}>
                            Submit Decision
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
