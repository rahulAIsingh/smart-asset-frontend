import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectAnyRowContains, expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Assets CRUD', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/assets')
  })

  test('@smoke create, edit and delete asset', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Asset' }).click()

    await page.getByPlaceholder('e.g. Zebra, Honeywell, Dell').fill('Dell')
    await page.getByPlaceholder('e.g. TC52, EDA51, Latitude 7420').fill('E2E New Model')
    await page.getByPlaceholder('Enter device serial number').fill('E2E-SERIAL-NEW-001')
    await page.getByRole('button', { name: 'Save Asset' }).click()
    await expectToast(page, 'Asset added successfully')
    await expectAnyRowContains(page, 'E2E New Model')

    const newRow = page.locator('tbody tr').filter({ hasText: 'E2E New Model' }).first()
    await newRow.locator('button').first().click()
    await page.getByRole('menuitem', { name: 'Edit Details' }).click()

    const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Asset Details' })
    await expect(editDialog).toBeVisible()
    await editDialog.getByPlaceholder('e.g. TC52, EDA51, Latitude 7420').fill('E2E Updated Model')
    await editDialog.getByRole('button', { name: 'Update Asset' }).click()
    await expectToast(page, 'Asset updated successfully')
    await expectAnyRowContains(page, 'E2E Updated Model')

    const updatedRow = page.locator('tbody tr').filter({ hasText: 'E2E Updated Model' }).first()
    await updatedRow.locator('[data-testid^="asset-actions-"]').click()
    page.once('dialog', async dialog => dialog.accept())
    await page.getByRole('menuitem', { name: 'Delete Asset' }).click()
    await expectToast(page, 'Asset deleted')
    await expect(page.locator('tbody tr').filter({ hasText: 'E2E Updated Model' })).toHaveCount(0)
  })
})
