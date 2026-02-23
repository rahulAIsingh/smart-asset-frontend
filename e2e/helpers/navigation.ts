import { type Page } from '@playwright/test'

export const goToPath = async (page: Page, path: string) => {
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
}

export const clickSidebarItem = async (page: Page, label: string) => {
  const link = page.getByRole('link', { name: label }).first()
  await link.click()
  await page.waitForLoadState('domcontentloaded')
}
