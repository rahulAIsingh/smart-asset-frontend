import { expect, test } from './helpers/e2eTest'
import { tokenFor } from './helpers/auth'
import { resetSeed } from './helpers/reset'

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:5000'

test.describe('API Contract', () => {
  test.beforeEach(async ({ request }) => {
    await resetSeed(request)
  })

  test('@smoke auth me returns user envelope', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenFor('admin')}` },
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body?.user?.email).toBe('admin@demo.com')
  })

  test('compat DB list/create/update/delete contract', async ({ request }) => {
    const headers = { Authorization: `Bearer ${tokenFor('admin')}` }

    const listRes = await request.post(`${apiBaseUrl}/api/compat/db/assets/list`, { headers, data: { limit: 5 } })
    expect(listRes.ok()).toBeTruthy()
    const listBody = await listRes.json()
    expect(Array.isArray(listBody)).toBeTruthy()
    expect(listBody.length).toBeGreaterThan(0)

    const createRes = await request.post(`${apiBaseUrl}/api/compat/db/departments/create`, {
      headers,
      data: { id: 'e2e-dept-contract', name: 'E2E Contract Dept' },
    })
    expect(createRes.ok()).toBeTruthy()
    const created = await createRes.json()
    expect(created.name).toBe('E2E Contract Dept')

    const updateRes = await request.patch(`${apiBaseUrl}/api/compat/db/departments/e2e-dept-contract`, {
      headers,
      data: { name: 'E2E Contract Dept Updated' },
    })
    expect(updateRes.ok()).toBeTruthy()

    const deleteRes = await request.delete(`${apiBaseUrl}/api/compat/db/departments/e2e-dept-contract`, { headers })
    expect(deleteRes.status()).toBe(204)
  })

  test('requests endpoints contract and unauthorized response', async ({ request }) => {
    const headers = { Authorization: `Bearer ${tokenFor('pm')}` }

    const listRes = await request.post(`${apiBaseUrl}/api/requests/list`, {
      headers,
      data: { limit: 10 },
    })
    expect(listRes.ok()).toBeTruthy()
    const listRows = await listRes.json()
    expect(Array.isArray(listRows)).toBeTruthy()

    const summaryRes = await request.get(`${apiBaseUrl}/api/requests/summary/me?role=pm`, { headers })
    expect(summaryRes.ok()).toBeTruthy()
    const summary = await summaryRes.json()
    expect(summary).toHaveProperty('pendingApprovals')

    const unauthorized = await request.get(`${apiBaseUrl}/api/auth/me`)
    expect(unauthorized.status()).toBe(401)
  })
})
