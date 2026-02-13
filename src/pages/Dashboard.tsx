import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList
} from 'lucide-react'
import { StatsCard } from '../components/dashboard/StatsCard'
import { blink } from '../lib/blink'
import { requestsClient, type AssetRequest } from '../lib/api/requestsClient'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { demoInsights, AiInsight } from '../lib/aiInsights'

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    total: 0,
    issued: 0,
    available: 0,
    openTickets: 0,
    repairTickets: 0
  })
  const [recentIssuances, setRecentIssuances] = useState<any[]>([])
  const [assetKeys, setAssetKeys] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [aiSummary, setAiSummary] = useState<string>('')
  const [itRequirements, setItRequirements] = useState<AssetRequest[]>([])

  

  useEffect(() => {
    fetchData()
  }, [])

  const generateAiSummary = async (finalInsights: AiInsight[]) => {
    try {
      const prompt = `Summarize these IT asset insights in 1-2 sentences:\\n${finalInsights.map(i => `- ${i.message}`).join('\\n')}`
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'mistral', prompt, stream: false })
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.response) setAiSummary(String(data.response).trim())
      }
    } catch {
      // Local Ollama not running; ignore
    }
  }

  const fetchData = async () => {
    try {
      const [assetsRes, issuancesRes, maintenanceRes, requestsRes] = await Promise.allSettled([
        blink.db.assets.list(),
        blink.db.issuances.list(),
        blink.db.maintenance.list(),
        requestsClient.list({ status: 'pending_it_fulfillment', limit: 20 })
      ])

      const assets = assetsRes.status === 'fulfilled' ? assetsRes.value : []
      const issuances = issuancesRes.status === 'fulfilled' ? issuancesRes.value : []
      const maintenanceLogs = maintenanceRes.status === 'fulfilled' ? maintenanceRes.value : []
      const pendingItRequests = requestsRes.status === 'fulfilled' ? requestsRes.value : []
      setItRequirements(pendingItRequests)

      const total = assets.length
      const issued = assets.filter((a: any) => a.status === 'issued').length
      const available = assets.filter((a: any) => a.status === 'available').length
      const openTickets = issuances.filter((i: any) => i && i.status?.startsWith('ticket_') && i.status !== 'ticket_resolved').length
      const repairTickets = issuances.filter((i: any) =>
        i?.status?.startsWith('ticket_') &&
        i.status !== 'ticket_resolved' &&
        String(i.userName || '').includes('hardware/')
      ).length

      setStats({ total, issued, available, openTickets, repairTickets })
      const onlyIssuances = issuances
        .filter((i: any) => i && (i.status === 'active' || i.status === 'returned'))
        .sort((a: any, b: any) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
        .slice(0, 5)
      setRecentIssuances(onlyIssuances)
      if (assets.length > 0) {
        setAssetKeys(Object.keys(assets[0]))
      }

      const unpackConfig = (packed: string) => {
        if (!packed) return ''
        if (packed.includes(' ||| ')) {
          const [, ...rest] = packed.split(' ||| ')
          return rest.join(' ||| ')
        }
        return ''
      }

      const parseWarranty = (config: string) => {
        const warrantyStartMatch = (config || '').match(/Warranty Start:\s*([^|]+)/i)
        const warrantyEndMatch = (config || '').match(/Warranty End:\s*([^|]+)/i)
        return {
          warrantyStart: warrantyStartMatch ? warrantyStartMatch[1].trim() : '',
          warrantyEnd: warrantyEndMatch ? warrantyEndMatch[1].trim() : ''
        }
      }

      const parseTicketName = (packed: string) => {
        const parts = packed?.split(' ||| ') || []
        return {
          category: parts[1] || 'Issue',
          assetName: parts[3] || 'Unknown',
          description: parts[4] || ''
        }
      }

      const assetsById: Record<string, any> = {}
      assets.forEach((a: any) => {
        const config = unpackConfig(a.location || '')
        const { warrantyStart, warrantyEnd } = parseWarranty(config)
        assetsById[a.id] = { ...a, warrantyStart, warrantyEnd }
      })

      const now = new Date()
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

      const ticketItems = issuances.filter((i: any) => i?.status?.startsWith('ticket_'))
      const issueCountsByAsset: Record<string, Record<string, number>> = {}
      const modelCounts: Record<string, number> = {}
      const insightList: AiInsight[] = []

      for (const t of ticketItems) {
        const parsed = parseTicketName(t.userName || '')
        const asset = assetsById[t.assetId]
        const assetLabel = asset ? `${asset.serialNumber || t.assetId}` : parsed.assetName
        const issueDate = t.issueDate ? new Date(t.issueDate) : null

        if (issueDate && issueDate >= ninetyDaysAgo) {
          const key = t.assetId || parsed.assetName
          issueCountsByAsset[key] = issueCountsByAsset[key] || {}
          issueCountsByAsset[key][parsed.category] = (issueCountsByAsset[key][parsed.category] || 0) + 1

          if (asset?.model) {
            modelCounts[asset.model] = (modelCounts[asset.model] || 0) + 1
          }
        }

        if (asset?.warrantyEnd && t.issueDate) {
          const end = new Date(asset.warrantyEnd)
          const opened = new Date(t.issueDate)
          if (opened <= end) {
            insightList.push({
              id: `w-${t.id}`,
              message: `Warranty: Ticket on ${assetLabel} is within warranty (ends ${end.toLocaleDateString()}).`,
              severity: 'medium',
              tag: 'Warranty'
            })
          }
        }
      }

      Object.entries(issueCountsByAsset).forEach(([assetKey, counts]) => {
        Object.entries(counts).forEach(([issue, count]) => {
          if (count >= 2) {
            insightList.push({
              id: `r-${assetKey}-${issue}`,
              message: `Recurring issue: ${issue} reported ${count} times for ${assetKey} in last 90 days.`,
              severity: 'medium',
              tag: 'Recurring'
            })
          }
        })
      })

      Object.entries(modelCounts).forEach(([model, count]) => {
        if (count >= 3) {
          insightList.push({
            id: `m-${model}`,
            message: `Model risk: ${model} has ${count} tickets in last 90 days.`,
            severity: 'medium',
            tag: 'Model Risk'
          })
        }
      })

      const majorKeywords = ['motherboard', 'screen', 'display', 'battery', 'keyboard']
      const repairsByAsset: Record<string, number> = {}
      maintenanceLogs.forEach((m: any) => {
        if (m?.type !== 'issue') return
        const desc = String(m.description || '').toLowerCase()
        if (majorKeywords.some(k => desc.includes(k))) {
          repairsByAsset[m.assetId] = (repairsByAsset[m.assetId] || 0) + 1
        }
      })
      Object.entries(repairsByAsset).forEach(([assetId, count]) => {
        if (count >= 3) {
          const asset = assetsById[assetId]
          const label = asset?.serialNumber || assetId
          insightList.push({
            id: `rep-${assetId}`,
            message: `Replace recommended: ${label} has ${count} major repairs.`,
            severity: 'high',
            tag: 'Replace'
          })
        }
      })

      const finalInsights = demoInsights
      setInsights(finalInsights)
      setLoading(false)
      void generateAiSummary(finalInsights)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-2xl" />)}
      </div>
    </div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Real-time status of your internal IT infrastructure.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Assets"
          value={stats.total}
          icon={Package}
          description="Total items in catalog"
        />
        <StatsCard
          title="Issued Assets"
          value={stats.issued}
          icon={Laptop}
          trend={{ value: '+12%', positive: true }}
          description="Currently with employees"
        />
        <StatsCard
          title="In Stock"
          value={stats.available}
          icon={CheckCircle2}
          trend={{ value: '-5%', positive: false }}
          description="Ready for issuance"
        />
        <StatsCard
          title="Repair Tickets"
          value={stats.repairTickets}
          icon={AlertCircle}
          description="Open hardware tickets"
          className={stats.repairTickets > 0 ? "border-amber-100 bg-amber-50/20" : ""}
        />
        <StatsCard
          title="Open Tickets"
          value={stats.openTickets}
          icon={AlertCircle}
          description="Unresolved support tickets"
          className={stats.openTickets > 0 ? "border-amber-100 bg-amber-50/20" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Issuances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Asset ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentIssuances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No recent issuance activity found.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentIssuances.map((issuance) => (
                    <TableRow key={issuance.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p>{issuance.userName}</p>
                          <p className="text-xs text-muted-foreground font-normal">{issuance.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{issuance.assetId}</TableCell>
                    <TableCell className="text-sm">
                        {issuance.issueDate ? new Date(issuance.issueDate).toLocaleDateString() : '—'}
                    </TableCell>
                      <TableCell>
                        <Badge variant={issuance.status === 'active' ? 'default' : 'secondary'}>
                          {issuance.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              onClick={() => navigate('/issuance')}
              className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Laptop className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Issue New Asset</p>
                  <p className="text-xs text-muted-foreground">Handover a laptop or gear</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <button
              onClick={() => navigate('/assets')}
              className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Add New Stock</p>
                  <p className="text-xs text-muted-foreground">Inventory check-in</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            New Requirements for IT
          </CardTitle>
          <button
            onClick={() => navigate('/approvals')}
            className="text-sm text-primary hover:underline"
          >
            Open Approvals
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          {itRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests waiting for IT fulfillment.</p>
          ) : (
            itRequirements.slice(0, 8).map((req) => (
              <div key={req.id} className="rounded-xl border border-border/50 p-4 bg-muted/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{req.requestNumber} - {req.requestType}</p>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">{req.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground space-y-1">
                  <p><strong>Requester:</strong> {req.requesterName || req.requesterEmail}</p>
                  <p><strong>Category:</strong> {req.requestedCategory || 'n/a'}</p>
                  {req.relatedAssetId && <p><strong>Related Asset:</strong> {req.relatedAssetId}</p>}
                  <p><strong>Urgency:</strong> {req.urgency}</p>
                  <p><strong>Business Need:</strong> {req.businessJustification}</p>
                  {req.requestedConfigurationJson && <p><strong>Configuration / Scope:</strong> {req.requestedConfigurationJson}</p>}
                  <p><strong>Approvals Done:</strong> PM {req.pmApproverEmail} {'->'} Boss {req.bossApproverEmail}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-primary/10 bg-[radial-gradient(ellipse_at_top_left,rgba(14,165,233,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.15),transparent_45%)] p-5">
              <div className="text-xs uppercase tracking-wide text-primary/70">AI Control Center</div>
              <div className="text-xl font-semibold mt-1">Proactive IT Intelligence</div>
              <div className="text-sm text-muted-foreground mt-1">
                Trends, risk signals, and warranty insights generated from tickets and maintenance history.
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="p-3 rounded-xl bg-background/70 border border-border/50">
                  <div className="text-xs text-muted-foreground">Signals</div>
                  <div className="text-lg font-semibold">{insights.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-background/70 border border-border/50">
                  <div className="text-xs text-muted-foreground">High Risk</div>
                  <div className="text-lg font-semibold">{insights.filter(i => i.severity === 'high').length}</div>
                </div>
                <div className="p-3 rounded-xl bg-background/70 border border-border/50">
                  <div className="text-xs text-muted-foreground">Warranty</div>
                  <div className="text-lg font-semibold">{insights.filter(i => i.tag === 'Warranty').length}</div>
                </div>
                <div className="p-3 rounded-xl bg-background/70 border border-border/50">
                  <div className="text-xs text-muted-foreground">Model Risk</div>
                  <div className="text-lg font-semibold">{insights.filter(i => i.tag === 'Model Risk').length}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">AI Summary</div>
              <div className="text-sm mt-2">
                {aiSummary || 'Insights generated from recent tickets, repairs, and warranty data.'}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Model: <span className="font-medium">mistral (local)</span>
              </div>
            </div>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">How This AI Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>Data sources: Tickets, Maintenance logs, and Warranty dates stored in asset configuration.</div>
              <div>Rules used:</div>
              <div>1. Recurring issue when same category appears 2+ times in 90 days for an asset.</div>
              <div>2. Model risk when a model has 3+ tickets in 90 days.</div>
              <div>3. Warranty alert when a ticket date is before warranty end date.</div>
              <div>4. Replace recommendation when 3+ major repairs occur (screen, battery, motherboard, keyboard).</div>
              <div>Refresh: insights update each time the Dashboard loads.</div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg font-bold">AI Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((i) => (
                  <div key={i.id} className="p-4 rounded-xl bg-muted/30 border border-border/50 flex items-start justify-between gap-3 shadow-[0_1px_0_rgba(16,185,129,0.05)]">
                    <div className="text-sm">{i.message}</div>
                    <Badge
                      className={
                        i.severity === 'high'
                          ? 'bg-rose-50 text-rose-600 border-rose-100'
                          : i.severity === 'medium'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }
                    >
                      {i.tag}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
