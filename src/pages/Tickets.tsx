import React, { useEffect, useState } from 'react'
import {
    Ticket,
    Search,
    Filter,
    MoreVertical,
    CheckCircle2,
    Clock,
    AlertCircle,
    User,
    MessageSquare
} from 'lucide-react'
import { blink } from '../lib/blink'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '../components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '../components/ui/dropdown-menu'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '../components/ui/dialog'
import { toast } from 'sonner'

export function Tickets() {
    const [tickets, setTickets] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('all')
    const [selectedTicket, setSelectedTicket] = useState<any>(null)
    const [isUpdateOpen, setIsUpdateOpen] = useState(false)
    const [resolutionNote, setResolutionNote] = useState('')

    useEffect(() => {
        fetchTickets()
    }, [])

    const fetchTickets = async () => {
        try {
            console.log('🔍 Fetching tickets from issuances...')
            const data = await blink.db.issuances.list({ orderBy: { issueDate: 'desc' } })
            console.log('📝 Loaded data:', data)

            // Filter and Unpack ticket records
            const processedTickets = data
                .filter((t: any) => t && t.status && t.status.startsWith('ticket_'))
                .map((t: any) => {
                    if (t.userName && t.userName.includes('|||')) {
                        const parts = t.userName.split(' ||| ');
                        return {
                            ...t,
                            packed: true,
                            realUserName: parts[0],
                            category: parts[1],
                            priority: parts[2],
                            assetName: parts[3],
                            description: parts[4],
                            resolutionNote: parts[5]
                        };
                    }
                    return { ...t, packed: false, realUserName: t.userName };
                });
            setTickets(processedTickets)
        } catch (error) {
            console.error('Failed to fetch tickets', error)
            toast.error('Failed to load tickets. Please refresh.')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (newStatus: string) => {
        if (!selectedTicket) return
        try {
            console.log('🔄 Updating ticket status:', selectedTicket.id, newStatus)

            // Pack metadata including the new resolution note
            // Format: display_name ||| category/subcategory ||| priority ||| asset_name ||| issue_description ||| resolution_note
            const parts = selectedTicket.userName.split(' ||| ');
            // Ensure we have at least 5 parts before adding the 6th
            while (parts.length < 5) parts.push('');
            parts[5] = resolutionNote;
            const updatedPackedName = parts.join(' ||| ');

            await blink.db.issuances.update(selectedTicket.id, {
                status: newStatus,
                userName: updatedPackedName
            })

            // Auto-log to maintenance history if resolved
            if (newStatus === 'ticket_resolved' && selectedTicket.assetId) {
                try {
                    await blink.db.maintenance.create({
                        assetId: selectedTicket.assetId,
                        type: 'issue',
                        description: `Resolved ticket: ${selectedTicket.category}. Note: ${resolutionNote || 'No notes provided'}`,
                        date: new Date().toISOString(),
                        performedBy: 'System (Auto-log)'
                    })
                } catch (logError) {
                    console.error('Failed to auto-log maintenance:', logError)
                }
            }

            toast.success(`Ticket marked as ${newStatus.replace('ticket_', '')}`)
            setIsUpdateOpen(false)
            setResolutionNote('')
            fetchTickets()
        } catch (error: any) {
            console.error('❌ Status Update Error:', error)
            toast.error(`Failed to update ticket: ${error.message || 'Server error'}`)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ticket_open': return <Badge className="bg-red-50 text-red-600 border-red-100">Open</Badge>
            case 'ticket_in-progress': return <Badge className="bg-blue-50 text-blue-600 border-blue-100">In Progress</Badge>
            case 'ticket_resolved': return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100">Resolved</Badge>
            case 'ticket_return': return <Badge className="bg-amber-50 text-amber-600 border-amber-100">Return Request</Badge>
            default: return <Badge variant="secondary">{status.replace('ticket_', '')}</Badge>
        }
    }

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'high': return <AlertCircle className="w-4 h-4 text-red-500" />
            case 'medium': return <Clock className="w-4 h-4 text-amber-500" />
            default: return <CheckCircle2 className="w-4 h-4 text-blue-500" />
        }
    }

    const filteredTickets = tickets.filter(t =>
        filterStatus === 'all' || t.status === filterStatus
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
                <p className="text-muted-foreground">Manage and resolve user reported issues.</p>
            </div>

            <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="ticket_open">Open</SelectItem>
                                <SelectItem value="ticket_in-progress">In Progress</SelectItem>
                                <SelectItem value="ticket_resolved">Resolved</SelectItem>
                                <SelectItem value="ticket_return">Returns</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="relative w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search tickets..."
                            className="pl-10 bg-muted/30 border-none rounded-xl"
                        />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead>Ticket ID</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Asset</TableHead>
                            <TableHead>Reported By</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <TableRow key={i}>
                                    <TableCell colSpan={7}><div className="h-12 bg-muted/50 animate-pulse rounded-lg" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredTickets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Ticket className="w-8 h-8 opacity-20" />
                                        <p>No tickets found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTickets.map((ticket) => (
                                <TableRow key={ticket.id || Math.random()} className="hover:bg-muted/20 transition-colors">
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        #{ticket.id ? ticket.id.slice(0, 8) : 'unknown'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium text-sm">
                                            {ticket.category || 'Issue'}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={ticket.description}>
                                            {ticket.description || 'No details provided'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {ticket.assetName || 'Unknown Asset'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] items-center text-primary">
                                                <User className="w-3 h-3" />
                                            </div>
                                            <span className="text-sm">{ticket.realUserName || ticket.userEmail || 'Unknown'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getPriorityIcon(ticket.priority)}
                                            <span className="capitalize text-sm">{ticket.priority}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedTicket(ticket)
                                                setIsUpdateOpen(true)
                                            }}
                                        >
                                            Manage
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Ticket Status</DialogTitle>
                    </DialogHeader>
                    {selectedTicket && (
                        <div className="space-y-4 py-4">
                            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm font-semibold text-primary">{selectedTicket.category}</span>
                                </div>
                                <div className="text-sm text-foreground whitespace-pre-wrap pt-1 border-t border-border/10">
                                    {selectedTicket.description}
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/5">
                                    <span>Asset: {selectedTicket.assetName}</span>
                                    <span>User: {selectedTicket.realUserName}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Resolution Notes (Optional)</label>
                                <Textarea
                                    placeholder="Add notes about the resolution..."
                                    value={resolutionNote}
                                    onChange={(e) => setResolutionNote(e.target.value)}
                                    className="min-h-[80px]"
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    Notes will be visible to the user in their ticket history once resolved.
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    variant={selectedTicket.status === 'ticket_open' ? 'default' : 'outline'}
                                    onClick={() => handleUpdateStatus('ticket_open')}
                                    className="w-full"
                                >
                                    Open
                                </Button>
                                <Button
                                    variant={selectedTicket.status === 'ticket_in-progress' ? 'default' : 'outline'}
                                    onClick={() => handleUpdateStatus('ticket_in-progress')}
                                    className="w-full"
                                >
                                    In Progress
                                </Button>
                                <Button
                                    variant={selectedTicket.status === 'ticket_resolved' ? 'default' : 'outline'}
                                    onClick={() => handleUpdateStatus('ticket_resolved')}
                                    className="w-full"
                                >
                                    Resolved
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    )
}
