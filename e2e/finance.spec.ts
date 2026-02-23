import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Finance Module', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/finance')
  })

  test('save profile, seed preview context and save override', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Profile' }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Create Profile' })
    await expect(dialog).toBeVisible()
    await dialog.locator('input[inputmode="numeric"]').first().fill('42')
    await dialog.getByRole('button', { name: 'Save Profile' }).click()
    await expectToast(page, 'Finance profile saved')

    await page.getByRole('button', { name: 'Use Latest Stock IN Context' }).click()
    await expectToast(page, 'Preview seeded from latest approved Stock IN')

    const overrideSection = page.getByTestId('finance-override-section')
    await overrideSection.getByTestId('finance-override-asset-select').click()
    await page.getByRole('option', { name: /E2E-LAP-002/ }).first().click()
    await overrideSection.getByRole('button', { name: 'Save Override' }).click()
    await expectToast(page, 'Asset override saved')
  })
})
