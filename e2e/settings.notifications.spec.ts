import { test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Settings Notifications', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/settings')
  })

  test('smtp test endpoint works with null mail provider in testing', async ({ page }) => {
    await page.getByPlaceholder('recipient@company.com').fill('qa@demo.com')
    await page.getByRole('button', { name: 'Send Test Email' }).click()
    await expectToast(page, 'Test email sent successfully')
  })
})
