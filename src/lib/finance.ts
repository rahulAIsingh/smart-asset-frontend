import { blink } from './blink'

export type DepMethod = 'straight_line'
export type SalvageType = 'percent' | 'fixed'
export type DepFrequency = 'monthly'

export type FinanceProfile = {
  id: string
  category: string
  method: DepMethod
  usefulLifeMonths: number
  salvageType: SalvageType
  salvageValue: number
  frequency: DepFrequency
  expenseGl?: string
  accumDepGl?: string
  active: boolean
  createdBy: string
  createdDate: string
  updatedBy?: string
  updatedDate?: string
}

export type FinanceAssetOverride = {
  id: string
  assetId: string
  method: DepMethod
  usefulLifeMonths: number
  salvageType: SalvageType
  salvageValue: number
  effectiveFrom: string
  createdBy: string
  createdDate: string
}

type DbRow = Record<string, unknown>

const PROFILES_KEY = 'sam_finance_profiles'
const OVERRIDES_KEY = 'sam_finance_asset_overrides'
let attemptedSchemaBootstrap = false
export const DEFAULT_FINANCE_POLICY = {
  method: 'straight_line' as DepMethod,
  usefulLifeMonths: 36,
  salvageType: 'percent' as SalvageType,
  salvageValue: 10,
  frequency: 'monthly' as DepFrequency,
}

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toString = (value: unknown, fallback = '') => {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  return String(value)
}

const toBool = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return fallback
}

const nowIso = () => new Date().toISOString()

const makeId = (prefix: string) => {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${randomPart}`
}

const normalizeProfile = (row: DbRow): FinanceProfile => ({
  id: toString(row.id, makeId('fp')),
  category: toString(row.category).trim().toLowerCase(),
  method: 'straight_line',
  usefulLifeMonths: Math.max(1, Math.round(toNumber(row.usefulLifeMonths, DEFAULT_FINANCE_POLICY.usefulLifeMonths))),
  salvageType: toString(row.salvageType, DEFAULT_FINANCE_POLICY.salvageType) === 'fixed' ? 'fixed' : 'percent',
  salvageValue: Math.max(0, toNumber(row.salvageValue, DEFAULT_FINANCE_POLICY.salvageValue)),
  frequency: 'monthly',
  expenseGl: toString(row.expenseGl),
  accumDepGl: toString(row.accumDepGl),
  active: toBool(row.active, true),
  createdBy: toString(row.createdBy, 'system'),
  createdDate: toString(row.createdDate, nowIso()),
  updatedBy: toString(row.updatedBy),
  updatedDate: toString(row.updatedDate),
})

const normalizeOverride = (row: DbRow): FinanceAssetOverride => ({
  id: toString(row.id, makeId('fo')),
  assetId: toString(row.assetId),
  method: 'straight_line',
  usefulLifeMonths: Math.max(1, Math.round(toNumber(row.usefulLifeMonths, DEFAULT_FINANCE_POLICY.usefulLifeMonths))),
  salvageType: toString(row.salvageType, DEFAULT_FINANCE_POLICY.salvageType) === 'fixed' ? 'fixed' : 'percent',
  salvageValue: Math.max(0, toNumber(row.salvageValue, DEFAULT_FINANCE_POLICY.salvageValue)),
  effectiveFrom: toString(row.effectiveFrom, new Date().toISOString().slice(0, 10)),
  createdBy: toString(row.createdBy, 'system'),
  createdDate: toString(row.createdDate, nowIso()),
})

const readLocalProfiles = (): FinanceProfile[] => {
  try {
    const raw = localStorage.getItem(PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(p => normalizeProfile(p as DbRow))
  } catch {
    return []
  }
}

const writeLocalProfiles = (rows: FinanceProfile[]) => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(rows))
}

const readLocalOverrides = (): FinanceAssetOverride[] => {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(p => normalizeOverride(p as DbRow))
  } catch {
    return []
  }
}

const writeLocalOverrides = (rows: FinanceAssetOverride[]) => {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(rows))
}

export const moneyInr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0)

const FINANCE_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS finance_profiles (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'straight_line',
    useful_life_months INTEGER NOT NULL DEFAULT 36,
    salvage_type TEXT NOT NULL DEFAULT 'percent',
    salvage_value REAL NOT NULL DEFAULT 10,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    expense_gl TEXT,
    accum_dep_gl TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_date TEXT NOT NULL,
    updated_by TEXT,
    updated_date TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_profiles_category ON finance_profiles(category)`,
  `CREATE TABLE IF NOT EXISTS finance_asset_overrides (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'straight_line',
    useful_life_months INTEGER NOT NULL DEFAULT 36,
    salvage_type TEXT NOT NULL DEFAULT 'percent',
    salvage_value REAL NOT NULL DEFAULT 10,
    effective_from TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_date TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_asset_overrides_asset_id ON finance_asset_overrides(asset_id)`,
]

const tryEnsureFinanceSchema = async () => {
  if (attemptedSchemaBootstrap) return false
  attemptedSchemaBootstrap = true
  try {
    await blink.db.batch(FINANCE_SCHEMA_SQL.map(sql => ({ sql })), 'write')
    return true
  } catch {
    return false
  }
}

export const getFallbackProfile = (category: string): FinanceProfile => ({
  id: `fallback_${category || 'default'}`,
  category: (category || '').trim().toLowerCase(),
  method: DEFAULT_FINANCE_POLICY.method,
  usefulLifeMonths: DEFAULT_FINANCE_POLICY.usefulLifeMonths,
  salvageType: DEFAULT_FINANCE_POLICY.salvageType,
  salvageValue: DEFAULT_FINANCE_POLICY.salvageValue,
  frequency: DEFAULT_FINANCE_POLICY.frequency,
  active: true,
  createdBy: 'system',
  createdDate: nowIso(),
})

export const resolveProfileForCategory = (category: string, profiles: FinanceProfile[]) => {
  const key = (category || '').trim().toLowerCase()
  const match = profiles.find(p => p.active && p.category === key)
  if (match) return { profile: match, usingFallback: false }
  return { profile: getFallbackProfile(key), usingFallback: true }
}

export const calcDepreciation = (input: {
  cost: number
  usefulLifeMonths: number
  salvageType: SalvageType
  salvageValue: number
  monthsElapsed: number
}) => {
  const cost = Math.max(0, input.cost)
  const usefulLifeMonths = Math.max(1, Math.round(input.usefulLifeMonths))
  const monthsElapsed = Math.max(0, Math.round(input.monthsElapsed))
  const rawSalvage = input.salvageType === 'percent'
    ? (cost * Math.max(0, input.salvageValue)) / 100
    : Math.max(0, input.salvageValue)
  const salvageAmount = Math.min(cost, rawSalvage)
  const depreciableBase = Math.max(0, cost - salvageAmount)
  const monthlyDep = usefulLifeMonths > 0 ? depreciableBase / usefulLifeMonths : 0
  const depreciationTillNow = Math.min(depreciableBase, monthlyDep * monthsElapsed)
  const bookValue = Math.max(salvageAmount, cost - depreciationTillNow)
  return {
    cost,
    usefulLifeMonths,
    monthsElapsed,
    salvageAmount,
    depreciableBase,
    monthlyDep,
    yearlyDep: monthlyDep * 12,
    depreciationTillNow,
    bookValue,
  }
}

export const listFinanceProfiles = async () => {
  try {
    const rows = await blink.db.financeProfiles.list({ orderBy: { category: 'asc' } }) as DbRow[]
    const normalized = rows.map(normalizeProfile)
    writeLocalProfiles(normalized)
    return { rows: normalized, source: 'db' as const }
  } catch {
    const ensured = await tryEnsureFinanceSchema()
    if (ensured) {
      try {
        const rows = await blink.db.financeProfiles.list({ orderBy: { category: 'asc' } }) as DbRow[]
        const normalized = rows.map(normalizeProfile)
        writeLocalProfiles(normalized)
        return { rows: normalized, source: 'db' as const }
      } catch {
        // fallback below
      }
    }
    return { rows: readLocalProfiles(), source: 'local' as const }
  }
}

export const upsertFinanceProfile = async (
  input: Omit<FinanceProfile, 'id' | 'createdDate' | 'createdBy' | 'updatedBy' | 'updatedDate'> & { id?: string },
  actor: string
) => {
  const now = nowIso()
  const normalizedCategory = input.category.trim().toLowerCase()
  const existingLocal = readLocalProfiles()
  const byCategory = existingLocal.find(p => p.category === normalizedCategory)
  const payload: FinanceProfile = normalizeProfile({
    id: input.id || byCategory?.id || makeId('fp'),
    ...input,
    category: normalizedCategory,
    method: 'straight_line',
    frequency: 'monthly',
    createdBy: byCategory?.createdBy || actor,
    createdDate: byCategory?.createdDate || now,
    updatedBy: actor,
    updatedDate: now,
  })

  try {
    const { rows } = await listFinanceProfiles()
    const existing = rows.find(r => r.category === normalizedCategory)
    if (existing?.id) {
      await blink.db.financeProfiles.update(existing.id, {
        ...payload,
        id: undefined,
      })
      return { row: { ...payload, id: existing.id }, source: 'db' as const }
    }
    const created = await blink.db.financeProfiles.create(payload) as DbRow
    const row = normalizeProfile(created)
    return { row, source: 'db' as const }
  } catch {
    const next = byCategory
      ? existingLocal.map(p => (p.id === byCategory.id ? payload : p))
      : [...existingLocal, payload]
    writeLocalProfiles(next)
    return { row: payload, source: 'local' as const }
  }
}

export const deactivateFinanceProfile = async (id: string, actor: string) => {
  const now = nowIso()
  try {
    await blink.db.financeProfiles.update(id, { active: false, updatedBy: actor, updatedDate: now })
    return { source: 'db' as const }
  } catch {
    const existing = readLocalProfiles()
    const next = existing.map(p => (p.id === id ? { ...p, active: false, updatedBy: actor, updatedDate: now } : p))
    writeLocalProfiles(next)
    return { source: 'local' as const }
  }
}

export const listFinanceAssetOverrides = async () => {
  try {
    const rows = await blink.db.financeAssetOverrides.list({ orderBy: { createdDate: 'desc' } }) as DbRow[]
    const normalized = rows.map(normalizeOverride)
    writeLocalOverrides(normalized)
    return { rows: normalized, source: 'db' as const }
  } catch {
    const ensured = await tryEnsureFinanceSchema()
    if (ensured) {
      try {
        const rows = await blink.db.financeAssetOverrides.list({ orderBy: { createdDate: 'desc' } }) as DbRow[]
        const normalized = rows.map(normalizeOverride)
        writeLocalOverrides(normalized)
        return { rows: normalized, source: 'db' as const }
      } catch {
        // fallback below
      }
    }
    return { rows: readLocalOverrides(), source: 'local' as const }
  }
}

export const upsertFinanceAssetOverride = async (
  input: Omit<FinanceAssetOverride, 'id' | 'createdDate'> & { id?: string },
  actor: string
) => {
  const existing = readLocalOverrides()
  const byAsset = existing.find(v => v.assetId === input.assetId)
  const row = normalizeOverride({
    id: input.id || byAsset?.id || makeId('fo'),
    ...input,
    method: 'straight_line',
    createdBy: actor,
    createdDate: byAsset?.createdDate || nowIso(),
  })

  try {
    if (byAsset?.id) {
      await blink.db.financeAssetOverrides.update(byAsset.id, {
        ...row,
        id: undefined,
      })
      return { row: { ...row, id: byAsset.id }, source: 'db' as const }
    }
    const created = await blink.db.financeAssetOverrides.create(row) as DbRow
    return { row: normalizeOverride(created), source: 'db' as const }
  } catch {
    const next = byAsset
      ? existing.map(v => (v.id === byAsset.id ? row : v))
      : [...existing, row]
    writeLocalOverrides(next)
    return { row, source: 'local' as const }
  }
}
