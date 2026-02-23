import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { resetSeed } from './helpers/reset'

test.describe('Dashboard Smoke', () => {
  test('@smoke dashboard renders key widgets', async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/')

    await expect(page.getByTestId('dashboard-open-tickets-card')).toBeVisible()
    await expect(page.getByTestId('dashboard-recent-issuance-activity')).toBeVisible()
    await expect(page.getByTestId('dashboard-assets-needing-attention')).toBeVisible()
  })
})
