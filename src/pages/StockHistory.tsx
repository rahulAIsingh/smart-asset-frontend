import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { ArrowDownCircle, ArrowUpCircle, Calendar, Package, TrendingDown, TrendingUp } from 'lucide-react'
import { dataClient } from '../lib/dataClient'
import { useAuth } from '../hooks/useAuth'
import { useCategories } from '../hooks/useCategories'
import { useVendors } from '../hooks/useVendors'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import { toast } from 'sonner'

type StockOutType = 'issue' | 'scrap' | 'transfer' | 'return'
type ApprovalStatus = 'approved' | 'pending' | 'rejected'

type TxMeta = {
  schema: 'stock-v2'
  category: string
  itemName: string
  serialNumber?: string
  location: string
  transactionDate: string
  note: string
  createdBy: string
  createdDate: string
  vendor?: string
  quantity?: number
  unitCost?: number
  totalCost?: number
  referenceNumber?: string
  reason?: string
  issuedTo?: string
  reasonType?: StockOutType
  fromLocation?: string
  toLocation?: string
  approvalStatus?: ApprovalStatus
  approvedBy?: string
  approvedDate?: string
  scrapVendor?: string
}

type TxRow = {
  id: string
  type: 'in' | 'out'
  quantity: number
  createdAt: string
  reason: string
  meta: TxMeta | null
}

type SummaryRow = {
  key: string
  category: string
  itemName: string
  serialNumber?: string
  location: string
  qty: number
  unitCost: number
  totalValue: number
}

type AssetRow = { id: string; serialNumber?: string }
type OutSummaryRow = { key: string; category: string; itemName: string; serialNumber?: string; fromLocation: string; toLocation: string; reasonType: string; qty: number }

const V2 = 'v2|'
const LEGACY = 'STOCK_META::'
const ANCHOR_SERIAL = 'SAM-STOCK-ANCHOR'
const LOCATION_STORAGE_KEY = 'sam_stock_locations'
const OUT_REASON_OPTIONS: Array<{ value: StockOutType; label: string }> = [
  { value: 'issue', label: 'Issue' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'return', label: 'Return' },
  { value: 'scrap', label: 'Scrap' },
]

const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0)
const keyOf = (c: string, i: string, l: string, s?: string) => `${c.trim().toLowerCase()}||${i.trim().toLowerCase()}||${l.trim().toLowerCase()}||${(s || '').trim().toLowerCase()}`
const toIso = (d: string) => { const x = new Date(`${d}T00:00:00`); return Number.isNaN(x.getTime()) ? new Date().toISOString() : x.toISOString() }
const dateOnly = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10) }
const enc = (v?: string) => encodeURIComponent((v || '').trim())
const dec = (v?: string) => decodeURIComponent(v || '')
const qInt = (v: string, def = 1) => { const n = parseInt(v, 10); return String(Number.isFinite(n) && n > 0 ? n : def) }
const mNum = (v: string, def = 0) => { const n = parseFloat(v.replace(/[^\d.]/g, '')); return (Number.isFinite(n) && n >= 0 ? n : def).toFixed(2).replace(/\.00$/, '') }
const nQ = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0 }
const nM = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : 0 }
const errMsg = (e: unknown) => {
  if (!e) return 'Unknown error'
  if (typeof e === 'string') return e
  const c = e as Record<string, unknown>
  const direct = [c.userMessage, c.message, c.error].find(v => typeof v === 'string' && v.trim())
  if (typeof direct === 'string') return direct
  if (typeof c.details === 'string') return c.details
  try { return JSON.stringify(c.details || c) } catch { return 'Unknown error' }
}

const buildMeta = (m: TxMeta) => {
  const parts = [`${V2}c=${enc(m.category)}`, `i=${enc(m.itemName)}`, `l=${enc(m.location)}`, `d=${enc(m.transactionDate)}`, `n=${enc(m.note)}`, `by=${enc(m.createdBy)}`, `cd=${enc(m.createdDate)}`]
  if (m.serialNumber) parts.push(`sn=${enc(m.serialNumber)}`)
  if (m.vendor) parts.push(`v=${enc(m.vendor)}`)
  if (m.referenceNumber) parts.push(`r=${enc(m.referenceNumber)}`)
  if (m.reason) parts.push(`rs=${enc(m.reason)}`)
  if (m.issuedTo) parts.push(`to=${enc(m.issuedTo)}`)
  if (m.reasonType) parts.push(`rt=${enc(m.reasonType)}`)
  if (m.fromLocation) parts.push(`fl=${enc(m.fromLocation)}`)
  if (m.toLocation) parts.push(`tl=${enc(m.toLocation)}`)
  if (m.approvalStatus) parts.push(`as=${enc(m.approvalStatus)}`)
  if (m.approvedBy) parts.push(`ab=${enc(m.approvedBy)}`)
  if (m.approvedDate) parts.push(`ad=${enc(m.approvedDate)}`)
  if (m.scrapVendor) parts.push(`sv=${enc(m.scrapVendor)}`)
  if (typeof m.unitCost === 'number') parts.push(`u=${m.unitCost}`)
  if (typeof m.totalCost === 'number') parts.push(`t=${m.totalCost}`)
  if (typeof m.quantity === 'number') parts.push(`q=${m.quantity}`)
  return parts.join('|')
}

const parseMeta = (reason: string): TxMeta | null => {
  if (!reason) return null
  if (reason.startsWith(V2)) {
    const rec: Record<string, string> = {}
    reason.split('|').slice(1).forEach(part => { const i = part.indexOf('='); if (i > -1) rec[part.slice(0, i)] = part.slice(i + 1) })
    const category = dec(rec.c), itemName = dec(rec.i), location = dec(rec.l)
    if (!category || !itemName || !location) return null
    const u = rec.u ? parseFloat(rec.u) : undefined
    const t = rec.t ? parseFloat(rec.t) : undefined
    const q = rec.q ? parseInt(rec.q, 10) : undefined
    return { schema: 'stock-v2', category, itemName, serialNumber: dec(rec.sn), location, transactionDate: dec(rec.d), note: dec(rec.n), createdBy: dec(rec.by), createdDate: dec(rec.cd), vendor: dec(rec.v), referenceNumber: dec(rec.r), reason: dec(rec.rs), issuedTo: dec(rec.to), reasonType: (dec(rec.rt) || undefined) as StockOutType | undefined, fromLocation: dec(rec.fl), toLocation: dec(rec.tl), approvalStatus: (dec(rec.as) || undefined) as ApprovalStatus | undefined, approvedBy: dec(rec.ab), approvedDate: dec(rec.ad), scrapVendor: dec(rec.sv), unitCost: Number.isFinite(u || NaN) ? u : undefined, totalCost: Number.isFinite(t || NaN) ? t : undefined, quantity: Number.isFinite(q || NaN) ? q : undefined }
  }
  if (!reason.startsWith(LEGACY)) return null
  try { const parsed = JSON.parse(reason.slice(LEGACY.length)); return parsed?.schema === 'stock-v2' ? (parsed as TxMeta) : null } catch { return null }
}

const isApproved = (tx: TxRow) => {
  const status = tx.meta?.approvalStatus
  if (!status) return true
  return status === 'approved'
}

export function StockHistory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { categories } = useCategories()
  const { vendors } = useVendors()
  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = today.slice(0, 7)
  const opts = categories.length ? categories.map(c => ({ value: c.value, label: c.label })) : [{ value: 'laptop', label: 'Laptop' }]

  const [txs, setTxs] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [anchor, setAnchor] = useState('')
  const [inOpen, setInOpen] = useState(false)
  const [outOpen, setOutOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<SummaryRow | null>(null)
  const [outDetailOpen, setOutDetailOpen] = useState(false)
  const [outDetailRow, setOutDetailRow] = useState<OutSummaryRow | null>(null)
  const [locationFilter, setLocationFilter] = useState('all')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [lowStockThreshold, setLowStockThreshold] = useState('5')
  const [reportMonth, setReportMonth] = useState(thisMonth)
  const [savedLocations, setSavedLocations] = useState<string[]>([])
  const [inF, setInF] = useState({ category: '', itemName: '', serialNumber: '', vendor: '', quantity: '1', unitCost: '0', location: 'Main Office', referenceNumber: '', date: today, note: '' })
  const [outF, setOutF] = useState({ category: '', itemName: '', serialNumber: '', quantity: '1', location: 'Main Office', reason: '', issuedTo: '', reasonType: 'issue' as StockOutType, toLocation: '', scrapVendor: '', date: today, note: '' })

  useEffect(() => { void load() }, [])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setSavedLocations(parsed.map(v => String(v)).filter(Boolean))
      }
    } catch {
      // ignore bad storage
    }
  }, [])
  useEffect(() => {
    setInF(s => ({ ...s, category: s.category || opts[0].value, vendor: s.vendor || (vendors[0] || '') }))
    setOutF(s => ({ ...s, category: s.category || opts[0].value }))
  }, [categories, vendors])

  const load = async () => {
    try {
      const rows = await dataClient.db.stockTransactions.list({ orderBy: { createdAt: 'desc' } }) as Array<{ id: string; type: string; quantity: number | string; createdAt?: string; reason?: string }>
      setTxs(rows.filter(r => r.type === 'in' || r.type === 'out').map(r => ({ id: r.id, type: r.type as 'in' | 'out', quantity: Number(r.quantity) || 0, createdAt: r.createdAt || new Date().toISOString(), reason: r.reason || '', meta: parseMeta(r.reason || '') })))
    } catch {
      toast.error('Failed to fetch stock history')
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    const map = new Map<string, SummaryRow>()
    txs.forEach(tx => {
      if (!tx.meta || !isApproved(tx)) return
      const k = keyOf(tx.meta.category, tx.meta.itemName, tx.meta.location, tx.meta.serialNumber)
      const row = map.get(k) || { key: k, category: tx.meta.category, itemName: tx.meta.itemName, serialNumber: tx.meta.serialNumber, location: tx.meta.location, qty: 0, unitCost: 0, totalValue: 0 }
      row.qty += tx.type === 'in' ? tx.quantity : -tx.quantity
      if (tx.type === 'in') row.unitCost = Number(tx.meta.unitCost) || row.unitCost
      row.totalValue = row.qty * row.unitCost
      map.set(k, row)
    })
    return Array.from(map.values()).filter(r => r.qty > 0).sort((a, b) => a.itemName.localeCompare(b.itemName))
  }, [txs])

  const qtyByKey = useMemo(() => new Map(summary.map(s => [s.key, s.qty])), [summary])
  const inTotal = nQ(inF.quantity) * nM(inF.unitCost)
  const allLocations = useMemo(() => {
    const set = new Set<string>()
    summary.forEach(s => set.add(s.location))
    txs.forEach(t => {
      if (t.meta?.fromLocation) set.add(t.meta.fromLocation)
      if (t.meta?.toLocation) set.add(t.meta.toLocation)
      if (t.meta?.location) set.add(t.meta.location)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [summary, txs])
  const locationOptions = useMemo(() => {
    const set = new Set<string>(['Main Office', ...savedLocations, ...allLocations])
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b))
  }, [savedLocations, allLocations])

  const rememberLocation = (value: string) => {
    const next = value.trim()
    if (!next) return
    setSavedLocations(prev => {
      if (prev.includes(next)) return prev
      const updated = [...prev, next].sort((a, b) => a.localeCompare(b))
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const filteredSummary = useMemo(() => locationFilter === 'all' ? summary : summary.filter(s => s.location === locationFilter), [summary, locationFilter])
  const filteredTxs = useMemo(() => txs.filter(tx => {
    const d = dateOnly(tx.meta?.transactionDate || tx.createdAt)
    if (fromDate && d < fromDate) return false
    if (toDate && d > toDate) return false
    if (locationFilter === 'all') return true
    const m = tx.meta
    return m?.location === locationFilter || m?.fromLocation === locationFilter || m?.toLocation === locationFilter
  }), [txs, fromDate, toDate, locationFilter])

  const approvedFilteredTxs = useMemo(() => filteredTxs.filter(isApproved), [filteredTxs])
  const totalValue = filteredSummary.reduce((sum, s) => sum + s.totalValue, 0)
  const totalUnits = filteredSummary.reduce((sum, s) => sum + s.qty, 0)
  const totalInQty = approvedFilteredTxs.filter(t => t.type === 'in').reduce((s, t) => s + t.quantity, 0)
  const totalOutQty = approvedFilteredTxs.filter(t => t.type === 'out').reduce((s, t) => s + t.quantity, 0)

  const lowStockItems = useMemo(() => {
    const threshold = nQ(lowStockThreshold || '0')
    if (threshold <= 0) return []
    return filteredSummary.filter(r => r.qty <= threshold)
  }, [filteredSummary, lowStockThreshold])

  const detailTxs = useMemo(() => {
    if (!detailRow) return []
    return approvedFilteredTxs.filter(tx => tx.meta && keyOf(tx.meta.category, tx.meta.itemName, tx.meta.location, tx.meta.serialNumber) === detailRow.key).slice(0, 30)
  }, [detailRow, approvedFilteredTxs])

  const outSummary = useMemo(() => {
    const map = new Map<string, OutSummaryRow>()
    approvedFilteredTxs.filter(t => t.type === 'out').forEach(tx => {
      const m = tx.meta
      if (!m) return
      const fromLocation = m.fromLocation || m.location
      const toLocation = m.toLocation || '-'
      const reasonType = m.reasonType || 'out'
      const key = `${m.category}|${m.itemName}|${m.serialNumber || ''}|${fromLocation}|${toLocation}|${reasonType}`
      const row = map.get(key) || { key, category: m.category, itemName: m.itemName, serialNumber: m.serialNumber, fromLocation, toLocation, reasonType, qty: 0 }
      row.qty += tx.quantity
      map.set(key, row)
    })
    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName))
  }, [approvedFilteredTxs])

  const outDetailTxs = useMemo(() => {
    if (!outDetailRow) return []
    return approvedFilteredTxs.filter(tx => {
      if (tx.type !== 'out' || !tx.meta) return false
      const m = tx.meta
      const fromLocation = m.fromLocation || m.location
      const toLocation = m.toLocation || '-'
      const reasonType = m.reasonType || 'out'
      const key = `${m.category}|${m.itemName}|${m.serialNumber || ''}|${fromLocation}|${toLocation}|${reasonType}`
      return key === outDetailRow.key
    }).slice(0, 30)
  }, [outDetailRow, approvedFilteredTxs])

  const pendingApprovals = useMemo(
    () => filteredTxs.filter(tx => tx.type === 'out' && tx.meta?.approvalStatus === 'pending' && (tx.meta.reasonType === 'scrap' || tx.meta.reasonType === 'transfer')),
    [filteredTxs]
  )

  const monthStart = `${reportMonth}-01`
  const monthEnd = (() => {
    const dt = new Date(`${reportMonth}-01`)
    dt.setMonth(dt.getMonth() + 1)
    dt.setDate(0)
    return dt.toISOString().slice(0, 10)
  })()

  const monthlyReport = useMemo(() => {
    const map = new Map<string, { location: string; openingQty: number; closingQty: number }>()
    approvedFilteredTxs.forEach(tx => {
      if (!tx.meta) return
      const loc = tx.meta.location
      const d = dateOnly(tx.meta.transactionDate || tx.createdAt)
      const delta = tx.type === 'in' ? tx.quantity : -tx.quantity
      const row = map.get(loc) || { location: loc, openingQty: 0, closingQty: 0 }
      if (d < monthStart) row.openingQty += delta
      if (d <= monthEnd) row.closingQty += delta
      map.set(loc, row)
    })
    return Array.from(map.values()).sort((a, b) => a.location.localeCompare(b.location))
  }, [approvedFilteredTxs, monthStart, monthEnd])

  const ensureAnchor = async () => {
    if (anchor) return anchor
    try {
      const one = await dataClient.db.assets.list({ where: { serialNumber: ANCHOR_SERIAL }, limit: 1 }) as AssetRow[]
      if (one[0]?.id) { setAnchor(one[0].id); return one[0].id }
    } catch { /* ignore */ }
    const all = await dataClient.db.assets.list() as AssetRow[]
    const found = all.find(a => a.serialNumber === ANCHOR_SERIAL)
    if (found?.id) { setAnchor(found.id); return found.id }
    const created = await dataClient.db.assets.create({ name: 'Stock Ledger Anchor', category: opts[0].value || 'laptop', serialNumber: ANCHOR_SERIAL, location: 'System Ledger', status: 'available' }) as { id: string }
    setAnchor(created.id)
    return created.id
  }

  const saveIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = nQ(inF.quantity), unit = nM(inF.unitCost)
    if (!inF.itemName.trim() || !inF.vendor.trim() || !inF.location.trim() || !inF.date || qty <= 0) return toast.error('Please fill all required fields')
    rememberLocation(inF.location)
    const now = new Date().toISOString()
    const meta: TxMeta = { schema: 'stock-v2', category: inF.category, itemName: inF.itemName.trim(), serialNumber: inF.serialNumber.trim(), vendor: inF.vendor.trim(), quantity: qty, unitCost: unit, totalCost: inTotal, location: inF.location.trim(), referenceNumber: inF.referenceNumber.trim(), transactionDate: inF.date, note: inF.note.trim(), createdBy: user?.email || user?.id || 'unknown', createdDate: now, approvalStatus: 'approved' }
    try {
      const assetId = await ensureAnchor()
      await dataClient.db.stockTransactions.create({ assetId, type: 'in', quantity: qty, reason: buildMeta(meta), createdAt: toIso(inF.date) })
      toast.success('Stock IN saved')
      setInOpen(false)
      setInF({ category: opts[0].value, itemName: '', serialNumber: '', vendor: vendors[0] || '', quantity: '1', unitCost: '0', location: 'Main Office', referenceNumber: '', date: today, note: '' })
      await load()
    } catch (err) {
      toast.error(`Error saving Stock IN: ${errMsg(err)}`)
    }
  }

  const saveOut = async (e: React.FormEvent) => {
    e.preventDefault()
    const qty = nQ(outF.quantity)
    const available = qtyByKey.get(keyOf(outF.category, outF.itemName, outF.location, outF.serialNumber)) || 0
    if (!outF.itemName.trim() || !outF.location.trim() || !outF.reason.trim() || !outF.date || qty <= 0) return toast.error('Please fill all required fields')
    if (outF.reasonType === 'scrap' && !outF.scrapVendor.trim()) return toast.error('Scrap Vendor is required for scrap')
    if (outF.reasonType === 'transfer' && !outF.toLocation.trim()) return toast.error('To Location is required for transfer')
    if (qty > available) return toast.error(`Insufficient quantity. Available: ${available}`)
    rememberLocation(outF.location)
    if (outF.reasonType === 'transfer') rememberLocation(outF.toLocation)

    const now = new Date().toISOString()
    const needsApproval = outF.reasonType === 'scrap' || outF.reasonType === 'transfer'
    const meta: TxMeta = { schema: 'stock-v2', category: outF.category, itemName: outF.itemName.trim(), serialNumber: outF.serialNumber.trim(), location: outF.location.trim(), reason: outF.reason.trim(), issuedTo: outF.issuedTo.trim(), reasonType: outF.reasonType, fromLocation: outF.location.trim(), toLocation: outF.reasonType === 'transfer' ? outF.toLocation.trim() : '', scrapVendor: outF.reasonType === 'scrap' ? outF.scrapVendor.trim() : '', quantity: qty, transactionDate: outF.date, note: outF.note.trim(), createdBy: user?.email || user?.id || 'unknown', createdDate: now, approvalStatus: needsApproval ? 'pending' : 'approved' }
    try {
      const assetId = await ensureAnchor()
      await dataClient.db.stockTransactions.create({ assetId, type: 'out', quantity: qty, reason: buildMeta(meta), createdAt: toIso(outF.date) })
      toast.success(needsApproval ? 'Stock OUT submitted for approval' : 'Stock OUT saved')
      setOutOpen(false)
      setOutF({ category: opts[0].value, itemName: '', serialNumber: '', quantity: '1', location: 'Main Office', reason: '', issuedTo: '', reasonType: 'issue', toLocation: '', scrapVendor: '', date: today, note: '' })
      await load()
    } catch (err) {
      toast.error(`Error saving Stock OUT: ${errMsg(err)}`)
    }
  }

  const approveRequest = async (tx: TxRow) => {
    if (!tx.meta) return
    const now = new Date().toISOString()
    const approvedMeta: TxMeta = { ...tx.meta, approvalStatus: 'approved', approvedBy: user?.email || user?.id || 'unknown', approvedDate: now }
    try {
      await dataClient.db.stockTransactions.update(tx.id, { reason: buildMeta(approvedMeta) })
      if (tx.meta.reasonType === 'transfer' && tx.meta.toLocation) {
        const assetId = await ensureAnchor()
        const inMeta: TxMeta = { ...approvedMeta, location: tx.meta.toLocation, reason: `Transfer received from ${tx.meta.fromLocation || tx.meta.location}`, referenceNumber: `TRF-${Date.now()}`, approvalStatus: 'approved' }
        await dataClient.db.stockTransactions.create({ assetId, type: 'in', quantity: tx.quantity, reason: buildMeta(inMeta), createdAt: toIso(tx.meta.transactionDate || today) })
      }
      toast.success('Request approved')
      await load()
    } catch (err) {
      toast.error(`Approval failed: ${errMsg(err)}`)
    }
  }

  const rejectRequest = async (tx: TxRow) => {
    if (!tx.meta) return
    const now = new Date().toISOString()
    const rejectedMeta: TxMeta = { ...tx.meta, approvalStatus: 'rejected', approvedBy: user?.email || user?.id || 'unknown', approvedDate: now }
    try {
      await dataClient.db.stockTransactions.update(tx.id, { reason: buildMeta(rejectedMeta) })
      toast.success('Request rejected')
      await load()
    } catch (err) {
      toast.error(`Reject failed: ${errMsg(err)}`)
    }
  }

  const outChoices = summary.map(s => ({ value: s.key, label: `${s.itemName}${s.serialNumber ? ` [${s.serialNumber}]` : ''} (${s.location}) - ${s.qty}`, ...s }))
  const selectedOutValue = outF.itemName.trim() ? keyOf(outF.category, outF.itemName, outF.location, outF.serialNumber) : ''
  const exportRows = filteredTxs.map(tx => ({ type: tx.type.toUpperCase(), date: dateOnly(tx.meta?.transactionDate || tx.createdAt), category: tx.meta?.category || '', itemName: tx.meta?.itemName || '', serialNumber: tx.meta?.serialNumber || '', quantity: tx.quantity, reasonType: tx.meta?.reasonType || '', fromLocation: tx.meta?.fromLocation || tx.meta?.location || '', toLocation: tx.meta?.toLocation || '', scrapVendor: tx.meta?.scrapVendor || '', reason: tx.meta?.reason || '', approvalStatus: tx.meta?.approvalStatus || 'approved', createdBy: tx.meta?.createdBy || '' }))

  const exportCsv = () => {
    if (exportRows.length === 0) return toast.error('No rows to export')
    const headers = Object.keys(exportRows[0])
    const lines = [headers.join(','), ...exportRows.map(row => headers.map(h => `"${String((row as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `stock-transactions-${today}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const exportExcel = () => {
    if (exportRows.length === 0) return toast.error('No rows to export')
    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'StockTransactions')
    XLSX.writeFile(wb, `stock-transactions-${today}.xlsx`)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock In / Out</h1>
          <p className="text-muted-foreground">Track incoming and outgoing stock.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={inOpen} onOpenChange={setInOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700"><TrendingUp className="w-4 h-4 mr-2" />Stock IN</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[640px]"><DialogHeader><DialogTitle>Create Stock IN</DialogTitle></DialogHeader>
              <form onSubmit={saveIn} className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Item Category</label>
                    <Select value={inF.category} onValueChange={v => setInF({ ...inF, category: v })}><SelectTrigger><SelectValue placeholder="Choose Asset Type" /></SelectTrigger><SelectContent>{opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Item Name</label>
                    <Input placeholder="Item Name" value={inF.itemName} onChange={e => setInF({ ...inF, itemName: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Vendor Name</label>
                    <Select value={inF.vendor} onValueChange={v => setInF({ ...inF, vendor: v })}><SelectTrigger><SelectValue placeholder="Choose Vendor" /></SelectTrigger><SelectContent>{(vendors.length ? vendors : ['']).map(v => <SelectItem key={v || 'none'} value={v || 'none'}>{v || 'No vendors configured'}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Stock Location</label>
                    <Input list="stock-location-options" placeholder="Location" value={inF.location} onChange={e => setInF({ ...inF, location: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Serial Number</label>
                    <Input placeholder="Serial Number (manual or from vendor)" value={inF.serialNumber} onChange={e => setInF({ ...inF, serialNumber: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Reference Number</label>
                    <Input placeholder="Reference Number" value={inF.referenceNumber} onChange={e => setInF({ ...inF, referenceNumber: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Quantity</label>
                    <Input placeholder="Quantity" inputMode="numeric" value={inF.quantity} onChange={e => setInF({ ...inF, quantity: e.target.value })} onBlur={() => setInF(s => ({ ...s, quantity: qInt(s.quantity, 1) }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Unit Cost (Rs)</label>
                    <Input placeholder="Unit Cost (Rs)" inputMode="decimal" value={inF.unitCost} onChange={e => setInF({ ...inF, unitCost: e.target.value })} onBlur={() => setInF(s => ({ ...s, unitCost: mNum(s.unitCost, 0) }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Total Cost</label>
                    <Input readOnly value={money(inTotal)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div />
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input type="date" value={inF.date} onChange={e => setInF({ ...inF, date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Note</label>
                  <Textarea placeholder="Note" value={inF.note} onChange={e => setInF({ ...inF, note: e.target.value })} />
                </div>
                <DialogFooter><Button className="w-full" type="submit">Save Stock IN</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={outOpen} onOpenChange={setOutOpen}>
            <DialogTrigger asChild><Button className="bg-rose-600 hover:bg-rose-700"><TrendingDown className="w-4 h-4 mr-2" />Stock OUT</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[640px]"><DialogHeader><DialogTitle>Create Stock OUT</DialogTitle></DialogHeader>
              <form onSubmit={saveOut} className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Inventory Item</label>
                  <Select value={selectedOutValue} onValueChange={v => { const s = outChoices.find(x => x.value === v); if (s) setOutF({ ...outF, category: s.category, itemName: s.itemName, serialNumber: s.serialNumber || '', location: s.location }) }}>
                    <SelectTrigger><SelectValue placeholder="Choose Inventory Item" /></SelectTrigger>
                    <SelectContent>{outChoices.length ? outChoices.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>) : <div className="p-2 text-sm text-muted-foreground">No available stock</div>}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Item Category</label>
                    <Input readOnly value={outF.category} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Item Name</label>
                    <Input readOnly value={outF.itemName} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Serial Number</label>
                    <Input value={outF.serialNumber} onChange={e => setOutF({ ...outF, serialNumber: e.target.value })} placeholder="Serial Number" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">From Location</label>
                    <Input readOnly value={outF.location} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Stock Out Type</label>
                    <Select value={outF.reasonType} onValueChange={v => setOutF({ ...outF, reasonType: v as StockOutType })}>
                      <SelectTrigger><SelectValue placeholder="Stock Out Type" /></SelectTrigger>
                      <SelectContent>{OUT_REASON_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Reason</label>
                    <Input placeholder="Reason" value={outF.reason} onChange={e => setOutF({ ...outF, reason: e.target.value })} />
                  </div>
                </div>
                {outF.reasonType === 'transfer' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">To Location</label>
                    <Input list="stock-location-options" placeholder="To Location (transfer destination)" value={outF.toLocation} onChange={e => setOutF({ ...outF, toLocation: e.target.value })} />
                  </div>
                )}
                {outF.reasonType === 'scrap' && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Scrap Vendor Name</label>
                    <Input placeholder="Scrap Vendor Name (required)" value={outF.scrapVendor} onChange={e => setOutF({ ...outF, scrapVendor: e.target.value })} />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Quantity</label>
                    <Input placeholder="Quantity" inputMode="numeric" value={outF.quantity} onChange={e => setOutF({ ...outF, quantity: e.target.value })} onBlur={() => setOutF(s => ({ ...s, quantity: qInt(s.quantity, 1) }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Issued To (optional)</label>
                    <Input placeholder="Issued To (optional)" value={outF.issuedTo} onChange={e => setOutF({ ...outF, issuedTo: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input type="date" value={outF.date} onChange={e => setOutF({ ...outF, date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Note</label>
                  <Textarea placeholder="Note" value={outF.note} onChange={e => setOutF({ ...outF, note: e.target.value })} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {outF.itemName.trim()
                    ? `Available in ${outF.location}${outF.serialNumber ? ` [${outF.serialNumber}]` : ''}: ${qtyByKey.get(keyOf(outF.category, outF.itemName, outF.location, outF.serialNumber)) || 0}`
                    : 'Select Inventory Item first. Then available quantity will be shown.'}
                </div>
                <DialogFooter><Button className="w-full" type="submit" disabled={!outF.itemName.trim()}>Save Stock OUT</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Location</label>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Filter by location" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Locations</SelectItem>{allLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From Date</label>
          <Input data-testid="stock-filter-from-date" type="date" className="w-full sm:w-[150px]" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To Date</label>
          <Input data-testid="stock-filter-to-date" type="date" className="w-full sm:w-[150px]" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Low Stock Alert Qty</label>
          <Input className="w-full sm:w-[220px]" placeholder="Low stock threshold (0 = off)" value={lowStockThreshold} onChange={e => setLowStockThreshold(qInt(e.target.value, 0))} />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setFromDate(''); setToDate('') }}>All Dates</Button>
        <Button variant="outline" size="sm" onClick={() => { setFromDate(today); setToDate(today) }}>Today</Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>Export CSV</Button>
        <Button variant="outline" size="sm" onClick={exportExcel}>Export Excel</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Total Stock</div><div className="text-2xl font-bold mt-1">{totalUnits}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Stock In</div><div className="text-2xl font-bold mt-1">{totalInQty}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Stock Out</div><div className="text-2xl font-bold mt-1">{totalOutQty}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground uppercase">Inventory Value</div><div className="text-2xl font-bold mt-1">{money(totalValue)}</div></CardContent></Card>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">Finance (Depreciation)</div>
          <div className="text-sm text-muted-foreground">Configure depreciation profiles, previews, and finance controls in dedicated module.</div>
        </div>
        <Button variant="outline" onClick={() => navigate('/finance')}>Open Finance Module</Button>
      </div>

      {lowStockItems.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm"><span className="font-semibold text-amber-700">Low Stock Alert:</span> {lowStockItems.map(i => `${i.itemName} (${i.location}: ${i.qty})`).join(', ')}</div>}

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 font-semibold">Inventory Summary</div>
        <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Item</TableHead><TableHead>Serial No.</TableHead><TableHead>Location</TableHead><TableHead>On Hand</TableHead><TableHead>Unit Cost</TableHead><TableHead>Total Value</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow> : filteredSummary.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8"><Package className="w-8 h-8 mx-auto opacity-20" />No inventory in selected filter.</TableCell></TableRow> : filteredSummary.map(r => <TableRow key={r.key}><TableCell className="capitalize">{r.category}</TableCell><TableCell>{r.itemName}</TableCell><TableCell>{r.serialNumber || '-'}</TableCell><TableCell>{r.location}</TableCell><TableCell className="font-semibold">{r.qty}</TableCell><TableCell>{money(r.unitCost)}</TableCell><TableCell className="font-semibold">{money(r.totalValue)}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => { setDetailRow(r); setDetailOpen(true) }}>Full Details</Button></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 font-semibold">Stock OUT Summary</div>
        <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Serial No.</TableHead><TableHead>Reason Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Qty</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow> : outSummary.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No OUT summary in selected filters.</TableCell></TableRow> : outSummary.map(r => <TableRow key={r.key}><TableCell>{r.itemName}</TableCell><TableCell>{r.serialNumber || '-'}</TableCell><TableCell className="capitalize">{r.reasonType}</TableCell><TableCell>{r.fromLocation}</TableCell><TableCell>{r.toLocation}</TableCell><TableCell>{r.qty}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => { setOutDetailRow(r); setOutDetailOpen(true) }}>Full Details</Button></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>

      {pendingApprovals.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden" data-testid="stock-pending-approvals">
          <div className="px-4 py-3 border-b bg-muted/20 font-semibold">Pending Approvals (Scrap / Transfer)</div>
          <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Serial No.</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>{pendingApprovals.map(tx => <TableRow key={tx.id}><TableCell>{tx.meta?.itemName}</TableCell><TableCell>{tx.meta?.serialNumber || '-'}</TableCell><TableCell className="capitalize">{tx.meta?.reasonType}</TableCell><TableCell>{tx.quantity}</TableCell><TableCell>{tx.meta?.fromLocation || tx.meta?.location || '-'}</TableCell><TableCell>{tx.meta?.toLocation || '-'}</TableCell><TableCell>{tx.meta?.reason || '-'}</TableCell><TableCell className="flex gap-2"><Button data-testid={`stock-approve-${tx.id}`} size="sm" onClick={() => void approveRequest(tx)}>Approve</Button><Button size="sm" variant="outline" onClick={() => void rejectRequest(tx)}>Reject</Button></TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
          <div>
            <div className="font-semibold">Monthly Opening / Closing by Location</div>
            <div className="text-xs text-muted-foreground">
              Opening Qty = stock before selected month starts. Closing Qty = Opening + Stock IN - Stock OUT in selected month.
              Example: Opening 10, IN 5, OUT 3, then Closing 12.
            </div>
          </div>
          <Input type="month" className="w-full sm:w-[180px]" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
        </div>
        <Table><TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Opening Qty</TableHead><TableHead>Closing Qty</TableHead></TableRow></TableHeader>
          <TableBody>{monthlyReport.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No monthly data in current filter.</TableCell></TableRow> : monthlyReport.map(r => <TableRow key={r.location}><TableCell>{r.location}</TableCell><TableCell>{r.openingQty}</TableCell><TableCell>{r.closingQty}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/20 font-semibold">Stock Transactions</div>
        <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Item</TableHead><TableHead>Serial No.</TableHead><TableHead>Qty</TableHead><TableHead>Reason Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? <TableRow><TableCell colSpan={9}>Loading...</TableCell></TableRow> : filteredTxs.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No transactions in selected filters.</TableCell></TableRow> : filteredTxs.slice(0, 80).map(tx => { const m = tx.meta; const status = m?.approvalStatus || 'approved'; return <TableRow key={tx.id}><TableCell>{tx.type === 'in' ? <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100"><ArrowUpCircle className="w-3 h-3 mr-1 inline" />IN</Badge> : <Badge className="bg-rose-50 text-rose-600 border-rose-100"><ArrowDownCircle className="w-3 h-3 mr-1 inline" />OUT</Badge>}</TableCell><TableCell>{m?.itemName || 'Legacy / Asset Transaction'}</TableCell><TableCell>{m?.serialNumber || '-'}</TableCell><TableCell>{tx.quantity}</TableCell><TableCell className="capitalize">{m?.reasonType || (tx.type === 'in' ? 'in' : 'out')}</TableCell><TableCell>{m?.fromLocation || m?.location || '-'}</TableCell><TableCell>{m?.toLocation || '-'}</TableCell><TableCell className="capitalize">{status}</TableCell><TableCell className="text-sm text-muted-foreground"><Calendar className="w-3 h-3 mr-1 inline" />{dateOnly(m?.transactionDate || tx.createdAt)}</TableCell></TableRow> })}</TableBody>
        </Table>
      </div>

      <datalist id="stock-location-options">
        {locationOptions.map(loc => <option key={loc} value={loc} />)}
      </datalist>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[760px]"><DialogHeader><DialogTitle>Inventory Full Details</DialogTitle></DialogHeader>
          {detailRow && <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Serial No.</TableHead><TableHead>Qty</TableHead><TableHead>Reason</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{detailTxs.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No movements found.</TableCell></TableRow> : detailTxs.map(tx => <TableRow key={tx.id}><TableCell className="uppercase">{tx.type}</TableCell><TableCell>{tx.meta?.serialNumber || '-'}</TableCell><TableCell>{tx.quantity}</TableCell><TableCell>{tx.meta?.reason || tx.meta?.note || '-'}</TableCell><TableCell>{dateOnly(tx.meta?.transactionDate || tx.createdAt)}</TableCell></TableRow>)}</TableBody></Table>}
        </DialogContent>
      </Dialog>

      <Dialog open={outDetailOpen} onOpenChange={setOutDetailOpen}>
        <DialogContent className="sm:max-w-[760px]"><DialogHeader><DialogTitle>Stock OUT Full Details</DialogTitle></DialogHeader>
          {outDetailRow && <Table><TableHeader><TableRow><TableHead>Serial No.</TableHead><TableHead>Qty</TableHead><TableHead>Reason</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{outDetailTxs.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No movements found.</TableCell></TableRow> : outDetailTxs.map(tx => <TableRow key={tx.id}><TableCell>{tx.meta?.serialNumber || '-'}</TableCell><TableCell>{tx.quantity}</TableCell><TableCell>{tx.meta?.reason || '-'}</TableCell><TableCell>{tx.meta?.fromLocation || tx.meta?.location || '-'}</TableCell><TableCell>{tx.meta?.toLocation || '-'}</TableCell><TableCell>{dateOnly(tx.meta?.transactionDate || tx.createdAt)}</TableCell></TableRow>)}</TableBody></Table>}
        </DialogContent>
      </Dialog>
    </div>
  )
}

