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
import { dataClient } from '../lib/dataClient'
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
  const [users, setUsers] = useState<any[]>([])
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
      const [issueData, allAssets, allUsers] = await Promise.all([
        dataClient.db.issuances.list({ orderBy: { createdAt: 'desc' } }),
        dataClient.db.assets.list(),
        dataClient.db.users.list()
      ])
      const assetData = allAssets.filter((a: any) => a.status === 'available')
      // Filter out tickets from the issuances list
      const filteredIssuances = issueData.filter((i: any) => i.status === 'active')
      setIssuances(filteredIssuances)
      setAvailableAssets(assetData)
      setUsers((allUsers || []).filter((u: any) => u?.email && String(u.email).includes('@')))
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
      const existingActive = await dataClient.db.issuances.list({
        where: { assetId: issueForm.assetId, status: 'active' },
        limit: 1
      })
      if (existingActive.length > 0) {
        toast.error('This asset is already issued to someone.')
        return
      }

      const selectedAsset = availableAssets.find(a => a.id === issueForm.assetId)
      const selectedAssetMeta = selectedAsset ? getAssetMeta(selectedAsset) : { title: '', company: '', model: '', department: '' }
      const selectedPacked = unpackLocation(selectedAsset?.location || '')
      const selectedConfig = (
        selectedAsset?.configuration ||
        selectedPacked.configuration ||
        ''
      ).trim()

      // 1. Create issuance record
      await dataClient.db.issuances.create({
        ...issueForm,
        issueDate: new Date().toISOString(),
        status: 'active'
      })

      // 2. Update asset status AND assignment info
      await dataClient.db.assets.update(issueForm.assetId, {
        status: 'issued'
      })

      await dataClient.db.stockTransactions.create({
        assetId: issueForm.assetId,
        type: 'out',
        quantity: 1,
        reason: `Issued to ${issueForm.userName} (${issueForm.userEmail})`,
        createdAt: new Date().toISOString()
      })

      await dataClient.db.maintenance.create({
        assetId: issueForm.assetId,
        type: 'assignment',
        description: `Issued to ${issueForm.userName} (${issueForm.userEmail})`,
        date: new Date().toISOString(),
        performedBy: 'System (Auto-log)'
      })

      // 3. Send email notification (non-blocking: issuance should still complete if email fails)
      let emailSent = false
      try {
        await dataClient.notifications.email({
          to: issueForm.userEmail,
          subject: `Asset Handover: ${selectedAssetMeta.title || selectedAsset?.name || issueForm.assetId}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background: #0d9488; padding: 24px; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Asset Handover Confirmation</h1>
              </div>
              <div style="padding: 24px; color: #1e293b;">
                <p>Hello <strong>${issueForm.userName}</strong>,</p>
                <p>This is to confirm that the following IT asset has been issued to you:</p>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 4px 0;"><strong>Asset:</strong> ${selectedAssetMeta.title || selectedAsset?.name || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Asset ID:</strong> ${selectedAsset?.serialNumber || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Serial Number:</strong> ${selectedAsset?.deviceSerialNumber || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Issue Date:</strong> ${new Date().toLocaleDateString()}</p>
                  <p style="margin: 4px 0;"><strong>Company:</strong> ${selectedAssetMeta.company || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Model:</strong> ${selectedAssetMeta.model || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Department:</strong> ${selectedAssetMeta.department || '-'}</p>
                  <p style="margin: 4px 0;"><strong>Configuration:</strong> ${selectedConfig || '-'}</p>
                </div>
                <p style="margin: 16px 0 8px 0;"><strong>The laptop issued to you with the below-mentioned understanding:</strong></p>
                <ul style="margin: 0 0 0 18px; padding: 0; color: #1e293b; line-height: 1.6;">
                  <li style="margin: 6px 0;">The laptop issued is for solely official purposes.</li>
                  <li style="margin: 6px 0;">The employee shall be fully accountable for theft and loss to the property.</li>
                  <li style="margin: 6px 0;">Any additional software or hardware required by employees (before or after taking handover) is clearly communicated through mail to the Systems Admin. Management is at the sole discretion of approving such requests.</li>
                  <li style="margin: 6px 0;">In case of any malfunction, employees are required to report the same to the Systems Admin (<a href="mailto:k.manish@kavitechsolution.com" style="color:#0d9488;">k.manish@kavitechsolution.com</a>).</li>
                  <li style="margin: 6px 0;">Employees may not take the laptop for repair to any external agency or vendor at any point in time.</li>
                  <li style="margin: 6px 0;">The laptop must be returned to the Systems Admin Department if it leaves the organization or does not intend to use it for any reason.</li>
                </ul>
                <p>Please ensure proper care of the company property. If you have any issues, please contact the IT support team.</p>
                <p style="margin-top: 32px; font-size: 14px; color: #64748b;">Best regards,<br>IT Asset Management Team</p>
              </div>
            </div>
          `
        })
        emailSent = true
      } catch (emailError) {
        console.error('Issuance completed but email failed:', emailError)
      }

      if (emailSent) {
        toast.success('Asset issued and email sent!')
      } else {
        toast.success('Asset issued successfully')
        toast.warning('Email notification failed. Please check SMTP/O365 mailbox settings.')
      }
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
      await dataClient.db.issuances.update(issuance.id, {
        status: 'returned',
        returnDate: new Date().toISOString()
      })

      // 2. Update asset status AND clear assignment info
      await dataClient.db.assets.update(issuance.assetId, {
        status: 'available'
      })

      await dataClient.db.stockTransactions.create({
        assetId: issuance.assetId,
        type: 'in',
        quantity: 1,
        reason: `Returned by ${issuance.userName} (${issuance.userEmail})`,
        createdAt: new Date().toISOString()
      })

      await dataClient.db.maintenance.create({
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
      await dataClient.db.issuances.delete(issuance.id)
      toast.success('Issuance record deleted')
      fetchData()
    } catch (error) {
      toast.error('Error deleting issuance record')
    }
  }

  const unpackLocation = (packed?: string) => {
    if (!packed) return { location: '', configuration: '' }
    if (packed.includes(' ||| ')) {
      const [location, ...rest] = packed.split(' ||| ')
      return { location: location || '', configuration: rest.join(' ||| ') || '' }
    }
    return { location: packed, configuration: '' }
  }

  const extractFromConfig = (config: string, label: string) => {
    const match = config.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'))
    return match ? match[1].trim() : ''
  }

  const getAssetMeta = (asset: any) => {
    const { configuration } = unpackLocation(asset?.location || '')
    const company = (asset?.company || extractFromConfig(configuration, 'Company') || '').trim()
    const model = (asset?.model || extractFromConfig(configuration, 'Model') || '').trim()
    const department = (asset?.department || extractFromConfig(configuration, 'Department') || '').trim()
    const title = [company, model].filter(Boolean).join(' ').trim() || asset?.name || `Asset ${asset?.serialNumber || ''}`.trim()
    return { title, company, model, department }
  }

  const selectedIssueAsset = availableAssets.find(a => a.id === issueForm.assetId)
  const userChoices = users
    .map((u: any) => ({
      name: (u.name || u.displayName || String(u.email).split('@')[0]).trim(),
      email: String(u.email).trim().toLowerCase()
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

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
          <DialogContent className="w-[96vw] max-w-[1040px] max-h-[90vh] overflow-hidden p-0">
            <DialogHeader className="px-6 py-4 border-b">
              <DialogTitle>Issue New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleIssueAsset} className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 py-4 overflow-y-auto max-h-[calc(90vh-84px)]">
              <div className="space-y-2 lg:col-span-2">
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
                          {(() => {
                            const meta = getAssetMeta(asset)
                            return (
                              <div className="flex flex-col">
                                <span className="font-medium">{meta.title}</span>
                                <span className="text-xs opacity-50">
                                  Model: {meta.model || '-'} | Asset ID: {asset.serialNumber || '-'} | Serial: {asset.deviceSerialNumber || '-'}
                                </span>
                              </div>
                            )
                          })()}
                      </SelectItem>
                    ))
                  )}
                  </SelectContent>
                </Select>
              </div>

              {selectedIssueAsset && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:col-span-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset ID</label>
                    <Input
                      readOnly
                      value={selectedIssueAsset.serialNumber || '-'}
                      className="h-12 rounded-xl bg-muted/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Serial Number</label>
                    <Input
                      readOnly
                      value={selectedIssueAsset.deviceSerialNumber || '-'}
                      className="h-12 rounded-xl bg-muted/30"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2 xl:col-span-1">
                    <label className="text-sm font-medium">Department</label>
                    <Input
                      readOnly
                      value={(selectedIssueAsset ? getAssetMeta(selectedIssueAsset).department : '') || '-'}
                      className="h-12 rounded-xl bg-muted/30"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Employee</label>
                <Select
                  value={issueForm.userEmail || '__manual__'}
                  onValueChange={(v) => {
                    if (v === '__manual__') {
                      setIssueForm({ ...issueForm, userName: '', userEmail: '' })
                      return
                    }
                    const selected = userChoices.find(u => u.email === v)
                    if (selected) {
                      setIssueForm({ ...issueForm, userName: selected.name, userEmail: selected.email })
                    }
                  }}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Pick from existing users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">Manual Entry</SelectItem>
                    {userChoices.map((u) => (
                      <SelectItem key={u.email} value={u.email}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
              <div className="space-y-2 lg:col-span-2">
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

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex gap-3 items-start mt-2 lg:col-span-2">
                <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80 leading-relaxed">
                  The employee will receive an automated email notification regarding this issuance.
                </p>
              </div>

              <DialogFooter className="pt-2 lg:col-span-2">
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
              <TableHead>Asset ID</TableHead>
              <TableHead>Serial No.</TableHead>
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
                  <TableCell colSpan={8}><div className="h-12 bg-muted/50 animate-pulse rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : issuances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
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
                      const meta = asset ? getAssetMeta(asset) : null
                      return (
                        <div className="flex items-center gap-2">
                          <Laptop className="w-4 h-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {asset ? meta?.title : `Asset ID: ${issuance.assetId.split('_').pop()}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {asset ? `Model: ${meta?.model || '-'} | ${meta?.department || '-'}` : ''}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {assetMap[issuance.assetId]?.serialNumber || '-'}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {assetMap[issuance.assetId]?.deviceSerialNumber || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {new Date(issuance.issueDate).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {issuance.returnDate ? new Date(issuance.returnDate).toLocaleDateString() : '-'}
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


