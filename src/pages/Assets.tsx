import React, { useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Laptop,
  Smartphone,
  Monitor,
  Headphones,
  Usb,
  Package,
  X,
  Check,
  ListFilter,
  Upload,
  Cpu,
  Database,
  Layout
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { dataClient } from '../lib/dataClient'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import { Label } from '../components/ui/label'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Checkbox } from '../components/ui/checkbox'

import { useCategories, ICON_MAP } from '../hooks/useCategories'
import { useUserRole } from '../hooks/useUserRole'
import { AssetHistory } from '../components/AssetHistory'
import { useDepartments } from '../hooks/useDepartments'
import { useVendors } from '../hooks/useVendors'

export function Assets() {
  const { isAdmin } = useUserRole()
  const { categories, loading: categoriesLoading } = useCategories()
  const { departments } = useDepartments()
  const { vendors } = useVendors()
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add Asset State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newAsset, setNewAsset] = useState({
    category: 'laptop',
    serialNumber: '',
    deviceSerialNumber: '',
    location: 'Main Office',
    configuration: '',
    company: '',
    model: '',
    department: '',
    warrantyStart: '',
    warrantyEnd: '',
    warrantyVendor: ''
  })
  const [stockChoices, setStockChoices] = useState<Array<{
    key: string
    label: string
    category: string
    itemName: string
    serialNumber: string
    location: string
    vendor: string
    referenceNumber: string
    qty: number
  }>>([])
  const [selectedStockKey, setSelectedStockKey] = useState<string>('none')

  // Edit Asset State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<any>(null)

  // History State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyAsset, setHistoryAsset] = useState<any>(null)

  const parseStockMeta = (reason: string) => {
    if (!reason || !reason.startsWith('v2|')) return null
    try {
      const record: Record<string, string> = {}
      reason.split('|').slice(1).forEach(part => {
        const idx = part.indexOf('=')
        if (idx > 0) record[part.slice(0, idx)] = part.slice(idx + 1)
      })
      const dec = (v?: string) => decodeURIComponent(v || '')
      const category = dec(record.c)
      const itemName = dec(record.i)
      const location = dec(record.l)
      if (!category || !itemName || !location) return null
      return {
        category,
        itemName,
        serialNumber: dec(record.sn),
        location,
        vendor: dec(record.v),
        referenceNumber: dec(record.r),
        approvalStatus: dec(record.as),
      }
    } catch {
      return null
    }
  }

  const buildStockMetaReason = (input: {
    category: string
    itemName: string
    serialNumber?: string
    location: string
    vendor?: string
    referenceNumber?: string
    note: string
    createdBy: string
    createdDate: string
  }) => {
    const enc = (v?: string) => encodeURIComponent((v || '').trim())
    const parts = [
      `v2|c=${enc(input.category)}`,
      `i=${enc(input.itemName)}`,
      `sn=${enc(input.serialNumber)}`,
      `l=${enc(input.location)}`,
      `d=${enc(input.createdDate.slice(0, 10))}`,
      `n=${enc(input.note)}`,
      `by=${enc(input.createdBy)}`,
      `cd=${enc(input.createdDate)}`,
      'q=1',
      'rt=issue',
      'as=approved',
      `rs=${enc('Converted to asset')}`
    ]
    if (input.vendor?.trim()) parts.push(`v=${enc(input.vendor)}`)
    if (input.referenceNumber?.trim()) parts.push(`r=${enc(input.referenceNumber)}`)
    return parts.join('|')
  }

  // Unpack helper
  const unpackLocation = (packed: string) => {
    if (!packed) return { location: '', configuration: '' }
    if (packed.includes(' ||| ')) {
      const [location, ...rest] = packed.split(' ||| ')
      return { location: location || '', configuration: rest.join(' ||| ') || '' }
    }
    return { location: packed, configuration: '' }
  }

  const buildConfiguration = (
    company: string,
    model: string,
    department: string,
    deviceSerialNumber: string,
    config: string,
    warrantyStart?: string,
    warrantyEnd?: string,
    warrantyVendor?: string
  ) => {
    const parts: string[] = []
    if (company?.trim()) parts.push(`Company: ${company.trim()}`)
    if (model?.trim()) parts.push(`Model: ${model.trim()}`)
    if (department?.trim()) parts.push(`Department: ${department.trim()}`)
    if (deviceSerialNumber?.trim()) parts.push(`Serial Number: ${deviceSerialNumber.trim()}`)
    if (warrantyStart?.trim()) parts.push(`Warranty Start: ${warrantyStart.trim()}`)
    if (warrantyEnd?.trim()) parts.push(`Warranty End: ${warrantyEnd.trim()}`)
    if (warrantyVendor?.trim()) parts.push(`Warranty Vendor: ${warrantyVendor.trim()}`)
    if (config?.trim()) parts.push(config.trim())
    return parts.join(' | ')
  }

  const buildAssetName = (company: string, model: string) => {
    const parts = [company?.trim(), model?.trim()].filter(Boolean)
    return parts.join(' ') || 'Unnamed Asset'
  }

  const isLaptopCategory = (value: string) => value.toLowerCase().includes('laptop')
  const isMobileBarcodeCategory = (value: string) => /(phone|mobile|barcode|scanner|handheld)/i.test(value)

  const getCategoryCode = (value: string) => {
    const v = (value || '').toLowerCase()
    if (v.includes('laptop')) return 'L'
    if (v.includes('printer')) return 'P'
    if (v.includes('phone') || v.includes('mobile') || v.includes('smartphone')) return 'M'
    if (v.includes('barcode') || v.includes('scanner') || v.includes('handheld')) return 'B'
    const first = v.split(/[\s_-]+/)[0]?.[0]
    return (first || 'X').toUpperCase()
  }

  const getNextSerialForCategory = (category: string, serials: string[], counters: Record<string, number>) => {
    const code = getCategoryCode(category)
    const prefix = `KTPL-${code}`
    if (counters[prefix] === undefined) {
      const max = serials.reduce((acc, s) => {
        if (!s || !s.startsWith(prefix)) return acc
        const num = parseInt(s.replace(prefix, ''), 10)
        return Number.isFinite(num) ? Math.max(acc, num) : acc
      }, 0)
      counters[prefix] = max
    }
    counters[prefix] += 1
    return `${prefix}${String(counters[prefix]).padStart(2, '0')}`
  }

  // Spec Parser
  const parseSpecs = (config: string) => {
    const specs = { cpu: 'Other', ram: 'Other', storage: 'Other' }
    if (!config) return specs

    // CPU Logic (i3, i5, i7, i9, M1, M2, M3)
    const cpuMatch = config.match(/\b(i[3579]|i\d|m[1-9]|ryzen\s*\d+|xeon|threadripper)\b/i)
    if (cpuMatch) {
      const raw = cpuMatch[0].trim()
      specs.cpu = raw.toLowerCase().startsWith('ryzen')
        ? raw.replace(/\bryzen\b/i, 'Ryzen')
        : raw.toUpperCase()
    }

    // RAM Logic (8GB, 16GB, 32GB, 64GB)
    const ramMatch = config.match(/\b(\d+)\s*(GB|G)\s*RAM\b/i) || config.match(/\bRAM\s*(\d+)\s*(GB|G)\b/i)
    if (ramMatch) specs.ram = ramMatch[1] + 'GB'

    // Storage Logic (256GB, 512GB, 1TB)
    const storageMatch = config.match(/\b(\d+)\s*(TB|GB)\b\s*(SSD|HDD|NVME|STORAGE)\b/i) || config.match(/\b(\d+)\s*TB\b/i)
    if (storageMatch) {
      const unit = storageMatch[2]?.toUpperCase() === 'TB' || /TB/i.test(storageMatch[0]) ? 'TB' : 'GB'
      specs.storage = storageMatch[1] + unit
    }

    return specs
  }

  // Device Details Parser (Company/Model)
  const parseDeviceDetails = (config: string, name: string) => {
    const details = { company: 'Other', model: 'Other' }
    const source = `${config || ''} ${name || ''}`.trim()
    if (!source) return details

    const companyMatch =
      source.match(/\b(?:company|brand|vendor)\s*[:-]\s*([A-Za-z0-9 ]{2,40})\b/i) ||
      source.match(/\b(zebra|honeywell|datalogic|motorola|samsung|apple|lenovo|dell|hp)\b/i)
    if (companyMatch) {
      details.company = companyMatch[1] ? companyMatch[1].trim() : companyMatch[0].trim()
    } else if (name) {
      details.company = name.split(' ')[0] || 'Other'
    }

    const modelMatch =
      source.match(/\b(?:model|model no|model number)\s*[:-]\s*([A-Za-z0-9- ]{2,40})\b/i) ||
      source.match(/\b([A-Z]{1,3}\d{2,4}[A-Z0-9-]*)\b/)
    if (modelMatch) {
      details.model = modelMatch[1] ? modelMatch[1].trim() : modelMatch[0].trim()
    }

    return details
  }

  // Filter State
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [specFilters, setSpecFilters] = useState({
    cpu: [] as string[],
    ram: [] as string[],
    storage: [] as string[]
  })
  const [deviceFilters, setDeviceFilters] = useState({
    company: [] as string[],
    model: [] as string[]
  })
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([])
  const [isImportMapOpen, setIsImportMapOpen] = useState(false)
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importRows, setImportRows] = useState<Record<string, any>[]>([])
  const [importMapping, setImportMapping] = useState({
    model: '',
    assetId: '',
    company: '',
    department: '',
    category: '',
    processor: '',
    ram: '',
    hdd: '',
    serviceTag: '',
    location: '',
    configuration: '',
    warrantyStart: '',
    warrantyEnd: '',
    warrantyVendor: ''
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
    fetchAssets()
  }, [])

  const fetchAssets = async () => {
    try {
      const [data, issuances, stockTxs] = await Promise.all([
        dataClient.db.assets.list({ orderBy: { createdAt: 'desc' } }),
        dataClient.db.issuances.list({ where: { status: 'active' } }),
        dataClient.db.stockTransactions.list({ orderBy: { createdAt: 'desc' } })
      ])
      const activeAssignments = new Map<string, { userName?: string, userEmail?: string }>()
      issuances
        .filter((i: any) => i && i.status === 'active' && i.assetId)
        .forEach((i: any) => {
          activeAssignments.set(i.assetId, { userName: i.userName, userEmail: i.userEmail })
        })

      const processedAssets = data.map((a: any) => {
        const { location, configuration } = unpackLocation(a.location)
        const specs = parseSpecs(configuration || a.configuration)
        const deviceDetails = parseDeviceDetails(configuration || a.configuration, a.name)
        const departmentMatch = (configuration || a.configuration || '').match(/Department:\s*([^|]+)/i)
        const department = departmentMatch ? departmentMatch[1].trim() : ''
        const warrantyStartMatch = (configuration || a.configuration || '').match(/Warranty Start:\s*([^|]+)/i)
        const warrantyEndMatch = (configuration || a.configuration || '').match(/Warranty End:\s*([^|]+)/i)
        const warrantyVendorMatch = (configuration || a.configuration || '').match(/Warranty Vendor:\s*([^|]+)/i)
        const serialMatch = (configuration || a.configuration || '').match(/Serial Number:\s*([^|]+)/i)
        const serviceTagMatch = (configuration || a.configuration || '').match(/Service Tag:\s*([^,|]+)/i)
        const warrantyStart = warrantyStartMatch ? warrantyStartMatch[1].trim() : ''
        const warrantyEnd = warrantyEndMatch ? warrantyEndMatch[1].trim() : ''
        const warrantyVendor = warrantyVendorMatch ? warrantyVendorMatch[1].trim() : ''
        const deviceSerialNumber = (
          a.deviceSerialNumber ||
          (serialMatch ? serialMatch[1].trim() : '') ||
          (serviceTagMatch ? serviceTagMatch[1].trim() : '') ||
          ''
        ).trim()
        const assignment = activeAssignments.get(a.id)
        return {
          ...a,
          displayLocation: location,
          configuration: a.configuration || configuration,
          ...specs,
          ...deviceDetails,
          department,
          warrantyStart,
          warrantyEnd,
          warrantyVendor,
          deviceSerialNumber,
          assignedToName: a.assignedToName || assignment?.userName || '',
          assignedTo: a.assignedTo || assignment?.userEmail || ''
        }
      })
      setAssets(processedAssets)

      const stockMap = new Map<string, {
        category: string
        itemName: string
        serialNumber: string
        location: string
        vendor: string
        referenceNumber: string
        qty: number
      }>()

      ;(stockTxs as any[]).forEach((tx: any) => {
        if (!tx || (tx.type !== 'in' && tx.type !== 'out')) return
        const meta = parseStockMeta(String(tx.reason || ''))
        if (!meta) return
        if (meta.approvalStatus && meta.approvalStatus !== 'approved') return
        const key = `${meta.category}||${meta.itemName}||${meta.serialNumber || ''}||${meta.location}||${meta.vendor || ''}||${meta.referenceNumber || ''}`
        const row = stockMap.get(key) || {
          category: meta.category,
          itemName: meta.itemName,
          serialNumber: meta.serialNumber || '',
          location: meta.location,
          vendor: meta.vendor || '',
          referenceNumber: meta.referenceNumber || '',
          qty: 0
        }
        const qty = Number(tx.quantity) || 0
        row.qty += tx.type === 'in' ? qty : -qty
        stockMap.set(key, row)
      })

      const choices = Array.from(stockMap.entries())
        .map(([key, v]) => ({
          key,
          label: `${v.itemName}${v.serialNumber ? ` [${v.serialNumber}]` : ''} (${v.location})${v.vendor ? ` • ${v.vendor}` : ''}${v.referenceNumber ? ` • ${v.referenceNumber}` : ''} • Qty: ${v.qty}`,
          category: v.category,
          itemName: v.itemName,
          serialNumber: v.serialNumber,
          location: v.location,
          vendor: v.vendor,
          referenceNumber: v.referenceNumber,
          qty: v.qty
        }))
        .filter(v => v.qty > 0)
        .sort((a, b) => a.itemName.localeCompare(b.itemName))
      setStockChoices(choices)
    } catch (error) {
      toast.error('Failed to fetch assets')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check for Dev Login
    if (isRestrictedDevUser()) {
      toast.error('Dev Login is read-only. To add assets, please Logout and "Sign in with Company SSO".', {
        duration: 5000,
        position: 'top-center'
      })
      return
    }

    try {
      const fullConfig = buildConfiguration(
        newAsset.company,
        newAsset.model,
        newAsset.department,
        newAsset.deviceSerialNumber,
        newAsset.configuration,
        newAsset.warrantyStart,
        newAsset.warrantyEnd,
        newAsset.warrantyVendor
      )
      const existingSerials = assets.map(a => a.serialNumber).filter(Boolean)
      const serialCounters: Record<string, number> = {}
      const serialNumber = newAsset.serialNumber?.trim()
        ? newAsset.serialNumber.trim()
        : getNextSerialForCategory(newAsset.category, existingSerials, serialCounters)
      const packedLocation = `${newAsset.location} ||| ${fullConfig}`
      const created = await dataClient.db.assets.create({
        name: buildAssetName(newAsset.company, newAsset.model),
        category: newAsset.category,
        serialNumber,
        deviceSerialNumber: (newAsset.deviceSerialNumber || '').trim(),
        company: (newAsset.company || '').trim(),
        model: (newAsset.model || '').trim(),
        department: (newAsset.department || '').trim(),
        warrantyStart: (newAsset.warrantyStart || '').trim(),
        warrantyEnd: (newAsset.warrantyEnd || '').trim(),
        warrantyVendor: (newAsset.warrantyVendor || '').trim(),
        configuration: (newAsset.configuration || '').trim(),
        location: packedLocation,
        status: 'available'
      })
      if (selectedStockKey !== 'none') {
        const selectedStock = stockChoices.find(s => s.key === selectedStockKey)
        if (selectedStock) {
          const now = new Date().toISOString()
          const reason = buildStockMetaReason({
            category: selectedStock.category,
            itemName: selectedStock.itemName,
            serialNumber: selectedStock.serialNumber,
            location: selectedStock.location,
            vendor: selectedStock.vendor,
            referenceNumber: selectedStock.referenceNumber,
            note: `Converted to asset ${serialNumber}`,
            createdBy: 'asset-module',
            createdDate: now
          })
          await dataClient.db.stockTransactions.create({
            assetId: created.id,
            type: 'out',
            quantity: 1,
            reason,
            createdAt: now
          })
        }
      } else {
        await dataClient.db.stockTransactions.create({
          assetId: created.id,
          type: 'in',
          quantity: 1,
          reason: 'New asset added',
          createdAt: new Date().toISOString()
        })
      }
      toast.success('Asset added successfully')
      setIsAddOpen(false)
      setSelectedStockKey('none')
      setNewAsset({
        category: categories[0]?.value || 'laptop',
        serialNumber: '',
        deviceSerialNumber: '',
        location: 'Main Office',
        configuration: '',
        company: '',
        model: '',
        department: '',
        warrantyStart: '',
        warrantyEnd: '',
        warrantyVendor: ''
      })
      fetchAssets()
    } catch (error) {
      console.error('Error adding asset:', error)
      toast.error('Error adding asset: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAsset) return

    // Check for Dev Login
    if (isRestrictedDevUser()) {
      toast.error('Dev Login is read-only. Please "Sign in with Company SSO" to update records.')
      return
    }

    try {
      // Pack location and configuration back into the location field
      const fullConfig = buildConfiguration(
        editingAsset.company,
        editingAsset.model,
        editingAsset.department,
        editingAsset.deviceSerialNumber || '',
        editingAsset.configuration || '',
        editingAsset.warrantyStart,
        editingAsset.warrantyEnd,
        editingAsset.warrantyVendor
      )
      const packedLocation = `${editingAsset.displayLocation || editingAsset.location} ||| ${fullConfig}`

      // ONLY send fields that are part of the asset schema
      const updateData = {
        name: buildAssetName(editingAsset.company, editingAsset.model),
        category: editingAsset.category,
        serialNumber: editingAsset.serialNumber,
        deviceSerialNumber: editingAsset.deviceSerialNumber || '',
        company: (editingAsset.company || '').trim(),
        model: (editingAsset.model || '').trim(),
        department: (editingAsset.department || '').trim(),
        warrantyStart: (editingAsset.warrantyStart || '').trim(),
        warrantyEnd: (editingAsset.warrantyEnd || '').trim(),
        warrantyVendor: (editingAsset.warrantyVendor || '').trim(),
        configuration: (editingAsset.configuration || '').trim(),
        status: editingAsset.status,
        location: packedLocation
      }

      await dataClient.db.assets.update(editingAsset.id, updateData)
      toast.success('Asset updated successfully')
      setIsEditOpen(false)
      setEditingAsset(null)
      fetchAssets()
    } catch (error: any) {
      console.error('Update error:', error)
      toast.error('Error updating asset: ' + (error.message || 'Unknown error'))
    }
  }

  const handleDeleteAsset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return

    // Check for Dev Login
    if (isRestrictedDevUser()) {
      toast.error('Dev Login is read-only. Please use Company SSO for database changes.')
      return
    }

    try {
      await dataClient.db.assets.delete(id)
      toast.success('Asset deleted')
      fetchAssets()
    } catch (error) {
      toast.error('Error deleting asset')
    }
  }

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check for Dev Login
    if (isRestrictedDevUser()) {
      toast.error('Dev Login is read-only. Please "Sign in with Company SSO" to import assets.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)
        const headers = Object.keys(jsonData[0] || {})

        const guess = (cands: string[]) => headers.find(h => cands.some(c => h.toLowerCase() === c.toLowerCase())) || ''
        setImportMapping({
          model: guess(['ASSET MODEL', 'Asset Model', 'Model']),
          assetId: guess(['ASSET ID', 'Asset ID', 'Asset Code']),
          company: guess(['Company']),
          department: guess(['Department']),
          category: guess(['Category']),
          processor: guess(['PROCESSOR', 'Processor']),
          ram: guess(['RAM', 'Ram']),
          hdd: guess(['HDD', 'Storage']),
          serviceTag: guess(['Serial Number', 'Serial No', 'SERIAL NUMBER', 'SERVICE TAG', 'Service Tag', 'SERVICE TAG ']),
          location: guess(['Location']),
          configuration: guess(['Configuration']),
          warrantyStart: guess(['Warranty Start', 'WarrantyStart', 'Warranty From']),
          warrantyEnd: guess(['Warranty End', 'WarrantyEnd', 'Warranty To']),
          warrantyVendor: guess(['Warranty Vendor', 'Vendor', 'Warranty Provider'])
        })
        setImportHeaders(headers)
        setImportRows(jsonData)
        setIsImportMapOpen(true)
      } catch (error) {
        console.error('Bulk import error:', error)
        toast.error('Failed to parse Excel file', { id: 'bulk-import' })
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const handleMappedImport = async () => {
    if (!importMapping.model) {
      toast.error('Please map the Asset Model column.')
      return
    }
    toast.loading(`Importing ${importRows.length} assets...`, { id: 'bulk-import' })
    let successCount = 0
    const existingSerials = assets.map(a => a.serialNumber).filter(Boolean)
    const serialCounters: Record<string, number> = {}

    for (const row of importRows) {
      try {
        const getVal = (key: string) => (key ? row[key] : '')
        const model = getVal(importMapping.model) || ''
        const companyFromModel = typeof model === 'string' && model.trim().length > 0 ? model.trim().split(' ')[0] : ''
        const company = getVal(importMapping.company) || companyFromModel
        const department = getVal(importMapping.department) || ''
        const warrantyStart = getVal(importMapping.warrantyStart) || ''
        const warrantyEnd = getVal(importMapping.warrantyEnd) || ''
        const warrantyVendor = getVal(importMapping.warrantyVendor) || ''

        const processor = getVal(importMapping.processor)
        const ram = getVal(importMapping.ram)
        const hdd = getVal(importMapping.hdd)
        const serviceTag = getVal(importMapping.serviceTag)
        const deviceSerialRaw = getVal(importMapping.serviceTag)
        const configParts = [processor, ram ? `${ram} RAM` : '', hdd, serviceTag ? `Service Tag: ${serviceTag}` : ''].filter(Boolean).join(', ')
        const rowConfig = getVal(importMapping.configuration) || configParts
        const fullConfig = buildConfiguration(
          String(company || ''),
          String(model || ''),
          String(department || ''),
          String(deviceSerialRaw || ''),
          String(rowConfig || ''),
          String(warrantyStart || ''),
          String(warrantyEnd || ''),
          String(warrantyVendor || '')
        )

        const rowLocation = getVal(importMapping.location) || 'Main Office'
        const packedLocation = fullConfig ? `${rowLocation} ||| ${fullConfig}` : rowLocation

        const categoryRaw = getVal(importMapping.category) || ''
        const categoryGuess = typeof model === 'string' && /laptop|latitude|elitebook|thinkpad|vostro/i.test(model)
          ? 'laptop'
          : 'other'
        const category = String(categoryRaw || categoryGuess || 'laptop').toLowerCase()

        const serialRaw = getVal(importMapping.assetId)
        const serialNumber = serialRaw && String(serialRaw).trim()
          ? String(serialRaw).trim()
          : getNextSerialForCategory(category, existingSerials, serialCounters)

        const created = await dataClient.db.assets.create({
          name: buildAssetName(String(company || ''), String(model || '')) || 'Unknown Asset',
          category,
          serialNumber,
          deviceSerialNumber: deviceSerialRaw ? String(deviceSerialRaw).trim() : '',
          company: String(company || '').trim(),
          model: String(model || '').trim(),
          department: String(department || '').trim(),
          warrantyStart: String(warrantyStart || '').trim(),
          warrantyEnd: String(warrantyEnd || '').trim(),
          warrantyVendor: String(warrantyVendor || '').trim(),
          configuration: String(rowConfig || '').trim(),
          location: packedLocation,
          status: 'available'
        })
        await dataClient.db.stockTransactions.create({
          assetId: created.id,
          type: 'in',
          quantity: 1,
          reason: 'Bulk import',
          createdAt: new Date().toISOString()
        })
        existingSerials.push(serialNumber)
        successCount++
      } catch (err) {
        console.error('Error importing row:', row, err)
      }
    }

    toast.success(`Successfully imported ${successCount} assets`, { id: 'bulk-import' })
    setIsImportMapOpen(false)
    setImportRows([])
    setImportHeaders([])
    fetchAssets()
  }

  const tabCategory = activeTab !== 'all' && activeTab !== 'department' ? activeTab : null
  const isLaptopTab = isLaptopCategory(activeTab)
  const isMobileBarcodeTab = isMobileBarcodeCategory(activeTab)
  const isDepartmentTab = activeTab === 'department'

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      (asset.deviceSerialNumber || '').toLowerCase().includes(search.toLowerCase())

    const matchesCategory = tabCategory
      ? asset.category === tabCategory
      : (filterCategory === 'all' || asset.category === filterCategory)
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus

    // Spec Filters
    const applyLaptopSpecs = isLaptopTab
    const matchesCpu = !applyLaptopSpecs || specFilters.cpu.length === 0 || specFilters.cpu.includes(asset.cpu)
    const matchesRam = !applyLaptopSpecs || specFilters.ram.length === 0 || specFilters.ram.includes(asset.ram)
    const matchesStorage = !applyLaptopSpecs || specFilters.storage.length === 0 || specFilters.storage.includes(asset.storage)

    // Device Filters (Company/Model)
    const applyDeviceFilters = isLaptopTab || isMobileBarcodeTab
    const matchesCompany = !applyDeviceFilters || deviceFilters.company.length === 0 || deviceFilters.company.includes(asset.company)
    const matchesModel = !applyDeviceFilters || deviceFilters.model.length === 0 || deviceFilters.model.includes(asset.model)

    const matchesDepartment = departmentFilters.length === 0 || departmentFilters.includes(asset.department)
    return matchesSearch && matchesCategory && matchesStatus && matchesCpu && matchesRam && matchesStorage && matchesCompany && matchesModel && (!isDepartmentTab || matchesDepartment)
  })

  // Sidebar Filter Options
  const assetsForFilters = tabCategory ? assets.filter(a => a.category === tabCategory) : assets
  const availableCpus = Array.from(new Set(assetsForFilters.map(a => a.cpu))).filter(Boolean).sort()
  const availableRams = Array.from(new Set(assetsForFilters.map(a => a.ram))).filter(Boolean).sort()
  const availableStorages = Array.from(new Set(assetsForFilters.map(a => a.storage))).filter(Boolean).sort()
  const availableCompanies = Array.from(new Set(assetsForFilters.map(a => a.company))).filter(Boolean).sort()
  const availableModels = Array.from(new Set(assetsForFilters.map(a => a.model))).filter(Boolean).sort()
  const availableDepartments = Array.from(new Set(assets.map(a => a.department))).filter(Boolean).sort()

  const toggleSpecFilter = (type: 'cpu' | 'ram' | 'storage', value: string) => {
    setSpecFilters(prev => {
      const current = prev[type]
      const updated = current.includes(value)
        ? current.filter(i => i !== value)
        : [...current, value]
      return { ...prev, [type]: updated }
    })
  }

  const toggleDeviceFilter = (type: 'company' | 'model', value: string) => {
    setDeviceFilters(prev => {
      const current = prev[type]
      const updated = current.includes(value)
        ? current.filter(i => i !== value)
        : [...current, value]
      return { ...prev, [type]: updated }
    })
  }

  const toggleDepartmentFilter = (value: string) => {
    setDepartmentFilters(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100">IT Stock</Badge>
      case 'returned': return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100">IT Stock</Badge>
      case 'issued': return <Badge className="bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100">Issued</Badge>
      case 'maintenance': return <Badge className="bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100">Maintenance</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getCategoryIcon = (categoryValue: string) => {
    // Find the category object to get the icon name
    const category = categories.find(c => c.value === categoryValue)
    // Lookup the component from map
    const Icon = ICON_MAP[category?.icon || 'default'] || ICON_MAP['default']
    return <Icon className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight" data-tour="assets-page-header">Assets</h1>
          <p className="text-muted-foreground">Detailed hardware inventory and tracking.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleBulkImport}
                  className="hidden"
                  id="bulk-import-input"
                  data-testid="bulk-import-input"
                />
                <Button variant="outline" className="rounded-xl" asChild>
                  <label htmlFor="bulk-import-input" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Import
                  </label>
                </Button>
              </div>
              <Button className="rounded-xl shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Asset
              </Button>
            </div>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAsset} className="space-y-4 py-4">
              <div className="text-xs text-muted-foreground">
                Asset name will be auto-generated from Company + Model.
              </div>
              {(isLaptopCategory(newAsset.category) || isMobileBarcodeCategory(newAsset.category)) && (
                <>
                  <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                    <Input
                      placeholder="e.g. Zebra, Honeywell, Dell"
                      value={newAsset.company}
                      onChange={e => setNewAsset({ ...newAsset, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Model</label>
                    <Input
                      placeholder="e.g. TC52, EDA51, Latitude 7420"
                      value={newAsset.model}
                      onChange={e => setNewAsset({ ...newAsset, model: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset ID</label>
                    <Input
                      placeholder="Leave blank to auto-generate (KTPL-L01)"
                      value={newAsset.serialNumber}
                      onChange={e => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">Auto format: KTPL-L01, KTPL-P01, KTPL-M01...</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Serial Number</label>
                    <Input
                      placeholder="Enter device serial number"
                      value={newAsset.deviceSerialNumber}
                      onChange={e => setNewAsset({ ...newAsset, deviceSerialNumber: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Convert From Stock (Optional)</label>
                <Select
                  value={selectedStockKey}
                  onValueChange={(v) => {
                    setSelectedStockKey(v)
                    if (v === 'none') return
                    const selected = stockChoices.find(s => s.key === v)
                    if (!selected) return
                    const mappedCategory = categories.some(c => c.value === selected.category) ? selected.category : (newAsset.category || categories[0]?.value || 'laptop')
                    setNewAsset(prev => ({
                      ...prev,
                      category: mappedCategory,
                      company: selected.vendor || prev.company,
                      model: selected.itemName || prev.model,
                      location: selected.location || prev.location,
                      warrantyVendor: selected.vendor || prev.warrantyVendor,
                      deviceSerialNumber: selected.serialNumber || selected.referenceNumber || prev.deviceSerialNumber
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stock item to convert" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual Entry (No Stock Conversion)</SelectItem>
                    {stockChoices.map(choice => (
                      <SelectItem key={choice.key} value={choice.key}>{choice.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Selecting stock auto-fills fields. You can still edit all fields manually.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select
                  value={newAsset.department}
                  onValueChange={v => setNewAsset({ ...newAsset, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dep => (
                      <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warranty Start</label>
                  <Input
                    type="date"
                    value={newAsset.warrantyStart}
                    onChange={e => setNewAsset({ ...newAsset, warrantyStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warranty End</label>
                  <Input
                    type="date"
                    value={newAsset.warrantyEnd}
                    onChange={e => setNewAsset({ ...newAsset, warrantyEnd: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Warranty Vendor</label>
                <Select
                  value={newAsset.warrantyVendor || '__none__'}
                  onValueChange={v => setNewAsset({ ...newAsset, warrantyVendor: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warranty vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={newAsset.category}
                  onValueChange={v => setNewAsset({ ...newAsset, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(cat.value)}
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isLaptopCategory(newAsset.category) && !isMobileBarcodeCategory(newAsset.category) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset ID</label>
                    <Input
                      placeholder="Leave blank to auto-generate (KTPL-L01)"
                      value={newAsset.serialNumber}
                      onChange={e => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">Auto format: KTPL-L01, KTPL-P01, KTPL-M01...</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Serial Number</label>
                    <Input
                      placeholder="Enter device serial number"
                      value={newAsset.deviceSerialNumber}
                      onChange={e => setNewAsset({ ...newAsset, deviceSerialNumber: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {isLaptopCategory(newAsset.category) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    System Configuration
                  </label>
                  <Textarea
                    placeholder="e.g. Core i7, 16GB RAM, 512GB SSD"
                    value={newAsset.configuration}
                    onChange={e => setNewAsset({ ...newAsset, configuration: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>
              )}
              {!isLaptopCategory(newAsset.category) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <Textarea
                    placeholder="Any extra details..."
                    value={newAsset.configuration}
                    onChange={e => setNewAsset({ ...newAsset, configuration: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>
              )}
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full">Save Asset</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or serial..."
                className="pl-10 bg-muted/30 border-none rounded-xl"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-lg h-10 border-dashed">
                    <ListFilter className="w-4 h-4 mr-2" />
                    Filter
                    {(filterCategory !== 'all' || filterStatus !== 'all') && (
                      <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                        {(filterCategory !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0)}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Filters</h4>
                      <p className="text-sm text-muted-foreground">Narrow down the asset list.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="available">IT Stock</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    </div>
                    {(filterCategory !== 'all' || filterStatus !== 'all') && (
                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setFilterCategory('all')
                          setFilterStatus('all')
                        }}
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Edit Dialog */}
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent className="w-[95vw] sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Asset Details</DialogTitle>
              </DialogHeader>
              {editingAsset && (
                <form onSubmit={handleUpdateAsset} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      value={editingAsset.category}
                      onValueChange={v => setEditingAsset({ ...editingAsset, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(cat.value)}
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asset ID</label>
                    <Input
                      required
                      value={editingAsset.serialNumber}
                      onChange={e => setEditingAsset({ ...editingAsset, serialNumber: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">Company asset ID format: KTPL-L01, KTPL-P01, KTPL-M01...</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Serial Number</label>
                    <Input
                      value={editingAsset.deviceSerialNumber || ''}
                      onChange={e => setEditingAsset({ ...editingAsset, deviceSerialNumber: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">Manufacturer/device serial number.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={editingAsset.status}
                      onValueChange={v => setEditingAsset({ ...editingAsset, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">IT Stock</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(isLaptopCategory(editingAsset.category) || isMobileBarcodeCategory(editingAsset.category)) && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Company</label>
                        <Input
                          placeholder="e.g. Zebra, Honeywell, Dell"
                          value={editingAsset.company || ''}
                          onChange={e => setEditingAsset({ ...editingAsset, company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Model</label>
                        <Input
                          placeholder="e.g. TC52, EDA51, Latitude 7420"
                          value={editingAsset.model || ''}
                          onChange={e => setEditingAsset({ ...editingAsset, model: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Department</label>
                    <Select
                      value={editingAsset.department || ''}
                      onValueChange={v => setEditingAsset({ ...editingAsset, department: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dep => (
                          <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Warranty Start</label>
                      <Input
                        type="date"
                        value={editingAsset.warrantyStart || ''}
                        onChange={e => setEditingAsset({ ...editingAsset, warrantyStart: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Warranty End</label>
                      <Input
                        type="date"
                        value={editingAsset.warrantyEnd || ''}
                        onChange={e => setEditingAsset({ ...editingAsset, warrantyEnd: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Warranty Vendor</label>
                    <Select
                      value={editingAsset.warrantyVendor || '__none__'}
                      onValueChange={v => setEditingAsset({ ...editingAsset, warrantyVendor: v === '__none__' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select warranty vendor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {vendors.map(vendor => (
                          <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      {isLaptopCategory(editingAsset.category) ? 'System Configuration' : 'Notes (Optional)'}
                    </label>
                    <Textarea
                      placeholder={isLaptopCategory(editingAsset.category) ? "e.g. Core i7, 16GB RAM, 512GB SSD" : "Any extra details..."}
                      value={editingAsset.configuration || ''}
                      onChange={e => setEditingAsset({ ...editingAsset, configuration: e.target.value })}
                      className="min-h-[80px]"
                    />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full">Update Asset</Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Assets</TabsTrigger>
              {categories.map(cat => (
                <TabsTrigger key={cat.value} value={cat.value}>
                  {cat.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="department">Departments</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[180px]">Company</TableHead>
                        <TableHead className="w-[220px]">Model</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Warranty End</TableHead>
                        <TableHead>Asset ID</TableHead>
                        <TableHead>Serial No.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {loading ? (
                      [1, 2, 3, 4, 5].map(i => (
                        <TableRow key={i}>
                          <TableCell colSpan={10}><div className="h-12 bg-muted/50 animate-pulse rounded-lg" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Package className="w-8 h-8 opacity-20" />
                            <p>No assets found.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((asset) => (
                        <TableRow key={asset.id} className="hover:bg-muted/20 transition-colors" data-testid={`asset-row-${asset.id}`}>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                  {getCategoryIcon(asset.category)}
                                </div>
                                {asset.company || 'Other'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium">{asset.model || 'Other'}</span>
                                {asset.configuration && (
                                  <span className="text-[10px] text-primary/70 font-normal leading-tight mt-0.5 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 truncate max-w-[240px]">
                                    {asset.configuration}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          <TableCell className="capitalize text-sm text-muted-foreground">
                            {asset.category}
                          </TableCell>
                          <TableCell className="text-sm">
                            {asset.department || '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {asset.serialNumber}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {asset.deviceSerialNumber || '-'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(asset.status)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {asset.assignedToName || asset.assignedTo || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid={`asset-actions-${asset.id}`}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isAdmin && (
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const { location, configuration } = unpackLocation(asset.location)
                                      setEditingAsset({
                                        ...asset,
                                        displayLocation: location,
                                        configuration: configuration || asset.configuration,
                                        company: asset.company,
                                        model: asset.model,
                                        department: asset.department,
                                        warrantyStart: asset.warrantyStart,
                                        warrantyEnd: asset.warrantyEnd,
                                        warrantyVendor: asset.warrantyVendor
                                      })
                                      setIsEditOpen(true)
                                    }}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Details
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setHistoryAsset(asset)
                                    setIsHistoryOpen(true)
                                  }}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View History
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                    onClick={() => handleDeleteAsset(asset.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Asset
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {categories.map(cat => {
              const tabValue = String(cat.value)
              const tabIsLaptop = tabValue.toLowerCase().includes('laptop')
              const tabIsMobile = /(phone|mobile|barcode|scanner|handheld)/i.test(tabValue)
              const showFilters = tabIsLaptop || tabIsMobile
              return (
                <TabsContent key={cat.value} value={cat.value} className="space-y-4">
                  <div className={showFilters ? "grid grid-cols-1 md:grid-cols-4 gap-6" : undefined}>
                    {showFilters && (
                      <div className="md:col-span-1 space-y-6 bg-muted/20 p-4 rounded-2xl border border-border/50 h-fit">
                        {tabIsLaptop && (
                          <>
                            <div>
                              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Cpu className="w-4 h-4" /> Processor
                              </h3>
                              <div className="space-y-2">
                                {availableCpus.map(cpu => (
                                  <div key={cpu} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`cpu-${tabValue}-${cpu}`}
                                      checked={specFilters.cpu.includes(cpu)}
                                      onCheckedChange={() => toggleSpecFilter('cpu', cpu)}
                                    />
                                    <label htmlFor={`cpu-${tabValue}-${cpu}`} className="text-sm cursor-pointer">{cpu}</label>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4" /> RAM
                              </h3>
                              <div className="space-y-2">
                                {availableRams.map(ram => (
                                  <div key={ram} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`ram-${tabValue}-${ram}`}
                                      checked={specFilters.ram.includes(ram)}
                                      onCheckedChange={() => toggleSpecFilter('ram', ram)}
                                    />
                                    <label htmlFor={`ram-${tabValue}-${ram}`} className="text-sm cursor-pointer">{ram}</label>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Layout className="w-4 h-4" /> Storage
                              </h3>
                              <div className="space-y-2">
                                {availableStorages.map(st => (
                                  <div key={st} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`st-${tabValue}-${st}`}
                                      checked={specFilters.storage.includes(st)}
                                      onCheckedChange={() => toggleSpecFilter('storage', st)}
                                    />
                                    <label htmlFor={`st-${tabValue}-${st}`} className="text-sm cursor-pointer">{st}</label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Company
                          </h3>
                          <div className="space-y-2">
                            {availableCompanies.map(company => (
                              <div key={company} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`company-${tabValue}-${company}`}
                                  checked={deviceFilters.company.includes(company)}
                                  onCheckedChange={() => toggleDeviceFilter('company', company)}
                                />
                                <label htmlFor={`company-${tabValue}-${company}`} className="text-sm cursor-pointer">{company}</label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Model
                          </h3>
                          <div className="space-y-2">
                            {availableModels.map(model => (
                              <div key={model} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`model-${tabValue}-${model}`}
                                  checked={deviceFilters.model.includes(model)}
                                  onCheckedChange={() => toggleDeviceFilter('model', model)}
                                />
                                <label htmlFor={`model-${tabValue}-${model}`} className="text-sm cursor-pointer">{model}</label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {(specFilters.cpu.length > 0 || specFilters.ram.length > 0 || specFilters.storage.length > 0 || deviceFilters.company.length > 0 || deviceFilters.model.length > 0) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              setSpecFilters({ cpu: [], ram: [], storage: [] })
                              setDeviceFilters({ company: [], model: [] })
                            }}
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    )}

                    <div className={showFilters ? "md:col-span-3 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden" : "bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"}>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[180px]">Company</TableHead>
                            <TableHead className="w-[220px]">Model</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Warranty End</TableHead>
                            <TableHead>Asset ID</TableHead>
                            <TableHead>Serial No.</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned To</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                              <TableRow key={i}>
                                <TableCell colSpan={10}><div className="h-12 bg-muted/50 animate-pulse rounded-lg" /></TableCell>
                              </TableRow>
                            ))
                          ) : filteredAssets.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center py-12">
                                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                  <Package className="w-8 h-8 opacity-20" />
                                  <p>No assets found.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredAssets.map((asset) => (
                              <TableRow key={asset.id} className="hover:bg-muted/20 transition-colors" data-testid={`asset-row-${asset.id}`}>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                  {getCategoryIcon(asset.category)}
                                </div>
                                {asset.company || 'Other'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium">{asset.model || 'Other'}</span>
                                {asset.configuration && (
                                  <span className="text-[10px] text-primary/70 font-normal leading-tight mt-0.5 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 truncate max-w-[240px]">
                                    {asset.configuration}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                                <TableCell className="capitalize text-sm text-muted-foreground">
                                  {asset.category}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {asset.department || '—'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString() : '—'}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {asset.serialNumber}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {asset.deviceSerialNumber || '-'}
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(asset.status)}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {asset.assignedToName || asset.assignedTo || '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid={`asset-actions-${asset.id}`}>
                                        <MoreVertical className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {isAdmin && (
                                        <DropdownMenuItem
                                          className="cursor-pointer"
                                          onClick={() => {
                                            const { location, configuration } = unpackLocation(asset.location)
                                          setEditingAsset({
                                            ...asset,
                                            displayLocation: location,
                                            configuration: configuration || asset.configuration,
                                            company: asset.company,
                                            model: asset.model,
                                            department: asset.department,
                                            warrantyStart: asset.warrantyStart,
                                            warrantyEnd: asset.warrantyEnd,
                                            warrantyVendor: asset.warrantyVendor
                                          })
                                            setIsEditOpen(true)
                                          }}
                                        >
                                          <Edit className="w-4 h-4 mr-2" />
                                          Edit Details
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={() => {
                                          setHistoryAsset(asset)
                                          setIsHistoryOpen(true)
                                        }}
                                      >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        View History
                                      </DropdownMenuItem>
                                      {isAdmin && (
                                        <DropdownMenuItem
                                          className="cursor-pointer text-destructive focus:text-destructive"
                                          onClick={() => handleDeleteAsset(asset.id)}
                                        >
                                          <Trash2 className="w-4 h-4 mr-2" />
                                          Delete Asset
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>
              )
            })}

            <TabsContent value="department" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 space-y-6 bg-muted/20 p-4 rounded-2xl border border-border/50 h-fit">
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Departments
                    </h3>
                    <div className="space-y-2">
                      {availableDepartments.map(dep => (
                        <div key={dep} className="flex items-center space-x-2">
                          <Checkbox
                            id={`dep-${dep}`}
                            checked={departmentFilters.includes(dep)}
                            onCheckedChange={() => toggleDepartmentFilter(dep)}
                          />
                          <label htmlFor={`dep-${dep}`} className="text-sm cursor-pointer">{dep}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  {departmentFilters.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setDepartmentFilters([])}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>

                <div className="md:col-span-3 bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[180px]">Company</TableHead>
                        <TableHead className="w-[220px]">Model</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Warranty End</TableHead>
                        <TableHead>Asset ID</TableHead>
                        <TableHead>Serial No.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [1, 2, 3, 4, 5].map(i => (
                          <TableRow key={i}>
                            <TableCell colSpan={10}><div className="h-12 bg-muted/50 animate-pulse rounded-lg" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredAssets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Package className="w-8 h-8 opacity-20" />
                              <p>No assets found.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAssets.map((asset) => (
                          <TableRow key={asset.id} className="hover:bg-muted/20 transition-colors" data-testid={`asset-row-${asset.id}`}>
                            <TableCell className="font-semibold">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                  {getCategoryIcon(asset.category)}
                                </div>
                                {asset.company || 'Other'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium">{asset.model || 'Other'}</span>
                                {asset.configuration && (
                                  <span className="text-[10px] text-primary/70 font-normal leading-tight mt-0.5 bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 truncate max-w-[240px]">
                                    {asset.configuration}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize text-sm text-muted-foreground">
                              {asset.category}
                            </TableCell>
                            <TableCell className="text-sm">
                              {asset.department || '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString() : '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {asset.serialNumber}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {asset.deviceSerialNumber || '-'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(asset.status)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {asset.assignedToName || asset.assignedTo || '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid={`asset-actions-${asset.id}`}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const { location, configuration } = unpackLocation(asset.location)
                                      setEditingAsset({
                                        ...asset,
                                        displayLocation: location,
                                        configuration: configuration || asset.configuration,
                                        company: asset.company,
                                        model: asset.model,
                                        department: asset.department,
                                        warrantyStart: asset.warrantyStart,
                                        warrantyEnd: asset.warrantyEnd,
                                        warrantyVendor: asset.warrantyVendor
                                      })
                                        setIsEditOpen(true)
                                      }}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit Details
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => {
                                      setHistoryAsset(asset)
                                      setIsHistoryOpen(true)
                                    }}
                                  >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    View History
                                  </DropdownMenuItem>
                                  {isAdmin && (
                                    <DropdownMenuItem
                                      className="cursor-pointer text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteAsset(asset.id)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete Asset
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            
          </Tabs>

          {/* History Dialog */}
          <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Asset History - {historyAsset?.name}</DialogTitle>
              </DialogHeader>
              {historyAsset && (
                <AssetHistory
                  assetId={historyAsset.id}
                  assetName={historyAsset.name}
                  serialNumber={historyAsset.serialNumber}
                />
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={isImportMapOpen} onOpenChange={setIsImportMapOpen}>
            <DialogContent className="sm:max-w-[520px]" data-testid="asset-import-map-dialog">
              <DialogHeader>
                <DialogTitle>Map Excel Columns</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs text-muted-foreground">
                  Map your Excel columns to asset fields. Only Asset Model is required.
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {([
                    ['model', 'Asset Model (Required)'],
                    ['assetId', 'Asset ID'],
                    ['company', 'Company'],
                    ['department', 'Department'],
                    ['category', 'Category'],
                    ['processor', 'Processor'],
                    ['ram', 'RAM'],
                    ['hdd', 'Storage/HDD'],
                    ['serviceTag', 'Serial Number'],
                    ['warrantyStart', 'Warranty Start'],
                    ['warrantyEnd', 'Warranty End'],
                    ['warrantyVendor', 'Warranty Vendor'],
                    ['location', 'Location'],
                    ['configuration', 'Configuration']
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium">{label}</label>
                      <Select
                        value={importMapping[key] || '__none__'}
                        onValueChange={v => setImportMapping(prev => ({ ...prev, [key]: v === '__none__' ? '' : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">(None)</SelectItem>
                          {importHeaders.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <DialogFooter className="pt-2">
                  <Button variant="outline" onClick={() => setIsImportMapOpen(false)}>Cancel</Button>
                  <Button onClick={handleMappedImport} data-testid="asset-import-confirm">Import</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
    </div>
  );
}


