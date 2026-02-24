import { SUPPORTED_ONBOARDING_ROLES, type FtuxProgressV1, type OnboardingRole } from './types'

export const FTUX_PROGRESS_STORAGE_KEY = 'sam_ftux_progress_v1'

const createEmptyProgress = (): FtuxProgressV1 => ({
  version: 1,
  completedByRole: {},
  dismissedByRole: {}
})

const readRoleMap = (value: unknown): Partial<Record<OnboardingRole, string>> => {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  const next: Partial<Record<OnboardingRole, string>> = {}
  for (const role of SUPPORTED_ONBOARDING_ROLES) {
    const timestamp = record[role]
    if (typeof timestamp === 'string' && timestamp.trim()) {
      next[role] = timestamp
    }
  }
  return next
}

export const readFtuxProgress = (): FtuxProgressV1 => {
  try {
    const raw = localStorage.getItem(FTUX_PROGRESS_STORAGE_KEY)
    if (!raw) return createEmptyProgress()
    const parsed = JSON.parse(raw) as Partial<FtuxProgressV1>
    if (parsed?.version !== 1) return createEmptyProgress()
    return {
      version: 1,
      completedByRole: readRoleMap(parsed.completedByRole),
      dismissedByRole: readRoleMap(parsed.dismissedByRole)
    }
  } catch {
    return createEmptyProgress()
  }
}

export const writeFtuxProgress = (progress: FtuxProgressV1) => {
  localStorage.setItem(FTUX_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

export const canAutoStartForRole = (role: OnboardingRole): boolean => {
  const progress = readFtuxProgress()
  return !progress.completedByRole[role] && !progress.dismissedByRole[role]
}

export const markRoleCompleted = (role: OnboardingRole) => {
  const progress = readFtuxProgress()
  progress.completedByRole[role] = new Date().toISOString()
  writeFtuxProgress(progress)
}

export const markRoleDismissed = (role: OnboardingRole) => {
  const progress = readFtuxProgress()
  progress.dismissedByRole[role] = new Date().toISOString()
  writeFtuxProgress(progress)
}
