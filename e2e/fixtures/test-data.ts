import type { E2eRole } from '../helpers/auth'

export const navExpectations: Record<E2eRole, string[]> = {
  admin: [
    'Dashboard',
    'My Assets',
    'All Assets',
    'Issuance',
    'Approvals',
    'Users',
    'Data Management',
    'Stock Transactions',
    'Finance',
    'Settings',
  ],
  support: ['Dashboard', 'My Assets', 'Tickets'],
  pm: ['Dashboard', 'My Assets', 'Tickets', 'Request Approvals', 'My Request History', 'Approvals', 'Settings'],
  boss: ['Dashboard', 'My Assets', 'Approvals', 'Settings'],
  user: ['My Assets', 'Tickets', 'Request Approvals', 'My Request History'],
}

export const seedAsset = {
  company: 'Dell',
  model: 'E2E New Model',
  department: 'IT',
  warrantyStart: '2026-01-01',
  warrantyEnd: '2028-01-01',
  warrantyVendor: 'Dell',
  configuration: 'CPU: i7 | RAM: 16GB | SSD: 512GB',
  location: 'Main Office',
  category: 'laptop',
}

export const userToAdd = {
  name: 'E2E Added User',
  email: 'e2e-added-user@demo.com',
}
