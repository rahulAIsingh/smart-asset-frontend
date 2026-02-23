import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectAnyRowContains, expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Issuance Lifecycle', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/issuance')
  })

  test('issue, return and delete issuance', async ({ page }) => {
    const seededRow = page.locator('tbody tr').filter({ hasText: 'user@demo.com' }).first()
    page.once('dialog', async dialog => dialog.accept())
    await seededRow.getByRole('button', { name: 'Mark Returned' }).click()
    await expectToast(page, 'Asset marked as returned')

    await expect(page.locator('tbody tr').filter({ hasText: 'user@demo.com' })).toHaveCount(0)

    await page.getByRole('button', { name: 'New Issuance' }).click()

    await page.getByRole('dialog').filter({ hasText: 'Issue New Asset' }).getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E-LAP-001/ }).first().click()

    await page.getByPlaceholder('e.g. John Doe').fill('E2E Employee')
    await page.getByPlaceholder('john.doe@company.com').fill('e2e.employee@demo.com')
    await page.getByRole('button', { name: 'Confirm Issuance' }).click()

    await expectToast(page, 'Asset issued')
    await expectAnyRowContains(page, 'e2e.employee@demo.com')

    const issuedRow = page.locator('tbody tr').filter({ hasText: 'e2e.employee@demo.com' }).first()
    page.once('dialog', async dialog => dialog.accept())
    await issuedRow.getByRole('button', { name: 'Delete' }).click()
    await expectToast(page, 'Issuance record deleted')
  })
})
