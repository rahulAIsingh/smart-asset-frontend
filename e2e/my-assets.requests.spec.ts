import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectToast, fillPromptOnce } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('My Assets Requests', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'user', '/my-requests')
  })

  test('submit request, return request, and report issue', async ({ page }) => {
    await page.getByRole('combobox').filter({ hasText: 'Request category' }).click()
    await page.getByRole('option', { name: 'Hardware Device' }).click()
    await page.getByPlaceholder('Department').fill('Finance')
    await page.getByPlaceholder('Location').fill('Main Office')
    await page.getByPlaceholder('Business justification').fill('Need a new laptop for onboarding workload.')

    await page.getByText('Approvers').click()
    const approversSection = page.locator('details').filter({ hasText: 'Approvers' })
    await approversSection.getByRole('combobox').first().click()
    await page.getByRole('option', { name: /pm@demo\.com/ }).first().click()

    const configurationSection = page.locator('details').filter({ hasText: 'Configuration' }).first()
    await configurationSection.locator('summary').click()
    await configurationSection
      .getByPlaceholder('JSON or text config (CPU, RAM, Storage, OS, software, accessories, quantity, required-by-date)')
      .fill('CPU: i7, RAM: 16GB, SSD: 512GB')

    await page.getByRole('button', { name: 'Submit Request' }).click()
    await expectToast(page, 'Request submitted and sent for PM approval')

    await page.goto('/my-assets')
    await fillPromptOnce(page, 'Returning after project completion')
    await page.getByRole('button', { name: 'Return' }).first().click()
    await expectToast(page, 'Return request')

    await page.getByRole('button', { name: 'Report Issue' }).first().click()
    const reportDialog = page.getByRole('dialog').filter({ hasText: 'Report Issue' })
    await expect(reportDialog).toBeVisible()
    await reportDialog.getByText('Battery/Power').click()
    await reportDialog.getByPlaceholder('Please describe the issue in detail...').fill('Battery drains in less than one hour.')
    await reportDialog.getByRole('button', { name: 'Submit Ticket' }).click()
    await expectToast(page, 'Ticket created successfully')
  })
})
