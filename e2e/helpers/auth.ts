import { expect, type Page } from '@playwright/test'

export type E2eRole = 'admin' | 'support' | 'pm' | 'boss' | 'user'

export const roleEmail: Record<E2eRole, string> = {
  admin: 'admin@demo.com',
  support: 'support@demo.com',
  pm: 'pm@demo.com',
  boss: 'boss@demo.com',
  user: 'user@demo.com',
}

export const tokenFor = (role: E2eRole) => `e2e::${roleEmail[role]}::${role}`

export const primeAuth = async (page: Page, role: E2eRole) => {
  const email = roleEmail[role]
  const token = tokenFor(role)

  await page.addInitScript(
    ({ nextEmail, nextRole, nextToken }) => {
      const seededKey = 'sam_e2e_auth_seeded'
      localStorage.removeItem('sam_dev_user')
      localStorage.setItem('sam_access_token', nextToken)
      localStorage.setItem('sam_user_role', nextRole)
      localStorage.setItem('sam_auth_email_hint', nextEmail)
      localStorage.removeItem('sam_auth_last_error')
      if (!sessionStorage.getItem(seededKey)) {
        localStorage.removeItem('sam_ftux_progress_v1')
        sessionStorage.setItem(seededKey, '1')
      }
    },
    { nextEmail: email, nextRole: role, nextToken: token }
  )
}

export const loginAs = async (page: Page, role: E2eRole, path = '/') => {
  await primeAuth(page, role)
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
  await expect(page).not.toHaveURL(/\/login$/)
}
