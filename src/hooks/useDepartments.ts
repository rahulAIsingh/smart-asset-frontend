import { useEffect, useMemo, useState } from 'react'
import { dataClient } from '../lib/dataClient'
import { toast } from 'sonner'

const STORAGE_KEY = 'sam_departments'
const DEFAULT_DEPARTMENTS = [
  'IT',
  'Software',
  'Maintenance',
  'Accounts',
  'HR',
  'Director'
]

const normalize = (value: string) => value.trim()

export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([])
  const [dbUnavailable, setDbUnavailable] = useState(false)

  useEffect(() => {
    void loadDepartments()
  }, [])

  const getStoredDepartments = () => {
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
    return DEFAULT_DEPARTMENTS
  }

  const setStoredDepartments = (next: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const loadDepartments = async () => {
    const local = getStoredDepartments()
    setDepartments(local)
    setStoredDepartments(local)

    try {
      const rows = await dataClient.db.departments.list({ orderBy: { name: 'asc' } }) as Array<{ name?: string }>
      const names = rows.map(r => normalize(String(r.name || ''))).filter(Boolean)
      const next = names.length > 0 ? names : local
      setDepartments(next)
      setStoredDepartments(next)
      setDbUnavailable(false)
    } catch {
      setDbUnavailable(true)
    }
  }

  const addDepartment = (name: string) => {
    const nextName = normalize(name)
    if (!nextName) {
      toast.error('Please enter department name')
      return
    }
    setDepartments(prev => {
      const exists = prev.some(d => d.toLowerCase() === nextName.toLowerCase())
      if (exists) {
        toast.error('Department already exists')
      } else {
        toast.success('Department added')
      }
      const next = exists ? prev : [...prev, nextName]
      setStoredDepartments(next)
      if (!exists && !dbUnavailable) {
        dataClient.db.departments.create({ name: nextName }).catch(() => setDbUnavailable(true))
      }
      return next
    })
  }

  const removeDepartment = (name: string) => {
    setDepartments(prev => {
      const next = prev.filter(d => d !== name)
      setStoredDepartments(next)
      if (next.length !== prev.length) {
        toast.success('Department removed')
      }
      if (next.length !== prev.length && !dbUnavailable) {
        dataClient.db.departments.list({ where: { name }, limit: 1 })
          .then((rows: Array<{ id: string }>) => {
            if (rows[0]?.id) return dataClient.db.departments.delete(rows[0].id)
          })
          .catch(() => setDbUnavailable(true))
      }
      return next
    })
  }

  const sorted = useMemo(() => [...departments].sort((a, b) => a.localeCompare(b)), [departments])

  return { departments: sorted, addDepartment, removeDepartment }
}

