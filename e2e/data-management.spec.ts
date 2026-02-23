import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { resetSeed } from './helpers/reset'

test.describe('Data Management', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/data-management')
  })

  test('manage categories, departments and vendors', async ({ page }) => {
    await page.getByPlaceholder('Category Name (e.g. Projector)').fill('E2E Category')
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByTestId('data-management-categories-list').getByText('E2E Category', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Departments' }).click()
    await page.getByPlaceholder('Department Name (e.g. Operations)').fill('E2E Department')
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByTestId('data-management-departments-list').getByText('E2E Department', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Vendors' }).click()
    const vendorsTab = page.getByTestId('data-management-vendors-tab')
    await page.getByPlaceholder('Vendor Name (e.g. Lenovo)').fill('E2E Vendor')
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByTestId('data-management-vendors-list').getByText('E2E Vendor', { exact: true })).toBeVisible()

    await vendorsTab.getByRole('combobox').first().click()
    await page.getByRole('option', { name: 'E2E Vendor' }).click()
    await vendorsTab.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByTestId('data-management-vendors-list').getByText('E2E Vendor', { exact: true })).toHaveCount(0)
  })
})
