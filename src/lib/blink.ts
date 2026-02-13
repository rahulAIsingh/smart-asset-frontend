import { apiBlinkAdapter } from './api/blinkAdapter'

const provider = (import.meta.env.VITE_DATA_PROVIDER || 'api').toLowerCase()

if (provider !== 'api') {
  console.warn(`VITE_DATA_PROVIDER=${provider} is deprecated. Falling back to API compatibility adapter.`)
}

export const blink = apiBlinkAdapter as any
