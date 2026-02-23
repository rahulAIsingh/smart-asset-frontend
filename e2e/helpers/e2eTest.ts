import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test as base } from '@playwright/test'

const LOCK_DIR = path.join(process.cwd(), '.e2e-global-lock')
const STALE_LOCK_MS = 5 * 60 * 1000
const ACQUIRE_TIMEOUT_MS = 3 * 60 * 1000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const acquireGlobalLock = async () => {
  const startedAt = Date.now()

  while (Date.now() - startedAt < ACQUIRE_TIMEOUT_MS) {
    try {
      await fs.mkdir(LOCK_DIR)
      await fs.writeFile(
        path.join(LOCK_DIR, 'owner.json'),
        JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }),
        'utf8'
      )
      return async () => {
        await fs.rm(LOCK_DIR, { recursive: true, force: true })
      }
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error
      }

      try {
        const lockStat = await fs.stat(LOCK_DIR)
        if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
          await fs.rm(LOCK_DIR, { recursive: true, force: true })
          continue
        }
      } catch {
        // Lock disappeared while checking; retry acquire.
      }

      await sleep(200)
    }
  }

  throw new Error('Timed out acquiring global E2E lock.')
}

export const test = base.extend<{ globalE2eLock: void }>({
  globalE2eLock: [async ({}, use) => {
    const release = await acquireGlobalLock()
    try {
      await use()
    } finally {
      await release()
    }
  }, { auto: true }],
})

export { expect }
