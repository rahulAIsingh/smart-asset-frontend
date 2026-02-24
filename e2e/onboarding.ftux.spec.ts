import { expect, test } from './helpers/e2eTest'
import type { Page } from '@playwright/test'
import { loginAs, type E2eRole } from './helpers/auth'
import { resetSeed } from './helpers/reset'

const tooltip = (page: Page) => page.locator('.react-joyride__tooltip').first()

const expectTourStepTitle = async (page: Page, title: string) => {
  await expect(tooltip(page)).toBeVisible()
  await expect(tooltip(page).getByText(title)).toBeVisible()
}

const skipTour = async (page: Page) => {
  await expect(tooltip(page)).toBeVisible()
  await tooltip(page).getByRole('button', { name: 'Skip' }).click()
  await expect(page.locator('.react-joyride__tooltip')).toHaveCount(0)
}

const finishTour = async (page: Page) => {
  for (let i = 0; i < 12; i += 1) {
    const scope = tooltip(page)
    await expect(scope).toBeVisible()

    const finishButton = scope.getByRole('button', { name: 'Finish' })
    if (await finishButton.isVisible()) {
      await finishButton.click()
      await expect(page.locator('.react-joyride__tooltip')).toHaveCount(0)
      return
    }

    const nextButton = scope.getByRole('button', { name: /Next/ })
    if (await nextButton.isVisible()) {
      await nextButton.click()
      continue
    }
  }

  throw new Error('FTUX did not reach the final step within expected iterations.')
}

test.describe('Onboarding FTUX', () => {
  test.beforeEach(async ({ request }) => {
    await resetSeed(request)
  })

  test('first login shows FTUX for user role', async ({ page }) => {
    await loginAs(page, 'user', '/my-assets')
    await expectTourStepTitle(page, 'My Assets')
  })

  test('skip prevents auto-show on reload', async ({ page }) => {
    await loginAs(page, 'user', '/my-assets')
    await skipTour(page)

    await page.reload()
    await expect(page.locator('.react-joyride__tooltip')).toHaveCount(0)
  })

  test('finish prevents auto-show on reload', async ({ page }) => {
    await loginAs(page, 'user', '/my-assets')
    await finishTour(page)

    await page.reload()
    await expect(page.locator('.react-joyride__tooltip')).toHaveCount(0)
  })

  test('header restart button starts tour again', async ({ page }) => {
    await loginAs(page, 'user', '/my-assets')
    await skipTour(page)

    await page.locator('[data-tour="header-profile-trigger"]').click()
    await page.getByTestId('ftux-restart-header').click()
    await expectTourStepTitle(page, 'My Assets')
  })

  test('settings restart button starts tour again', async ({ page }) => {
    await loginAs(page, 'admin', '/')
    await skipTour(page)

    await page.goto('/settings')
    await page.getByTestId('ftux-restart-settings').evaluate((element: HTMLElement) => element.click())
    await expectTourStepTitle(page, 'Operations Dashboard')
  })

  test('role-specific content appears for admin/support/pm/user', async ({ page }) => {
    const expectations: Array<{ role: E2eRole; path: string; title: string }> = [
      { role: 'admin', path: '/', title: 'Operations Dashboard' },
      { role: 'support', path: '/', title: 'Service Snapshot' },
      { role: 'pm', path: '/', title: 'PM Dashboard' },
      { role: 'user', path: '/my-assets', title: 'My Assets' }
    ]

    for (const item of expectations) {
      await loginAs(page, item.role, item.path)
      await expectTourStepTitle(page, item.title)
      await skipTour(page)
    }
  })
})
