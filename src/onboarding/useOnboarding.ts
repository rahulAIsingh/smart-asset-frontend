import { createContext, useContext } from 'react'
import type { OnboardingRole } from './types'

export type OnboardingContextValue = {
  startTour: (role?: OnboardingRole) => void
  restartTour: () => void
  isRunning: boolean
  canAutoStart: boolean
}

const noop = () => {}

export const OnboardingContext = createContext<OnboardingContextValue>({
  startTour: noop,
  restartTour: noop,
  isRunning: false,
  canAutoStart: false
})

export const useOnboarding = () => useContext(OnboardingContext)
