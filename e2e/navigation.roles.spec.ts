import { expect, test } from './helpers/e2eTest'
import { navExpectations } from './fixtures/test-data'
import { loginAs, type E2eRole } from './helpers/auth'
import { expectOnPath } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Navigation and Role Gating', () => {
  test.beforeEach(async ({ request }) => {
    await resetSeed(request)
  })

  ;(['admin', 'support', 'pm', 'boss', 'user'] as E2eRole[]).forEach(role => {
    test(`sidebar visibility for ${role}`, async ({ page }) => {
      await loginAs(page, role)

      for (const item of navExpectations[role]) {
        await expect(page.getByRole('link', { name: item, exact: true })).toBeVisible()
      }
    })
  })

  test('@smoke restricted route redirects user role', async ({ page }) => {
    await loginAs(page, 'user', '/users')
    await expect(page).not.toHaveURL(/\/users$/)
    await expectOnPath(page, '/my-assets')
  })
})
