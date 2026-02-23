import { expect, test } from './helpers/e2eTest'
import { userToAdd } from './fixtures/test-data'
import { loginAs } from './helpers/auth'
import { expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Users Management', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/users')
  })

  test('add user, update role, and delete user', async ({ page }) => {
    await page.getByLabel('Name').fill(userToAdd.name)
    await page.getByLabel('Email').fill(userToAdd.email)
    await page.getByRole('button', { name: 'Add User' }).click()
    await expectToast(page, 'User added')
    await expect(page.locator('tbody tr').filter({ hasText: userToAdd.email })).toBeVisible()

    const row = page.locator('tbody tr').filter({ hasText: userToAdd.email }).first()
    await row.getByRole('button', { name: 'Edit Role' }).click()
    page.once('dialog', async dialog => dialog.accept())
    await page.getByRole('menuitem', { name: 'Set as Support' }).click()
    await expectToast(page, 'Role updated')

    page.once('dialog', async dialog => dialog.accept())
    await row.getByRole('button', { name: 'Edit Role' }).click()
    await page.getByRole('menuitem', { name: 'Delete User' }).click()
    await expectToast(page, 'User deleted')
  })
})
