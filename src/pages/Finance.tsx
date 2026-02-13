import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Calculator, FileSpreadsheet, Landmark, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { blink } from '../lib/blink'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  calcDepreciation,
  DEFAULT_FINANCE_POLICY,
  deactivateFinanceProfile,
  FinanceAssetOverride,
  FinanceProfile,
  listFinanceAssetOverrides,
  listFinanceProfiles,
  moneyInr,
  resolveProfileForCategory,
  SalvageType,
  upsertFinanceAssetOverride,
  upsertFinanceProfile
} from '../lib/finance'

type StockMeta = {
  category?: string
  itemName?: string
  location?: string
  fromLocation?: string
  toLocation?: string
  reasonType?: string
  approvalStatus?: string
  transactionDate?: string
  unitCost?: number
  totalCost?: number
  quantity?: number
  reason?: string
}

type StockTx = {
  id: string
  type: 'in' | 'out'
  quantity: number
  createdAt: string
  meta: StockMeta | null
}

type AssetLite = {
  id: string
  name?: string
  serialNumber?: string
}

const V2 = 'v2|'
const dec = (v?: string) => decodeURIComponent(v || '')
const n = (v: string) => {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}
const i = (v: string, def = 1) => {
  const parsed = parseInt(v, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : def
}
const safeDate = (iso?: string) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10)
}
const approved = (tx: StockTx) => !tx.meta?.approvalStatus || tx.meta.approvalStatus === 'approved'

const parseStockReason = (reason: string): StockMeta | null => {
  if (!reason || !reason.startsWith(V2)) return null
  const rec: Record<string, string> = {}
  reason.split('|').slice(1).forEach(part => {
    const idx = part.indexOf('=')
    if (idx > -1) rec[part.slice(0, idx)] = part.slice(idx + 1)
  })
  const unitCost = rec.u ? Number(rec.u) : undefined
  const totalCost = rec.t ? Number(rec.t) : undefined
  const quantity = rec.q ? Number(rec.q) : undefined
  return {
    category: dec(rec.c),
    itemName: dec(rec.i),
    location: dec(rec.l),
    transactionDate: dec(rec.d),
    reason: dec(rec.rs),
    reasonType: dec(rec.rt),
    fromLocation: dec(rec.fl),
    toLocation: dec(rec.tl),
    approvalStatus: dec(rec.as),
    unitCost: Number.isFinite(unitCost || NaN) ? unitCost : undefined,
    totalCost: Number.isFinite(totalCost || NaN) ? totalCost : undefined,
    quantity: Number.isFinite(quantity || NaN) ? quantity : undefined,
  }
}

export function Finance() {
  const { user } = useAuth()
  const { categories } = useCategories()

  const [loading, setLoading] = useState(true)
  const [sourceWarn, setSourceWarn] = useState('')
  const [profiles, setProfiles] = useState<FinanceProfile[]>([])
  const [overrides, setOverrides] = useState<FinanceAssetOverride[]>([])
  const [assets, setAssets] = useState<AssetLite[]>([])
  const [txs, setTxs] = useState<StockTx[]>([])
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<FinanceProfile | null>(null)

  const [profileForm, setProfileForm] = useState({
    category: '',
    usefulLifeMonths: String(DEFAULT_FINANCE_POLICY.usefulLifeMonths),
    salvageType: DEFAULT_FINANCE_POLICY.salvageType as SalvageType,
    salvageValue: String(DEFAULT_FINANCE_POLICY.salvageValue),
    expenseGl: '',
    accumDepGl: '',
    active: true,
  })

  const [preview, setPreview] = useState({
    category: '',
    cost: '50000',
    salvageType: DEFAULT_FINANCE_POLICY.salvageType as SalvageType,
    salvageValue: String(DEFAULT_FINANCE_POLICY.salvageValue),
    usefulLifeMonths: String(DEFAULT_FINANCE_POLICY.usefulLifeMonths),
    monthsElapsed: '10',
  })

  const [overrideForm, setOverrideForm] = useState({
    assetId: '',
    usefulLifeMonths: String(DEFAULT_FINANCE_POLICY.usefulLifeMonths),
    salvageType: DEFAULT_FINANCE_POLICY.salvageType as SalvageType,
    salvageValue: String(DEFAULT_FINANCE_POLICY.salvageValue),
    effectiveFrom: new Date().toISOString().slice(0, 10),
  })

  useEffect(() => {
    const defaultCategory = categories[0]?.value || 'laptop'
    setPreview(prev => ({ ...prev, category: prev.category || defaultCategory }))
    setProfileForm(prev => ({ ...prev, category: prev.category || defaultCategory }))
  }, [categories])

  useEffect(() => {
    void loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    setSourceWarn('')
    try {
      const [pRes, oRes, assetsRes, txRes] = await Promise.all([
        listFinanceProfiles(),
        listFinanceAssetOverrides(),
        blink.db.assets.list({ orderBy: { createdAt: 'desc' } }) as Promise<AssetLite[]>,
        blink.db.stockTransactions.list({ orderBy: { createdAt: 'desc' } }) as Promise<Array<{ id: string; type: string; quantity: number | string; createdAt?: string; reason?: string }>>,
      ])
      setProfiles(pRes.rows.sort((a, b) => a.category.localeCompare(b.category)))
      setOverrides(oRes.rows)
      setAssets(assetsRes || [])
      const parsed = (txRes || [])
        .filter(t => t.type === 'in' || t.type === 'out')
        .map(t => ({
          id: t.id,
          type: t.type as 'in' | 'out',
          quantity: Number(t.quantity) || 0,
          createdAt: t.createdAt || new Date().toISOString(),
          meta: parseStockReason(t.reason || '')
        }))
      setTxs(parsed)
      if (pRes.source === 'local' || oRes.source === 'local') {
        setSourceWarn('Finance DB tables are unavailable. Running in local-storage mode.')
        toast.warning('Finance DB unavailable. Using local-storage mode.')
      }
    } catch (err: unknown) {
      toast.error(`Unable to load finance module: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!preview.category) return
    const { profile } = resolveProfileForCategory(preview.category, profiles)
    setPreview(prev => ({
      ...prev,
      usefulLifeMonths: String(profile.usefulLifeMonths),
      salvageType: profile.salvageType,
      salvageValue: String(profile.salvageValue),
    }))
  }, [preview.category, profiles])

  const resolvedPreviewPolicy = useMemo(
    () => resolveProfileForCategory(preview.category, profiles),
    [preview.category, profiles]
  )

  const depreciation = useMemo(() => calcDepreciation({
    cost: Math.max(0, n(preview.cost)),
    usefulLifeMonths: Math.max(1, i(preview.usefulLifeMonths, DEFAULT_FINANCE_POLICY.usefulLifeMonths)),
    salvageType: preview.salvageType,
    salvageValue: Math.max(0, n(preview.salvageValue)),
    monthsElapsed: Math.max(0, i(preview.monthsElapsed, 0)),
  }), [preview])
  const salvageInputNum = Math.max(0, n(preview.salvageValue))
  const costInputNum = Math.max(0, n(preview.cost))
  const salvageInvalid = preview.salvageType === 'fixed'
    ? salvageInputNum > costInputNum
    : salvageInputNum > 100

  const latestStockIn = useMemo(() => txs.find(tx => tx.type === 'in' && approved(tx) && tx.meta?.category), [txs])
  const disposalCandidates = useMemo(
    () => txs.filter(tx => tx.type === 'out' && tx.meta?.reasonType === 'scrap'),
    [txs]
  )
  const transferMovements = useMemo(
    () => txs.filter(tx => tx.type === 'out' && tx.meta?.reasonType === 'transfer'),
    [txs]
  )

  const applyLatestStockContext = () => {
    if (!latestStockIn?.meta) {
      toast.error('No approved Stock IN context found yet')
      return
    }
    const meta = latestStockIn.meta
    const qty = meta.quantity || latestStockIn.quantity || 1
    const unit = meta.unitCost || ((meta.totalCost || 0) / Math.max(1, qty))
    setPreview(prev => ({
      ...prev,
      category: meta.category || prev.category,
      cost: unit > 0 ? String(unit) : prev.cost,
      monthsElapsed: '0',
    }))
    toast.success('Preview seeded from latest approved Stock IN')
  }

  const resetProfileForm = () => {
    setEditingProfile(null)
    setProfileForm({
      category: categories[0]?.value || 'laptop',
      usefulLifeMonths: String(DEFAULT_FINANCE_POLICY.usefulLifeMonths),
      salvageType: DEFAULT_FINANCE_POLICY.salvageType,
      salvageValue: String(DEFAULT_FINANCE_POLICY.salvageValue),
      expenseGl: '',
      accumDepGl: '',
      active: true,
    })
  }

  const openEditProfile = (row: FinanceProfile) => {
    setEditingProfile(row)
    setProfileForm({
      category: row.category,
      usefulLifeMonths: String(row.usefulLifeMonths),
      salvageType: row.salvageType,
      salvageValue: String(row.salvageValue),
      expenseGl: row.expenseGl || '',
      accumDepGl: row.accumDepGl || '',
      active: row.active,
    })
    setProfileDialogOpen(true)
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const usefulLifeMonths = i(profileForm.usefulLifeMonths, 0)
    const salvageValue = Math.max(0, n(profileForm.salvageValue))
    if (!profileForm.category.trim()) return toast.error('Category is required')
    if (usefulLifeMonths < 1) return toast.error('Useful life must be >= 1 month')
    if (salvageValue < 0) return toast.error('Salvage must be >= 0')
    if (profileForm.salvageType === 'percent' && salvageValue > 100) return toast.error('Salvage percent must be <= 100')

    const actor = user?.email || user?.id || 'unknown'
    const res = await upsertFinanceProfile({
      id: editingProfile?.id,
      category: profileForm.category.trim().toLowerCase(),
      method: 'straight_line',
      usefulLifeMonths,
      salvageType: profileForm.salvageType,
      salvageValue,
      frequency: 'monthly',
      expenseGl: profileForm.expenseGl.trim(),
      accumDepGl: profileForm.accumDepGl.trim(),
      active: profileForm.active,
    }, actor)

    toast.success(res.source === 'db' ? 'Finance profile saved' : 'Finance profile saved locally')
    setProfileDialogOpen(false)
    resetProfileForm()
    await loadAll()
  }

  const deactivateProfile = async (row: FinanceProfile) => {
    const actor = user?.email || user?.id || 'unknown'
    const res = await deactivateFinanceProfile(row.id, actor)
    toast.success(res.source === 'db' ? 'Profile deactivated' : 'Profile deactivated locally')
    await loadAll()
  }

  const saveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    const usefulLifeMonths = i(overrideForm.usefulLifeMonths, 0)
    const salvageValue = Math.max(0, n(overrideForm.salvageValue))
    if (!overrideForm.assetId) return toast.error('Select asset')
    if (usefulLifeMonths < 1) return toast.error('Useful life must be >= 1 month')
    if (overrideForm.salvageType === 'percent' && salvageValue > 100) return toast.error('Salvage percent must be <= 100')

    const actor = user?.email || user?.id || 'unknown'
    const res = await upsertFinanceAssetOverride({
      assetId: overrideForm.assetId,
      method: 'straight_line',
      usefulLifeMonths,
      salvageType: overrideForm.salvageType,
      salvageValue,
      effectiveFrom: overrideForm.effectiveFrom,
      createdBy: actor,
    }, actor)
    toast.success(res.source === 'db' ? 'Asset override saved' : 'Asset override saved locally')
    setOverrideForm({
      assetId: '',
      usefulLifeMonths: String(DEFAULT_FINANCE_POLICY.usefulLifeMonths),
      salvageType: DEFAULT_FINANCE_POLICY.salvageType,
      salvageValue: String(DEFAULT_FINANCE_POLICY.salvageValue),
      effectiveFrom: new Date().toISOString().slice(0, 10),
    })
    await loadAll()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">Depreciation profiles, preview, and finance readiness for stock lifecycle.</p>
      </div>

      {sourceWarn && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{sourceWarn}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4" />Depreciation Runs</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Coming in Phase 2: monthly depreciation batch runs and posting controls.</CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />Journal Export</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Coming in Phase 2: CSV/XLSX export for ERP journal ingestion.</CardContent>
        </Card>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
          <div className="font-semibold">Depreciation Profiles</div>
          <Dialog open={profileDialogOpen} onOpenChange={open => {
            setProfileDialogOpen(open)
            if (!open) resetProfileForm()
          }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetProfileForm}><Plus className="w-4 h-4 mr-1" />Add Profile</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader><DialogTitle>{editingProfile ? 'Edit Profile' : 'Create Profile'}</DialogTitle></DialogHeader>
              <form onSubmit={saveProfile} className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Category</label>
                  <Select value={profileForm.category} onValueChange={v => setProfileForm(s => ({ ...s, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Method</label>
                    <Input value="straight_line" readOnly />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Useful Life (Months)</label>
                    <Input inputMode="numeric" value={profileForm.usefulLifeMonths} onChange={e => setProfileForm(s => ({ ...s, usefulLifeMonths: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Frequency</label>
                    <Input value="monthly" readOnly />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Salvage Type</label>
                    <Select value={profileForm.salvageType} onValueChange={v => setProfileForm(s => ({ ...s, salvageType: v as SalvageType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">percent</SelectItem>
                        <SelectItem value="fixed">fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Salvage Value</label>
                    <Input inputMode="decimal" value={profileForm.salvageValue} onChange={e => setProfileForm(s => ({ ...s, salvageValue: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Expense GL (optional)</label>
                    <Input value={profileForm.expenseGl} onChange={e => setProfileForm(s => ({ ...s, expenseGl: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Accum. Dep GL (optional)</label>
                    <Input value={profileForm.accumDepGl} onChange={e => setProfileForm(s => ({ ...s, accumDepGl: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter><Button className="w-full" type="submit">Save Profile</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Life</TableHead>
              <TableHead>Salvage</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No profiles yet. Add your first depreciation profile.</TableCell></TableRow>
            ) : profiles.map(row => (
              <TableRow key={row.id}>
                <TableCell className="capitalize">{row.category}</TableCell>
                <TableCell>{row.method}</TableCell>
                <TableCell>{row.usefulLifeMonths} months</TableCell>
                <TableCell>{row.salvageType === 'percent' ? `${row.salvageValue}%` : moneyInr(row.salvageValue)}</TableCell>
                <TableCell>{row.frequency}</TableCell>
                <TableCell>{row.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                <TableCell>{safeDate(row.updatedDate || row.createdDate)}</TableCell>
                <TableCell className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditProfile(row)}>Edit</Button>
                  {row.active && <Button size="sm" variant="outline" onClick={() => void deactivateProfile(row)}>Deactivate</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Depreciation Preview</div>
          <Button variant="outline" size="sm" onClick={applyLatestStockContext}>Use Latest Stock IN Context</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={preview.category} onValueChange={v => setPreview(s => ({ ...s, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Asset Cost (Rs)</label>
            <Input inputMode="decimal" value={preview.cost} onChange={e => setPreview(s => ({ ...s, cost: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Months Elapsed</label>
            <Input inputMode="numeric" value={preview.monthsElapsed} onChange={e => setPreview(s => ({ ...s, monthsElapsed: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Salvage Type</label>
            <Select value={preview.salvageType} onValueChange={v => setPreview(s => ({ ...s, salvageType: v as SalvageType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">percent</SelectItem>
                <SelectItem value="fixed">fixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Salvage Value</label>
            <Input inputMode="decimal" value={preview.salvageValue} onChange={e => setPreview(s => ({ ...s, salvageValue: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Useful Life (Months)</label>
            <Input inputMode="numeric" value={preview.usefulLifeMonths} onChange={e => setPreview(s => ({ ...s, usefulLifeMonths: e.target.value }))} />
          </div>
        </div>
        <div className="text-sm flex items-center gap-2">
          {resolvedPreviewPolicy.usingFallback ? (
            <>
              <Badge variant="secondary">Using fallback policy</Badge>
              <span className="text-muted-foreground">No profile found for this category. Default 36 months + 10% salvage applied.</span>
            </>
          ) : (
            <>
              <Badge>Profile applied</Badge>
              <span className="text-muted-foreground">Category profile is active and used in this preview.</span>
            </>
          )}
        </div>
        {salvageInvalid && (
          <div className="text-sm text-rose-600">
            {preview.salvageType === 'fixed'
              ? 'Salvage (fixed) cannot be greater than asset cost.'
              : 'Salvage percent cannot be greater than 100.'}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border p-3"><div className="text-muted-foreground">Salvage Amount</div><div className="font-semibold">{moneyInr(depreciation.salvageAmount)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-muted-foreground">Depreciable Base</div><div className="font-semibold">{moneyInr(depreciation.depreciableBase)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-muted-foreground">Monthly Depreciation</div><div className="font-semibold">{moneyInr(depreciation.monthlyDep)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-muted-foreground">Book Value</div><div className="font-semibold">{moneyInr(depreciation.bookValue)}</div></div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-4">
        <div className="font-semibold">Asset Override (Optional)</div>
        <form onSubmit={saveOverride} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs text-muted-foreground">Asset</label>
            <Select value={overrideForm.assetId} onValueChange={v => setOverrideForm(s => ({ ...s, assetId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
              <SelectContent>
                {assets.slice(0, 300).map(asset => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {(asset.name || 'Unnamed Asset')} ({asset.serialNumber || 'No Serial'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Life (Months)</label>
            <Input inputMode="numeric" value={overrideForm.usefulLifeMonths} onChange={e => setOverrideForm(s => ({ ...s, usefulLifeMonths: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Salvage</label>
            <Input inputMode="decimal" value={overrideForm.salvageValue} onChange={e => setOverrideForm(s => ({ ...s, salvageValue: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Effective From</label>
            <Input type="date" value={overrideForm.effectiveFrom} onChange={e => setOverrideForm(s => ({ ...s, effectiveFrom: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Salvage Type</label>
            <Select value={overrideForm.salvageType} onValueChange={v => setOverrideForm(s => ({ ...s, salvageType: v as SalvageType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">percent</SelectItem>
                <SelectItem value="fixed">fixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Button size="sm" type="submit">Save Override</Button>
          </div>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset ID</TableHead>
              <TableHead>Life</TableHead>
              <TableHead>Salvage</TableHead>
              <TableHead>Effective From</TableHead>
              <TableHead>Created Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overrides.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No overrides configured.</TableCell></TableRow>
            ) : overrides.map(row => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.assetId}</TableCell>
                <TableCell>{row.usefulLifeMonths} months</TableCell>
                <TableCell>{row.salvageType === 'percent' ? `${row.salvageValue}%` : moneyInr(row.salvageValue)}</TableCell>
                <TableCell>{row.effectiveFrom}</TableCell>
                <TableCell>{safeDate(row.createdDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="w-4 h-4" />Transfer Impact</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Transfers do not change total depreciation amount. They only update tracking dimensions (location/cost-center).
            <div className="mt-2"><span className="font-semibold text-foreground">{transferMovements.length}</span> transfer movements found in current ledger.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Scrap / Disposal Candidates</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disposalCandidates.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No scrap candidates found.</TableCell></TableRow>
                ) : disposalCandidates.slice(0, 25).map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.meta?.itemName || 'Unknown item'}</TableCell>
                    <TableCell>{tx.meta?.fromLocation || tx.meta?.location || '-'}</TableCell>
                    <TableCell>{tx.quantity}</TableCell>
                    <TableCell className="capitalize">{tx.meta?.approvalStatus || 'approved'}</TableCell>
                    <TableCell>{safeDate(tx.meta?.transactionDate || tx.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
