import { useEffect, useMemo, useState } from 'react'
import { dataClient } from '../lib/dataClient'
import { toast } from 'sonner'

const STORAGE_KEY = 'sam_vendors'
const DEFAULT_VENDORS = [
  'Dell',
  'HP',
  'Lenovo',
  'Apple',
  'Samsung',
  'Zebra',
  'Honeywell'
]

const normalize = (value: string) => value.trim()

export function useVendors() {
  const [vendors, setVendors] = useState<string[]>([])
  const [dbUnavailable, setDbUnavailable] = useState(false)

  useEffect(() => {
    void loadVendors()
  }, [])

  const getStoredVendors = () => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as string[]
        }
      } catch {
        // fall through to defaults
      }
    }
    return DEFAULT_VENDORS
  }

  const setStoredVendors = (next: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const loadVendors = async () => {
    const local = getStoredVendors()
    setVendors(local)
    setStoredVendors(local)

    try {
      const rows = await dataClient.db.vendors.list({ orderBy: { name: 'asc' } }) as Array<{ name?: string }>
      const names = rows.map(r => normalize(String(r.name || ''))).filter(Boolean)
      const next = names.length > 0 ? names : local
      setVendors(next)
      setStoredVendors(next)
      setDbUnavailable(false)
    } catch {
      setDbUnavailable(true)
    }
  }

  const addVendor = (name: string) => {
    const nextName = normalize(name)
    if (!nextName) {
      toast.error('Please enter vendor name')
      return
    }
    setVendors(prev => {
      const exists = prev.some(v => v.toLowerCase() === nextName.toLowerCase())
      if (exists) {
        toast.error('Vendor already exists')
      } else {
        toast.success('Vendor added')
      }
      const next = exists ? prev : [...prev, nextName]
      setStoredVendors(next)
      if (!exists && !dbUnavailable) {
        dataClient.db.vendors.create({ name: nextName }).catch(() => setDbUnavailable(true))
      }
      return next
    })
  }

  const removeVendor = (name: string) => {
    setVendors(prev => {
      const next = prev.filter(v => v !== name)
      setStoredVendors(next)
      if (next.length !== prev.length) {
        toast.success('Vendor removed')
      }
      if (next.length !== prev.length && !dbUnavailable) {
        dataClient.db.vendors.list({ where: { name }, limit: 1 })
          .then((rows: Array<{ id: string }>) => {
            if (rows[0]?.id) return dataClient.db.vendors.delete(rows[0].id)
          })
          .catch(() => setDbUnavailable(true))
      }
      return next
    })
  }

  const sorted = useMemo(() => [...vendors].sort((a, b) => a.localeCompare(b)), [vendors])

  return { vendors: sorted, addVendor, removeVendor }
}

