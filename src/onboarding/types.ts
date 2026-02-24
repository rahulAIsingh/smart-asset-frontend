import type { Placement } from 'react-joyride'

export type OnboardingRole = 'admin' | 'support' | 'pm' | 'user'

export const SUPPORTED_ONBOARDING_ROLES: OnboardingRole[] = ['admin', 'support', 'pm', 'user']

export type TourStepDef = {
  id: string
  route: string
  target: string
  title: string
  content: string
  placement?: Placement
}

export type FtuxProgressV1 = {
  version: 1
  completedByRole: Partial<Record<OnboardingRole, string>>
  dismissedByRole: Partial<Record<OnboardingRole, string>>
}
