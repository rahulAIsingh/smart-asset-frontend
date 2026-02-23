import { expect, test } from './helpers/e2eTest'
import { tokenFor } from './helpers/auth'
import { resetSeed } from './helpers/reset'

const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:5000'

test.describe('API Edge Cases', () => {
  test.beforeEach(async ({ request }) => {
    await resetSeed(request)
  })

  test('rejects HTML/script payload in asset create', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/assets`, {
      headers: { Authorization: `Bearer ${tokenFor('admin')}` },
      data: {
        name: '<script>alert(1)</script>',
        category: 'laptop',
        serialNumber: 'E2E-EDGE-001',
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body?.success).toBeFalsy()
    expect(String(body?.message || '')).toContain('Invalid text')
  })

  test('rejects invalid asset id format', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/api/assets/invalid$id`, {
      headers: { Authorization: `Bearer ${tokenFor('admin')}` },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body?.success).toBeFalsy()
    expect(String(body?.message || '')).toContain('Invalid asset id format')
  })

  test('rejects invalid request type on request create', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/requests/create`, {
      headers: { Authorization: `Bearer ${tokenFor('user')}` },
      data: {
        requestType: 'unsupported_type',
        requesterEmail: 'user@demo.com',
        requesterName: 'E2E User',
        requesterUserId: 'e2e-user-standard',
        requestedForEmail: null,
        department: 'Finance',
        costCenter: null,
        location: 'Main Office',
        businessJustification: 'Need endpoint validation check',
        urgency: 'medium',
        pmApproverEmail: 'pm@demo.com',
        bossApproverEmail: 'boss@demo.com',
        destinationUserEmail: null,
        destinationManagerEmail: null,
        relatedAssetId: null,
        requestedCategory: 'hardware',
        requestedConfigurationJson: 'CPU: i5',
        incidentDate: null,
        incidentLocation: null,
        policeReportNumber: null,
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(String(body?.error || '')).toContain('Invalid requestType')
  })

  test('forbids wrong approver role for pending PM approval', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/requests/e2e-req-pending-pm/approve`, {
      headers: { Authorization: `Bearer ${tokenFor('boss')}` },
      data: {
        actorEmail: 'boss@demo.com',
        actorRole: 'boss',
        comment: 'Attempting unauthorized PM-stage approval',
      },
    })

    expect(response.status()).toBe(403)
  })

  test('rejects approve action when comment is missing', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/requests/e2e-req-pending-pm/approve`, {
      headers: { Authorization: `Bearer ${tokenFor('pm')}` },
      data: {
        actorEmail: 'pm@demo.com',
        actorRole: 'pm',
        comment: '',
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(String(body?.error || '')).toContain('Approval reason is required')
  })

  test('rejects IT fulfill when request is not pending IT fulfillment', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/requests/e2e-req-pending-pm/it-fulfill`, {
      headers: { Authorization: `Bearer ${tokenFor('admin')}` },
      data: {
        actorEmail: 'admin@demo.com',
        actorRole: 'admin',
        comment: 'Trying to fulfill too early',
        assignedAssetId: null,
      },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(String(body?.error || '')).toContain('IT fulfill is only valid')
  })

  test('forbids compat batch write for standard user role', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/compat/db/batch`, {
      headers: { Authorization: `Bearer ${tokenFor('user')}` },
      data: {
        mode: 'write',
        statements: [{ sql: "insert into Departments (Id, Name) values ('e2e-nope', 'Nope')" }],
      },
    })

    expect(response.status()).toBe(403)
  })

  test('rejects unauthenticated access to compat db list endpoint', async ({ request }) => {
    const response = await request.post(`${apiBaseUrl}/api/compat/db/assets/list`, {
      data: { limit: 1 },
    })

    expect(response.status()).toBe(401)
  })
})
