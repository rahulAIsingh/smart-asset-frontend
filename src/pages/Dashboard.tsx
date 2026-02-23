import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  Laptop,
  Layers,
  Package,
  Wrench
} from 'lucide-react'
import { dataClient } from '../lib/dataClient'
import { requestsClient, type AssetRequest } from '../lib/api/requestsClient'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts'

type DonutSlice = {
  name: string
  value: number
  color: string
}

type TicketCount = {
  open: number
  pending: number
  closed: number
}

type FeedEvent = {
  id: string
  when: number
  type: 'issuance' | 'ticket' | 'request' | 'maintenance'
  text: string
}

type AssetIntelligence = {
  assetId: string
  assetTag: string
  model: string
  warrantyEnd: string
  warrantyDaysLeft: number | null
  issueCount: number
  replacementCount: number
  depreciationPct: number
  riskScore: number
}

const statusLabel = (value: string) => value.replace(/_/g, ' ')
const unpackLocation = (packed: string) => {
  if (!packed) return { location: '', configuration: '' }
  if (packed.includes(' ||| ')) {
    const [location, ...rest] = packed.split(' ||| ')
    return { location: location || '', configuration: rest.join(' ||| ') || '' }
  }
  return { location: packed, configuration: '' }
}
const extractConfigField = (config: string, label: string) => {
  const match = config.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'))
  return match ? match[1].trim() : ''
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export function Dashboard() {
  const navigate = useNavigate()
  const [isAiOpen, setIsAiOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    issued: 0,
    available: 0,
    openTickets: 0,
    repairTickets: 0,
    pendingIt: 0,
    urgentRequests: 0
  })

  const [recentIssuances, setRecentIssuances] = useState<any[]>([])
  const [itQueue, setItQueue] = useState<AssetRequest[]>([])
  const [ticketStatusSplit, setTicketStatusSplit] = useState<DonutSlice[]>([])
  const [ticketPrioritySplit, setTicketPrioritySplit] = useState<Array<{ name: string, value: number, color: string }>>([])
  const [ticketCounts, setTicketCounts] = useState<TicketCount>({ open: 0, pending: 0, closed: 0 })
  const [requestPipeline, setRequestPipeline] = useState<Array<{ status: string, value: number }>>([])
  const [attentionAssets, setAttentionAssets] = useState<Array<{ asset: string, tickets: number }>>([])
  const [liveFeed, setLiveFeed] = useState<FeedEvent[]>([])
  const [warrantyAlerts, setWarrantyAlerts] = useState<AssetIntelligence[]>([])
  const [scrapCandidates, setScrapCandidates] = useState<AssetIntelligence[]>([])

  useEffect(() => {
    void fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [assetsRes, issuancesRes, maintenanceRes, requestsRes] = await Promise.allSettled([
        dataClient.db.assets.list(),
        dataClient.db.issuances.list(),
        dataClient.db.maintenance.list(),
        requestsClient.list({ limit: 200 })
      ])

      const assets = assetsRes.status === 'fulfilled' ? assetsRes.value : []
      const issuances = issuancesRes.status === 'fulfilled' ? issuancesRes.value : []
      const maintenanceLogs = maintenanceRes.status === 'fulfilled' ? maintenanceRes.value : []
      const allRequests = requestsRes.status === 'fulfilled' ? requestsRes.value : []

      const assetsById: Record<string, any> = {}
      assets.forEach((a: any) => {
        assetsById[a.id] = a
      })

      const issued = assets.filter((a: any) => a.status === 'issued').length
      const available = assets.filter((a: any) => a.status === 'available').length
      const openTickets = issuances.filter((i: any) => i && String(i.status || '').startsWith('ticket_') && i.status !== 'ticket_resolved').length
      const repairTickets = issuances.filter((i: any) =>
        String(i.status || '').startsWith('ticket_') &&
        i.status !== 'ticket_resolved' &&
        String(i.userName || '').includes('hardware/')
      ).length

      const pendingIt = allRequests.filter(r => r.status === 'pending_it_fulfillment').length
      const urgentRequests = allRequests.filter(r => ['high', 'critical'].includes(String(r.urgency || '').toLowerCase())).length

      setStats({
        total: assets.length,
        issued,
        available,
        openTickets,
        repairTickets,
        pendingIt,
        urgentRequests
      })

      const queue = allRequests
        .filter(r => r.status === 'pending_it_fulfillment')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setItQueue(queue)

      const recent = issuances
        .filter((i: any) => i && (i.status === 'active' || i.status === 'returned'))
        .sort((a: any, b: any) => new Date(b.issueDate || b.createdAt).getTime() - new Date(a.issueDate || a.createdAt).getTime())
        .slice(0, 8)
        .map((i: any) => ({
          ...i,
          displayAssetId: assetsById[i.assetId]?.serialNumber || i.assetId
        }))
      setRecentIssuances(recent)

      const isValidDate = (d: Date) => !Number.isNaN(d.getTime())

      const ticketsOnly = issuances.filter((i: any) => String(i.status || '').startsWith('ticket_'))
      const tOpen = ticketsOnly.filter((t: any) => t.status === 'ticket_open').length
      const tClosed = ticketsOnly.filter((t: any) => t.status === 'ticket_resolved').length
      const tPending = ticketsOnly.filter((t: any) => t.status !== 'ticket_open' && t.status !== 'ticket_resolved').length
      setTicketCounts({ open: tOpen, pending: tPending, closed: tClosed })
      setTicketStatusSplit([
        { name: 'Open', value: tOpen, color: '#ef4444' },
        { name: 'Pending', value: tPending, color: '#f59e0b' },
        { name: 'Closed', value: tClosed, color: '#10b981' }
      ].filter(x => x.value > 0))

      const priorityCounts: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 0, high: 0 }
      ticketsOnly.forEach((t: any) => {
        let priority = 'medium'
        const packed = String(t.userName || '')
        if (packed.includes(' ||| ')) {
          const parts = packed.split(' ||| ')
          priority = String(parts[2] || 'medium').trim().toLowerCase()
        }
        if (priority !== 'low' && priority !== 'medium' && priority !== 'high') priority = 'medium'
        priorityCounts[priority as 'low' | 'medium' | 'high'] += 1
      })
      setTicketPrioritySplit([
        { name: 'Low', value: priorityCounts.low, color: '#3b82f6' },
        { name: 'Medium', value: priorityCounts.medium, color: '#f59e0b' },
        { name: 'High', value: priorityCounts.high, color: '#ef4444' }
      ])

      const pipeline: Record<string, number> = {}
      allRequests.forEach((r) => {
        pipeline[r.status] = (pipeline[r.status] || 0) + 1
      })
      const pipelineRows = Object.entries(pipeline)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([status, value]) => ({ status, value }))
      setRequestPipeline(pipelineRows)

      const ticketCounts: Record<string, number> = {}
      issuances.forEach((i: any) => {
        if (!String(i.status || '').startsWith('ticket_') || i.status === 'ticket_resolved') return
        ticketCounts[i.assetId] = (ticketCounts[i.assetId] || 0) + 1
      })
      const topAttention = Object.entries(ticketCounts)
        .map(([assetId, tickets]) => ({
          asset: assetsById[assetId]?.serialNumber || assetId,
          tickets
        }))
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 6)
      setAttentionAssets(topAttention)

      const issueCountByAsset: Record<string, number> = {}
      const replacementCountByAsset: Record<string, number> = {}
      maintenanceLogs.forEach((m: any) => {
        if (!m?.assetId) return
        const desc = String(m.description || '').toLowerCase()
        const isIssue = String(m.type || '').toLowerCase() === 'issue'
        if (isIssue) issueCountByAsset[m.assetId] = (issueCountByAsset[m.assetId] || 0) + 1
        if (/replace|replacement|changed|swap|motherboard|battery|screen|ram|ssd/.test(desc)) {
          replacementCountByAsset[m.assetId] = (replacementCountByAsset[m.assetId] || 0) + 1
        }
      })
      issuances.forEach((i: any) => {
        if (!i?.assetId) return
        if (String(i.status || '').startsWith('ticket_')) {
          issueCountByAsset[i.assetId] = (issueCountByAsset[i.assetId] || 0) + 1
        }
      })

      const nowMs = Date.now()
      const intelligenceRows: AssetIntelligence[] = assets.map((a: any) => {
        const { configuration } = unpackLocation(String(a.location || ''))
        const model = extractConfigField(configuration, 'Model') || a.model || 'Other'
        const warrantyEndText = extractConfigField(configuration, 'Warranty End') || a.warrantyEnd || ''
        const warrantyEndMs = warrantyEndText ? new Date(warrantyEndText).getTime() : NaN
        const warrantyDaysLeft = Number.isFinite(warrantyEndMs)
          ? Math.floor((warrantyEndMs - nowMs) / (1000 * 60 * 60 * 24))
          : null

        const createdMs = new Date(a.createdAt || Date.now()).getTime()
        const years = Number.isFinite(createdMs) ? (nowMs - createdMs) / (1000 * 60 * 60 * 24 * 365) : 0
        const depreciationPct = clamp(Math.round((years / 3) * 100), 0, 95)

        const issueCount = issueCountByAsset[a.id] || 0
        const replacementCount = replacementCountByAsset[a.id] || 0
        const riskScore = clamp(
          (warrantyDaysLeft !== null && warrantyDaysLeft < 0 ? 35 : 0) +
          (warrantyDaysLeft !== null && warrantyDaysLeft >= 0 && warrantyDaysLeft <= 30 ? 20 : 0) +
          Math.min(40, replacementCount * 12) +
          Math.min(25, issueCount * 4) +
          (depreciationPct >= 75 ? 10 : 0),
          0,
          100
        )

        return {
          assetId: a.id,
          assetTag: a.serialNumber || a.id,
          model,
          warrantyEnd: warrantyEndText || '-',
          warrantyDaysLeft,
          issueCount,
          replacementCount,
          depreciationPct,
          riskScore
        }
      })

      const warrantySoon = intelligenceRows
        .filter(r => r.warrantyDaysLeft !== null && r.warrantyDaysLeft <= 45)
        .sort((a, b) => (a.warrantyDaysLeft || 0) - (b.warrantyDaysLeft || 0))
        .slice(0, 8)
      setWarrantyAlerts(warrantySoon)

      const scrapRisk = intelligenceRows
        .filter(r => r.replacementCount >= 3 || r.riskScore >= 55)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 8)
      setScrapCandidates(scrapRisk)

      const events: FeedEvent[] = []
      issuances.forEach((i: any) => {
        const dt = new Date(i.issueDate || i.createdAt || Date.now())
        if (!isValidDate(dt)) return
        const isTicket = String(i.status || '').startsWith('ticket_')
        events.push({
          id: `iss-${i.id}`,
          when: dt.getTime(),
          type: isTicket ? 'ticket' : 'issuance',
          text: isTicket
            ? `${statusLabel(String(i.status || 'ticket'))}: ${assetsById[i.assetId]?.serialNumber || i.assetId}`
            : `Issued ${assetsById[i.assetId]?.serialNumber || i.assetId} to ${i.userName || 'user'}`
        })
      })

      allRequests.forEach((r) => {
        const dt = new Date(r.createdAt || Date.now())
        if (!isValidDate(dt)) return
        events.push({
          id: `req-${r.id}`,
          when: dt.getTime(),
          type: 'request',
          text: `${r.requestNumber} (${statusLabel(r.status)})`
        })
      })

      maintenanceLogs.forEach((m: any) => {
        if (String(m.type || '') !== 'issue') return
        const dt = new Date(m.date || m.createdAt || Date.now())
        if (!isValidDate(dt)) return
        events.push({
          id: `mnt-${m.id}`,
          when: dt.getTime(),
          type: 'maintenance',
          text: `Maintenance issue: ${assetsById[m.assetId]?.serialNumber || m.assetId}`
        })
      })

      setLiveFeed(events.sort((a, b) => b.when - a.when).slice(0, 12))
    } catch (error) {
      console.error('Dashboard fetch failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {Array.from({ length: 16 }).map((_, idx) => (
          <div key={idx} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  const utilization = stats.total > 0 ? Math.round((stats.issued / stats.total) * 100) : 0
  const highestPipeline = requestPipeline[0]
  const topAttention = attentionAssets[0]
  const outOfWarrantyCount = warrantyAlerts.filter(a => (a.warrantyDaysLeft ?? 1) < 0).length
  const aiQuickPoints = [
    `Asset utilization is ${utilization}% (${stats.issued}/${stats.total} issued).`,
    `Open tickets: ${ticketCounts.open}; pending: ${ticketCounts.pending}; closed: ${ticketCounts.closed}.`,
    highestPipeline
      ? `Highest request stage backlog: ${statusLabel(highestPipeline.status)} (${highestPipeline.value}).`
      : 'No request backlog found right now.',
    topAttention
      ? `Top attention asset: ${topAttention.asset} with ${topAttention.tickets} active ticket(s).`
      : 'No active ticket hotspots at asset level.',
    `Warranty watch: ${warrantyAlerts.length} asset(s) due/expired within 45 days; ${outOfWarrantyCount} already out of warranty.`,
    `Scrap-risk watch: ${scrapCandidates.length} candidate asset(s) from repeated hardware issues/replacements.`
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <MetricCard label="Total" value={stats.total} icon={<Layers className="w-4 h-4 text-slate-600" />} tone="slate" />
        <MetricCard label="Available" value={stats.available} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} tone="emerald" />
        <MetricCard label="Issued" value={stats.issued} icon={<Laptop className="w-4 h-4 text-cyan-600" />} tone="cyan" />
        <MetricCard testId="dashboard-open-tickets-card" label="Open Tickets" value={stats.openTickets} icon={<AlertCircle className="w-4 h-4 text-amber-600" />} tone="amber" />
        <MetricCard label="Repair Risk" value={stats.repairTickets} icon={<Wrench className="w-4 h-4 text-rose-600" />} tone="rose" />
        <MetricCard label="Pending IT" value={stats.pendingIt} icon={<ClipboardList className="w-4 h-4 text-indigo-600" />} tone="indigo" />
        <MetricCard label="Urgent Req" value={stats.urgentRequests} icon={<Activity className="w-4 h-4 text-red-600" />} tone="red" />
        <MetricCard label="Asset Utilization Rate" value={`${utilization}%`} icon={<Package className="w-4 h-4 text-teal-600" />} tone="teal" />
      </div>

      <Card className="border-border/50 bg-gradient-to-r from-cyan-50 via-white to-indigo-50">
        <CardContent className="py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Snapshot</div>
              <div className="text-xs text-muted-foreground">{aiQuickPoints[0]}</div>
              <div className="text-xs text-muted-foreground">{aiQuickPoints[1]}</div>
            </div>
          </div>
          <Button size="sm" onClick={() => setIsAiOpen(true)}>View Full AI Details</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">AI Warranty Radar</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border bg-amber-50 border-amber-200 p-2">
                <div className="text-[11px] text-amber-700">Due within 45d</div>
                <div className="text-xl font-bold text-amber-800">{warrantyAlerts.length}</div>
              </div>
              <div className="rounded-lg border bg-rose-50 border-rose-200 p-2">
                <div className="text-[11px] text-rose-700">Out of Warranty</div>
                <div className="text-xl font-bold text-rose-800">{outOfWarrantyCount}</div>
              </div>
              <div className="rounded-lg border bg-cyan-50 border-cyan-200 p-2">
                <div className="text-[11px] text-cyan-700">Scrap Risk</div>
                <div className="text-xl font-bold text-cyan-800">{scrapCandidates.length}</div>
              </div>
            </div>
            {warrantyAlerts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No warranty alerts.</p>
            ) : (
              warrantyAlerts.slice(0, 4).map((row) => (
                <div key={`w-${row.assetId}`} className="rounded-md border p-2 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{row.assetTag}</div>
                    <div className="text-muted-foreground">{row.model}</div>
                  </div>
                  <Badge className={(row.warrantyDaysLeft ?? 1) < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                    {(row.warrantyDaysLeft ?? 0) < 0 ? `Expired ${Math.abs(row.warrantyDaysLeft || 0)}d` : `${row.warrantyDaysLeft}d left`}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">AI Scrap Intelligence</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 space-y-2">
            {scrapCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No high scrap-risk assets.</p>
            ) : (
              scrapCandidates.slice(0, 4).map((row) => (
                <div key={`s-${row.assetId}`} className="rounded-md border p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{row.assetTag}</span>
                    <Badge className="bg-rose-50 text-rose-700 border-rose-200">Risk {row.riskScore}%</Badge>
                  </div>
                  <div className="text-muted-foreground">{row.model}</div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <span>Issues: <strong>{row.issueCount}</strong></span>
                    <span>Repl.: <strong>{row.replacementCount}</strong></span>
                    <span>Dep.: <strong>{row.depreciationPct}%</strong></span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-base font-semibold">Ticket Command Center</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="text-xs text-red-700">Open</div>
                <div className="text-3xl font-bold text-red-800">{ticketCounts.open}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs text-amber-700">Pending</div>
                <div className="text-3xl font-bold text-amber-800">{ticketCounts.pending}</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs text-emerald-700">Closed</div>
                <div className="text-3xl font-bold text-emerald-800">{ticketCounts.closed}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-52 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ticketStatusSplit} dataKey="value" nameKey="name" innerRadius={44} outerRadius={78} paddingAngle={3}>
                      {ticketStatusSplit.map((slice, idx) => (
                        <Cell key={`${slice.name}-${idx}`} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-xs text-muted-foreground">Tickets</div>
                  <div className="text-3xl font-bold">{ticketCounts.open + ticketCounts.pending + ticketCounts.closed}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  {ticketStatusSplit.map((slice) => (
                    <div key={slice.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                        {slice.name}
                      </span>
                      <span className="font-semibold">{slice.value}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border/50">
                  <div className="text-xs text-muted-foreground mb-1">Priority Mix (Low / Medium / High)</div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketPrioritySplit}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {ticketPrioritySplit.map((row, idx) => (
                            <Cell key={`${row.name}-${idx}`} fill={row.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2 border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">Live Operational Feed</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {liveFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent events.</p>
            ) : (
              liveFeed.map((event) => (
                <div key={event.id} className="rounded-lg border border-border/50 p-2.5 bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={
                      event.type === 'ticket'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : event.type === 'request'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : event.type === 'maintenance'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }>
                      {event.type}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{new Date(event.when).toLocaleString()}</span>
                  </div>
                  <p className="text-xs mt-1.5 leading-5">{event.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold" data-testid="dashboard-assets-needing-attention">Assets Needing Attention</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 space-y-3">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attentionAssets} layout="vertical" margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="asset" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#f59e0b" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="text-[11px] font-medium text-muted-foreground">Request Pipeline</div>
              {requestPipeline.length === 0 ? (
                <div className="text-xs text-muted-foreground">No request records.</div>
              ) : (
                requestPipeline.map((row) => (
                  <div key={row.status} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{statusLabel(row.status)}</span>
                    <span className="font-semibold">{row.value}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Pending IT Fulfillment</CardTitle>
            <button onClick={() => navigate('/approvals')} className="text-xs text-primary hover:underline">Open</button>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {itQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending IT requests.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itQueue.slice(0, 8).map((req) => {
                    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="py-2">
                          <div className="text-xs font-medium">{req.requestNumber}</div>
                          <div className="text-[11px] text-muted-foreground">{req.requestType}</div>
                        </TableCell>
                        <TableCell className="text-xs py-2">{req.requesterName || req.requesterEmail}</TableCell>
                        <TableCell className="py-2">
                          <Badge className={
                            req.urgency === 'critical' || req.urgency === 'high'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : req.urgency === 'medium'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }>
                            {req.urgency}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs py-2">{ageDays}d</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold" data-testid="dashboard-recent-issuance-activity">Recent Issuance Activity</CardTitle>
            <button onClick={() => navigate('/issuance')} className="text-xs text-primary hover:underline">Open</button>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {recentIssuances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issuance records.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Asset</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentIssuances.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="py-2">
                        <div className="text-xs font-medium">{row.userName}</div>
                        <div className="text-[11px] text-muted-foreground">{row.userEmail}</div>
                      </TableCell>
                      <TableCell className="text-xs py-2 font-mono">{row.displayAssetId}</TableCell>
                      <TableCell className="text-xs py-2">{row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="py-2">
                        <Badge className={row.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}>
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[980px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-cyan-600" />
              AI Operations Brief
            </DialogTitle>
            <DialogDescription>
              Auto-generated summary from current dashboard data.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Key Insights</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 space-y-2">
                {aiQuickPoints.map((line, idx) => (
                  <div key={idx} className="text-sm rounded-md border bg-muted/10 p-2">{line}</div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Recommended Actions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 space-y-2">
                <div className="text-sm rounded-md border bg-muted/10 p-2">
                  Prioritize pending IT queue items older than 3 days first.
                </div>
                <div className="text-sm rounded-md border bg-muted/10 p-2">
                  Review asset hotspots and schedule preventive checks for repeat ticket assets.
                </div>
                <div className="text-sm rounded-md border bg-muted/10 p-2">
                  If urgent requests stay high, allocate backup stock to reduce approval-to-fulfillment time.
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 md:col-span-2">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Asset Intelligence Table</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Warranty</TableHead>
                      <TableHead>Replacements</TableHead>
                      <TableHead>Depreciation</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...scrapCandidates, ...warrantyAlerts]
                      .filter((row, idx, arr) => arr.findIndex(x => x.assetId === row.assetId) === idx)
                      .slice(0, 10)
                      .map((row) => (
                        <TableRow key={`ai-${row.assetId}`}>
                          <TableCell className="text-xs font-mono">{row.assetTag}</TableCell>
                          <TableCell className="text-xs">{row.model}</TableCell>
                          <TableCell className="text-xs">
                            {row.warrantyDaysLeft === null
                              ? '-'
                              : row.warrantyDaysLeft < 0
                                ? `Expired ${Math.abs(row.warrantyDaysLeft)}d`
                                : `${row.warrantyDaysLeft}d left`}
                          </TableCell>
                          <TableCell className="text-xs">{row.replacementCount}</TableCell>
                          <TableCell className="text-xs">{row.depreciationPct}%</TableCell>
                          <TableCell className="text-xs">
                            <Badge className={row.riskScore >= 70 ? 'bg-rose-50 text-rose-700 border-rose-200' : row.riskScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}>
                              {row.riskScore}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({
  testId,
  label,
  value,
  icon,
  tone
}: {
  testId?: string
  label: string
  value: string | number
  icon: React.ReactNode
  tone: 'slate' | 'emerald' | 'cyan' | 'amber' | 'rose' | 'indigo' | 'red' | 'teal'
}) {
  const toneClass = {
    slate: 'bg-slate-50 border-slate-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    cyan: 'bg-cyan-50 border-cyan-200',
    amber: 'bg-amber-50 border-amber-200',
    rose: 'bg-rose-50 border-rose-200',
    indigo: 'bg-indigo-50 border-indigo-200',
    red: 'bg-red-50 border-red-200',
    teal: 'bg-teal-50 border-teal-200'
  }[tone]

  return (
    <div className={`rounded-xl border p-2.5 ${toneClass}`} data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-xl font-bold mt-1 leading-none">{value}</div>
    </div>
  )
}

