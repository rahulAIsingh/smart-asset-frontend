import { expect, test } from './helpers/e2eTest'
import { loginAs } from './helpers/auth'
import { expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

test.describe('Tickets Lifecycle', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'support', '/tickets')
  })

  test('update ticket status and submit replacement approval', async ({ page }) => {
    const openTicketRow = page.locator('tbody tr').filter({ hasText: 'Battery drains quickly' }).first()
    await openTicketRow.getByRole('button', { name: 'Manage' }).click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Update Ticket Status' })
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder('Add notes about the resolution...').fill('Investigating battery module')
    await dialog.getByRole('button', { name: 'In Progress' }).click()
    await expectToast(page, 'Ticket marked as in-progress')

    const progressedRow = page.locator('tbody tr').filter({ hasText: 'Battery drains quickly' }).first()
    await progressedRow.getByRole('button', { name: 'Manage' }).click()
    await dialog.getByRole('button', { name: 'Replacement / Cost Approval' }).click()
    await dialog.getByPlaceholder('Part/Item (e.g. Motherboard)').fill('Battery pack')
    await dialog.getByPlaceholder('Vendor name').fill('Dell')
    await dialog.getByPlaceholder('Amount').fill('5500')
    await dialog.getByRole('button', { name: 'Submit Replacement Approval' }).click()
    await expectToast(page, 'Replacement / Cost Approval details added to ticket')
  })
})
