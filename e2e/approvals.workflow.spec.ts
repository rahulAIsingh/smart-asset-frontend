import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Approvals Workflow', () => {
  test('PM can approve pending PM request', async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'pm', '/approvals')

    const row = page.locator('div').filter({ hasText: 'REQ-2026-0001' }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /Approve/i }).click()
    await page.getByPlaceholder('Reason for this decision (mandatory)').fill('PM approval validated')
    await page.getByRole('button', { name: 'Submit Decision' }).click()
    await expectToast(page, 'Request approved')
  })

  test('Boss can reject pending boss request', async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'boss', '/approvals')

    const row = page.locator('div').filter({ hasText: 'REQ-2026-0002' }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /^Reject$/i }).first().click()
    await page.getByPlaceholder('Reason for this decision (mandatory)').fill('Budget not approved this cycle')
    await page.getByRole('button', { name: 'Submit Decision' }).click()
    await expectToast(page, 'Request rejected')
  })

  test('@smoke IT can fulfill pending IT request', async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/approvals')

    const row = page.locator('div').filter({ hasText: 'REQ-2026-0003' }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /Fulfill/i }).click()
    await page.getByPlaceholder('Reason for this decision (mandatory)').fill('Fulfilled from IT stock')
    await page.getByRole('button', { name: 'Submit Decision' }).click()
    await expectToast(page, 'Request fulfilled')
    await expect(page.getByText('REQ-2026-0003', { exact: false }).first()).toBeVisible()
  })
})
