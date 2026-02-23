import React, { useEffect, useState } from 'react'
import { dataClient } from '../lib/dataClient'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../components/ui/table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { toast } from 'sonner'
import { History, Wrench } from 'lucide-react'

interface MaintenanceLog {
    id: string
    assetId: string
    type: 'maintenance' | 'assignment' | 'issue'
    description: string
    cost?: number
    warrantyExpiry?: string
    date: string
    performedBy: string
}

interface TicketLog {
    id: string
    assetId: string
    userName: string
    userEmail: string
    status: string
    issueDate?: string
    resolvedDate?: string
    createdAt?: string
    updatedAt?: string
}

type HistoryItem = {
    id: string
    date: string
    kind: 'ticket_open' | 'ticket_resolved' | 'maintenance'
    title: string
    details?: string
    meta?: string
}

export function AssetHistory({ assetId, assetName, serialNumber }: { assetId: string, assetName?: string, serialNumber?: string }) {
    const [logs, setLogs] = useState<HistoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddOpen, setIsAddOpen] = useState(false)

    // New Log State
    const [newLog, setNewLog] = useState({
        description: '',
        cost: '',
        warrantyExpiry: '',
        type: 'maintenance'
    })

    useEffect(() => {
        fetchHistory()
    }, [assetId])

    const parseTicketName = (packed: string) => {
        const parts = packed?.split(' ||| ') || []
        return {
            reportedBy: parts[0] || 'Unknown',
            category: parts[1] || 'Issue',
            priority: parts[2] || 'medium',
            assetName: parts[3] || 'Unknown',
            description: parts[4] || '',
            resolutionNote: parts[5] || ''
        }
    }

    const fetchHistory = async () => {
        try {
            let allLogs: MaintenanceLog[] = []
            let allTickets: TicketLog[] = []

            try {
                allLogs = await dataClient.db.maintenance.list({ where: { assetId } }) as MaintenanceLog[]
            } catch (err) {
                console.error('Failed to load maintenance logs:', err)
            }

            try {
                allTickets = await dataClient.db.issuances.list({ where: { assetId } }) as TicketLog[]
                if (allTickets.length === 0 && (assetName || serialNumber)) {
                    // Fallback for legacy ticket records that may have missing/incorrect assetId.
                    allTickets = await dataClient.db.issuances.list() as TicketLog[]
                }
            } catch (err) {
                console.error('Failed to load ticket logs:', err)
            }

            const assetLogs = allLogs.filter(l => l.assetId === assetId)
            const assetTickets = allTickets.filter(t => {
                if (!t || !t.status || !t.status.startsWith('ticket_')) return false
                if (t.assetId === assetId) return true
                const parsed = parseTicketName(t.userName || '')
                const nameMatch = assetName && parsed.assetName && parsed.assetName.toLowerCase().includes(assetName.toLowerCase())
                const serialMatch = serialNumber && parsed.assetName && parsed.assetName.toLowerCase().includes(serialNumber.toLowerCase())
                return Boolean(nameMatch || serialMatch)
            })

            const maintenanceItems: HistoryItem[] = assetLogs.map(l => ({
                id: l.id,
                date: l.date,
                kind: 'maintenance',
                title: l.description,
                details: l.performedBy ? `By: ${l.performedBy}` : undefined,
                meta: l.type
            }))

            const ticketItems: HistoryItem[] = assetTickets.flatMap(t => {
                const parsed = parseTicketName(t.userName || '')
                const openItem: HistoryItem = {
                    id: `${t.id}-open`,
                    date: t.issueDate || t.createdAt || new Date().toISOString(),
                    kind: 'ticket_open',
                    title: parsed.category,
                    details: parsed.description,
                    meta: `Reported by: ${parsed.reportedBy}`
                }
                if (t.status === 'ticket_resolved') {
                    const resolvedFromMaintenance = assetLogs.find(l =>
                        l.type === 'issue' &&
                        l.description?.includes(`Resolved ticket:`) &&
                        l.description?.includes(parsed.category)
                    )
                    const resolvedAt = resolvedFromMaintenance?.date || t.updatedAt
                    const resolvedItem: HistoryItem = {
                        id: `${t.id}-resolved`,
                        date: resolvedAt || openItem.date,
                        kind: 'ticket_resolved',
                        title: `Resolved: ${parsed.category}`,
                        details: parsed.resolutionNote || 'No resolution notes',
                        meta: `Closed by IT`
                    }
                    return [openItem, resolvedItem]
                }
                return [openItem]
            })

            const combined = [...maintenanceItems, ...ticketItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setLogs(combined)
        } catch (error) {
            console.error('Error fetching history:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await dataClient.db.maintenance.create({
                assetId,
                type: newLog.type,
                description: newLog.description,
                cost: newLog.cost ? parseFloat(newLog.cost) : undefined,
                warrantyExpiry: newLog.warrantyExpiry,
                date: new Date().toISOString(),
                performedBy: 'Admin' // Should be current user name
            })
            toast.success('History log added')
            setIsAddOpen(false)
            setNewLog({ description: '', cost: '', warrantyExpiry: '', type: 'maintenance' })
            fetchHistory()
        } catch (error) {
            toast.error('Failed to add log')
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Asset History
                </h3>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                            <Wrench className="w-4 h-4 mr-2" />
                            Log Maintenance
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Log Maintenance / Event</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddLog} className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                    required
                                    placeholder="e.g. Battery Replaced, Screen Fixed"
                                    value={newLog.description}
                                    onChange={e => setNewLog({ ...newLog, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cost (Optional)</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={newLog.cost}
                                        onChange={e => setNewLog({ ...newLog, cost: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Warranty Expiry</label>
                                    <Input
                                        type="date"
                                        value={newLog.warrantyExpiry}
                                        onChange={e => setNewLog({ ...newLog, warrantyExpiry: e.target.value })}
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="w-full">Save Log</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Meta</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No history recorded.</TableCell></TableRow>
                        ) : (
                            logs.map(log => (
                                <TableRow key={log.id}>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(log.date).toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {log.kind === 'maintenance' ? 'Maintenance' : log.kind === 'ticket_open' ? 'Ticket Opened' : 'Ticket Resolved'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{log.title}</span>
                                            {log.details && <span className="text-xs text-muted-foreground">{log.details}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{log.meta || '-'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

