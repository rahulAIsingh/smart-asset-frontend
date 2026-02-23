import { expect, type Page } from '@playwright/test'

export const expectOnPath = async (page: Page, path: string) => {
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\?.*)?$`))
}

export const expectToast = async (page: Page, contains: string) => {
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: contains }).first()
  await expect(toast).toBeVisible()
}

export const expectAnyRowContains = async (page: Page, text: string) => {
  const row = page.locator('tbody tr').filter({ hasText: text }).first()
  await expect(row).toBeVisible()
}

export const fillPromptOnce = async (page: Page, value: string) => {
  page.once('dialog', async dialog => {
    await dialog.accept(value)
  })
}
