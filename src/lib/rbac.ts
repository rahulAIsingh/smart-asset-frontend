export type UserRole = 'admin' | 'user' | 'support' | 'pm' | 'boss'

export type AppPermission =
  | 'dashboard:view'
  | 'my_assets:view'
  | 'assets:view'
  | 'issuance:manage'
  | 'tickets:view'
  | 'approvals:view'
  | 'users:manage'
  | 'data:manage'
  | 'stock:manage'
  | 'finance:view'
  | 'settings:view'

export const USER_ROLES: UserRole[] = ['admin', 'support', 'pm', 'boss', 'user']

export const ROLE_META: Record<UserRole, { label: string; badgeClass: string }> = {
  admin: { label: 'IT Admin', badgeClass: 'bg-purple-600 text-white hover:bg-purple-700' },
  support: { label: 'Support', badgeClass: 'bg-cyan-600 text-white hover:bg-cyan-700' },
  pm: { label: 'PM', badgeClass: 'bg-amber-600 text-white hover:bg-amber-700' },
  boss: { label: 'Boss', badgeClass: 'bg-slate-700 text-white hover:bg-slate-800' },
  user: { label: 'User', badgeClass: 'bg-muted text-foreground hover:bg-muted/80' }
}

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  admin: [
    'dashboard:view',
    'my_assets:view',
    'assets:view',
    'issuance:manage',
    'tickets:view',
    'approvals:view',
    'users:manage',
    'data:manage',
    'stock:manage',
    'finance:view',
    'settings:view'
  ],
  support: [
    'dashboard:view',
    'my_assets:view',
    'tickets:view'
  ],
  pm: [
    'dashboard:view',
    'my_assets:view',
    'tickets:view',
    'approvals:view',
    'settings:view'
  ],
  boss: [
    'dashboard:view',
    'my_assets:view',
    'approvals:view',
    'settings:view'
  ],
  user: [
    'my_assets:view',
    'tickets:view'
  ]
}

export const normalizeRole = (value: unknown): UserRole => {
  const v = String(value || '').toLowerCase()
  return USER_ROLES.includes(v as UserRole) ? (v as UserRole) : 'user'
}

export const hasPermission = (role: UserRole | null | undefined, permission: AppPermission): boolean => {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) || false
}
