import { expect, type APIRequestContext } from '@playwright/test'
import { tokenFor } from './auth'

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:5000'
const transientStatuses = new Set([429, 500, 502, 503, 504])
const maxAttempts = 4

const authHeaders = () => ({
  Authorization: `Bearer ${tokenFor('admin')}`,
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const withRetries = async (fn: () => Promise<ResponseLike>, label: string) => {
  let lastStatus = 0
  let lastBody = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fn()
      lastStatus = response.status()
      lastBody = await response.text()
      if (response.ok()) {
        return
      }

      if (!transientStatuses.has(lastStatus) || attempt === maxAttempts) {
        break
      }
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
    }

    const jitter = Math.floor(Math.random() * 100)
    await sleep(200 * attempt + jitter)
  }

  expect(
    false,
    `${label} failed after ${maxAttempts} attempts: ${lastStatus} ${lastBody}`
  ).toBeTruthy()
}

type ResponseLike = {
  ok(): boolean
  status(): number
  text(): Promise<string>
  json(): Promise<any>
}

const ensureTestingAuthMode = async (request: APIRequestContext) => {
  const response = await request.get(`${apiBaseUrl}/api/auth/me`, {
    headers: authHeaders(),
  })
  const body = await response.text()
  expect(response.ok(), `auth preflight failed: ${response.status()} ${body}`).toBeTruthy()

  let parsed: any = null
  try {
    parsed = JSON.parse(body)
  } catch {
    parsed = null
  }
  const email = String(parsed?.user?.email || '').toLowerCase()
  const role = String(parsed?.user?.role || '').toLowerCase()
  expect(
    email === 'admin@demo.com' && role === 'admin',
    `Backend not in Testing auth mode: expected admin@demo.com/admin, got ${email || 'n/a'}/${role || 'n/a'}`
  ).toBeTruthy()
}

export const resetSeed = async (request: APIRequestContext) => {
  await ensureTestingAuthMode(request)
  await withRetries(
    () =>
      request.post(`${apiBaseUrl}/api/test/reset-seed`, {
        headers: authHeaders(),
      }),
    'reset-seed'
  )
}

export const seedScenario = async (
  request: APIRequestContext,
  scenario: 'baseline' | 'assets' | 'issuance' | 'requests' | 'finance'
) => {
  await ensureTestingAuthMode(request)
  await withRetries(
    () =>
      request.post(`${apiBaseUrl}/api/test/seed-scenario`, {
        headers: authHeaders(),
        data: { scenario },
      }),
    'seed-scenario'
  )
}
