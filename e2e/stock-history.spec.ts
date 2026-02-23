import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Stock History', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/stock')
  })

  test('@smoke stock in and stock out flows', async ({ page }) => {
    await page.getByRole('button', { name: 'Stock IN' }).click()
    const inDialog = page.getByRole('dialog').filter({ hasText: 'Create Stock IN' })
    await expect(inDialog).toBeVisible()
    await inDialog.getByPlaceholder('Item Name').fill('E2E Test Item')
    await inDialog.getByPlaceholder('Location').fill('Main Office')
    await inDialog.getByPlaceholder('Reference Number').fill('E2E-REF-1')
    await inDialog.getByRole('button', { name: 'Save Stock IN' }).click()
    await expectToast(page, 'Stock IN saved')

    await page.getByRole('button', { name: 'Stock OUT' }).click()
    const outDialog = page.getByRole('dialog').filter({ hasText: 'Create Stock OUT' })
    await expect(outDialog).toBeVisible()
    await outDialog.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /E2E Test Item/ }).first().click()
    await outDialog.getByPlaceholder('Reason').fill('Issued for testing')
    await outDialog.getByRole('button', { name: 'Save Stock OUT' }).click()
    await expectToast(page, 'Stock OUT saved')
  })

  test('approve seeded pending request and export', async ({ page }) => {
    await page.getByTestId('stock-filter-from-date').fill('2026-01-01')
    await page.getByTestId('stock-filter-to-date').fill('2026-12-31')
    await expect(page.getByTestId('stock-pending-approvals')).toBeVisible()
    await page.locator('[data-testid^="stock-approve-"]').first().click()
    await expectToast(page, 'Request approved')

    await page.getByRole('button', { name: 'Export CSV' }).click()
    await page.getByRole('button', { name: 'Export Excel' }).click()
  })
})
