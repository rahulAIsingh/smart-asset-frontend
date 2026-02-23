import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from './helpers/e2eTest'
import * as XLSX from 'xlsx'
import { loginAs } from './helpers/auth'
import { expectAnyRowContains, expectToast } from './helpers/assertions'
import { resetSeed } from './helpers/reset'

const createBulkFile = () => {
  const rows = [
    {
      'ASSET MODEL': 'E2E Bulk Model',
      Company: 'Dell',
      Category: 'laptop',
      Department: 'IT',
      Location: 'Main Office',
      'SERVICE TAG': 'E2E-BULK-001',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  const file = path.join(os.tmpdir(), `e2e-assets-${Date.now()}.xlsx`)
  XLSX.writeFile(workbook, file)
  return file
}

test.describe('Assets Bulk Import', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetSeed(request)
    await loginAs(page, 'admin', '/assets')
  })

  test('import assets from mapped excel', async ({ page }) => {
    const filePath = createBulkFile()
    try {
      await page.setInputFiles('[data-testid="bulk-import-input"]', filePath)
      const mapDialog = page.getByTestId('asset-import-map-dialog')
      await expect(mapDialog).toBeVisible()

      await mapDialog.getByTestId('asset-import-confirm').evaluate(el => (el as HTMLButtonElement).click())
      await expectToast(page, 'Successfully imported')
      await expectAnyRowContains(page, 'E2E Bulk Model')
    } finally {
      fs.rmSync(filePath, { force: true })
    }
  })
})
