import React, { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  User,
  Mail,
  Calendar,
  Laptop
} from 'lucide-react'
import { blink } from '../lib/blink'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'
import { toast } from 'sonner'
import { Card, CardContent } from '../components/ui/card'

export function Issuance() {
  const [issuances, setIssuances] = useState<any[]>([])
  const [availableAssets, setAvailableAssets] = useState<any[]>([])
  const [assetMap, setAssetMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [isIssueOpen, setIsIssueOpen] = useState(false)
  const [issueForm, setIssueForm] = useState({
    assetId: '',
    userName: '',
    userEmail: '',
  })

  const isRestrictedDevUser = () => {
    const raw = localStorage.getItem('sam_dev_user')
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw) as { email?: string }
      const email = (parsed?.email || '').toLowerCase()
      return email !== 'admin@demo.com'
    } catch {
      return true
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [issueData, allAssets] = await Promise.all([
        blink.db.issuances.list({ orderBy: { createdAt: 'desc' } }),
        blink.db.assets.list()
      ])
      const assetData = allAssets.filter((a: any) => a.status === 'available')
      // Filter out tickets from the issuances list
      const filteredIssuances = issueData.filter((i: any) => i.status === 'active')
      setIssuances(filteredIssuances)
      setAvailableAssets(assetData)
      const map: Record<string, any> = {}
      allAssets.forEach((a: any) => {
        map[a.id] = a
      })
      setAssetMap(map)
    } catch (error) {
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleIssueAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueForm.assetId) return toast.error('Please select an asset')

    try {
      const existingActive = await blink.db.issuances.list({
        where: { assetId: issueForm.assetId, status: 'active' },
        limit: 1
      })
      if (existingActive.length > 0) {
        toast.error('This asset is already issued to someone.')
        return
      }

      const selectedAsset = availableAssets.find(a => a.id === issueForm.assetId)

      // 1. Create issuance record
      await blink.db.issuances.create({
        ...issueForm,
        issueDate: new Date().toISOString(),
        status: 'active'
      })

      // 2. Update asset status AND assignment info
      await blink.db.assets.update(issueForm.assetId, {
        status: 'issued'
      })

      await blink.db.stockTransactions.create({
        assetId: issueForm.assetId,
        type: 'out',
        quantity: 1,
        reason: `Issued to ${issueForm.userName} (${issueForm.userEmail})`,
        createdAt: new Date().toISOString()
      })

      await blink.db.maintenance.create({
        assetId: issueForm.assetId,
        type: 'assignment',
        description: `Issued to ${issueForm.userName} (${issueForm.userEmail})`,
        date: new Date().toISOString(),
        performedBy: 'System (Auto-log)'
      })

      // 3. Send email notification
      await blink.notifications.email({
        to: issueForm.userEmail,
        subject: `Asset Handover: ${selectedAsset.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0d9488; padding: 24px; color: white;">
              <h1 style="margin: 0; font-size: 24px;">Asset Handover Confirmation</h1>
            </div>
            <div style="padding: 24px; color: #1e293b;">
              <p>Hello <strong>${issueForm.userName}</strong>,</p>
              <p>This is to confirm that the following IT asset has been issued to you:</p>
              <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0;"><strong>Asset:</strong> ${selectedAsset.name}</p>
                <p style="margin: 4px 0;"><strong>Serial Number:</strong> ${selectedAsset.serialNumber}</p>
                <p style="margin: 4px 0;"><strong>Issue Date:</strong> ${new Date().toLocaleDateString()}</p>
              </div>
              <p>Please ensure proper care of the company property. If you have any issues, please contact the IT support team.</p>
              <p style="margin-top: 32px; font-size: 14px; color: #64748b;">Best regards,<br>IT Asset Management Team</p>
            </div>
          </div>
        `
      })

      toast.success('Asset issued and email sent!')
      setIsIssueOpen(false)
      setIssueForm({ assetId: '', userName: '', userEmail: '' })
      fetchData()
    } catch (error) {
      console.error(error)
      toast.error('Error during issuance process')
    }
  }

  const handleReturnAsset = async (issuance: any) => {
    if (!confirm('Mark this asset as returned?')) return

    // Check for Dev Login
    if (isRestrictedDevUser()) {
      toast.error('Dev Login is read-only.')
      return
    }

    try {
      // 1. Update issuance status
      await blink.db.issuances.update(issuance.id, {
        status: 'returned',
        returnDate: new Date().toISOString()
      })

      // 2. Update asset status AND clear assignment info
      await blink.db.assets.update(issuance.assetId, {
        status: 'available'
      })

      await blink.db.stockTransactions.create({
        assetId: issuance.assetId,
        type: 'in',
        quantity: 1,
        reason: `Returned by ${issuance.userName} (${issuance.userEmail})`,
        createdAt: new Date().toISOString()
      })

      await blink.db.maintenance.create({
        assetId: issuance.assetId,
        type: 'assignment',
        description: `Returned by ${issuance.userName} (${issuance.userEmail})`,
        date: new Date().toISOString(),
        performedBy: 'System (Auto-log)'
      })

      toast.success('Asset marked as returned')
      fetchData()
    } catch (error) {
      toast.error('Error returning asset')
    }
  }

  const handleDeleteIssuance = async (issuance: any) => {
    if (!confirm('Delete this issuance record?')) return

    if (isRestrictedDevUser()) {
      toast.error('Dev Login is read-only.')
      return
    }

    try {
      await blink.db.issuances.delete(issuance.id)
      toast.success('Issuance record deleted')
      fetchData()
    } catch (error) {
      toast.error('Error deleting issuance record')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Asset Issuance</h1>
          <p className="text-muted-foreground">Manage handovers and track equipment distribution.</p>
        </div>

        <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              New Issuance
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Issue New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleIssueAsset} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Available Asset</label>
                <Select
                  value={issueForm.assetId}
                  onValueChange={v => setIssueForm({ ...issueForm, assetId: v })}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Search available hardware..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAssets.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">No available assets</div>
                    ) : (
                      availableAssets.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          <div className="flex flex-col">
                          <span className="font-medium">{asset.company || 'Other'} {asset.model || ''}</span>
                          <span className="text-xs opacity-50">Asset ID: {asset.serialNumber} â€¢ {asset.department || 'â€”'}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Employee Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      className="pl-10 h-12 rounded-xl"
                      placeholder="e.g. John Doe"
                      value={issueForm.userName}
                      onChange={e => setIssueForm({ ...issueForm, userName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Employee Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      type="email"
                      className="pl-10 h-12 rounded-xl"
                      placeholder="john.doe@company.com"
                      value={issueForm.userEmail}
                      onChange={e => setIssueForm({ ...issueForm, userEmail: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex gap-3 items-start mt-2">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80 leading-relaxed">
                  The employee will receive an automated email notification regarding this issuance.
                </p>
              </div>

              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full h-12 rounded-xl text-lg shadow-lg shadow-primary/20">Confirm Issuance</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[250px]">Employee</TableHead>
              <TableHead>Asset Details</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Return Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><div className="h-12 bg-muted/50 animate-pulse rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : issuances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ArrowLeftRight className="w-8 h-8 opacity-20" />
                    <p>No issuance records found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              issuances.map((issuance) => (
                <TableRow key={issuance.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {issuance.userName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{issuance.userName}</p>
                        <p className="text-xs text-muted-foreground">{issuance.userEmail}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const asset = assetMap[issuance.assetId]
                      return (
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {asset ? `${asset.company || 'Other'} ${asset.model || ''}` : `Asset ID: ${issuance.assetId.split('_').pop()}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {asset ? `Asset ID: ${asset.serialNumber} â€¢ ${asset.department || 'â€”'}` : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(issuance.issueDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {issuance.returnDate ? new Date(issuance.returnDate).toLocaleDateString() : 'â€”'}
                  </TableCell>
                  <TableCell>
                    <Badge className={issuance.status === 'active'
                      ? "bg-blue-50 text-blue-600 border-blue-100"
                      : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    }>
                      {issuance.status === 'active' ? 'Issued' : issuance.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {issuance.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-9 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                          onClick={() => handleReturnAsset(issuance)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark Returned
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteIssuance(issuance)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

