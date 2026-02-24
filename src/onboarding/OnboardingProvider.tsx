import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Joyride, {
  ACTIONS,
  EVENTS,
  STATUS,
  type CallBackProps,
  type Step
} from 'react-joyride'
import { useLocation, useNavigate } from 'react-router-dom'
import type { UserRole } from '../lib/rbac'
import { OnboardingContext } from './useOnboarding'
import { canAutoStartForRole, markRoleCompleted, markRoleDismissed } from './storage'
import { getTourSteps } from './tours'
import type { OnboardingRole, TourStepDef } from './types'

const STEP_TARGET_TIMEOUT_MS = 2500
const POLL_INTERVAL_MS = 100
const SUPPORTED_ROLE_SET = new Set<OnboardingRole>(['admin', 'support', 'pm', 'user'])

type OnboardingProviderProps = {
  children: React.ReactNode
  isAuthenticated: boolean
  userEmail?: string
  role: UserRole | null
  roleLoading: boolean
}

const toSupportedRole = (role: UserRole | null | undefined): OnboardingRole | null => {
  if (!role) return null
  return SUPPORTED_ROLE_SET.has(role as OnboardingRole) ? (role as OnboardingRole) : null
}

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

const waitForTarget = async (selector: string, timeoutMs: number): Promise<boolean> => {
  if (selector === 'body') return true
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (document.querySelector(selector)) return true
    await sleep(POLL_INTERVAL_MS)
  }
  return Boolean(document.querySelector(selector))
}

const asJoyrideStep = (step: TourStepDef, fallbackToBody = false): Step => ({
  target: fallbackToBody ? 'body' : step.target,
  title: step.title,
  content: step.content,
  placement: fallbackToBody ? 'center' : (step.placement || 'bottom'),
  disableBeacon: true
})

export function OnboardingProvider({
  children,
  isAuthenticated,
  userEmail,
  role,
  roleLoading
}: OnboardingProviderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeRole = toSupportedRole(role)

  const [isRunning, setIsRunning] = useState(false)
  const [canAutoStart, setCanAutoStart] = useState(false)
  const [tourRole, setTourRole] = useState<OnboardingRole | null>(null)
  const [tourSteps, setTourSteps] = useState<TourStepDef[]>([])
  const [resolvedSteps, setResolvedSteps] = useState<Step[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [requestedIndex, setRequestedIndex] = useState<number | null>(null)
  const autoStartRef = useRef<string>('')

  const stopTour = useCallback((result: 'completed' | 'dismissed' | 'none' = 'none') => {
    if (tourRole && result === 'completed') {
      markRoleCompleted(tourRole)
      setCanAutoStart(false)
    }
    if (tourRole && result === 'dismissed') {
      markRoleDismissed(tourRole)
      setCanAutoStart(false)
    }
    setIsRunning(false)
    setTourRole(null)
    setTourSteps([])
    setResolvedSteps([])
    setStepIndex(0)
    setRequestedIndex(null)
  }, [tourRole])

  const initializeTour = useCallback((nextRole: OnboardingRole, force: boolean) => {
    if (!force && !canAutoStartForRole(nextRole)) {
      setCanAutoStart(false)
      return
    }
    const nextSteps = getTourSteps(nextRole)
    if (nextSteps.length === 0) return
    setTourRole(nextRole)
    setTourSteps(nextSteps)
    setResolvedSteps(nextSteps.map(step => asJoyrideStep(step)))
    setStepIndex(0)
    setRequestedIndex(0)
    setIsRunning(false)
  }, [])

  const startTour = useCallback((roleOverride?: OnboardingRole) => {
    const nextRole = roleOverride || activeRole
    if (!nextRole) return
    stopTour('none')
    initializeTour(nextRole, true)
  }, [activeRole, initializeTour, stopTour])

  const restartTour = useCallback(() => {
    startTour()
  }, [startTour])

  useEffect(() => {
    if (!isAuthenticated || roleLoading || location.pathname === '/login' || !activeRole) {
      setCanAutoStart(false)
      return
    }

    const allowed = canAutoStartForRole(activeRole)
    setCanAutoStart(allowed)
    if (!allowed) return

    const guardKey = `${userEmail || 'anonymous'}:${activeRole}`
    if (autoStartRef.current === guardKey) return

    autoStartRef.current = guardKey
    initializeTour(activeRole, false)
  }, [activeRole, initializeTour, isAuthenticated, location.pathname, roleLoading, userEmail])

  useEffect(() => {
    if (requestedIndex === null || requestedIndex < 0 || requestedIndex >= tourSteps.length) return

    const targetStep = tourSteps[requestedIndex]
    let cancelled = false

    const prepareStep = async () => {
      if (location.pathname !== targetStep.route) {
        if (isRunning) setIsRunning(false)
        navigate(targetStep.route)
        return
      }

      const foundTarget = await waitForTarget(targetStep.target, STEP_TARGET_TIMEOUT_MS)
      if (cancelled) return

      setResolvedSteps(previous => {
        const next = [...previous]
        next[requestedIndex] = asJoyrideStep(targetStep, !foundTarget)
        return next
      })
      setStepIndex(requestedIndex)
      setIsRunning(true)
    }

    void prepareStep()

    return () => {
      cancelled = true
    }
  }, [isRunning, location.pathname, navigate, requestedIndex, tourSteps])

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data

    if (status === STATUS.FINISHED) {
      stopTour('completed')
      return
    }

    if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      stopTour('dismissed')
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const delta = action === ACTIONS.PREV ? -1 : 1
      const nextIndex = index + delta
      if (nextIndex < 0) return
      if (nextIndex >= tourSteps.length) {
        stopTour('completed')
        return
      }
      setIsRunning(false)
      setRequestedIndex(nextIndex)
    }
  }, [stopTour, tourSteps.length])

  const contextValue = useMemo(() => ({
    startTour,
    restartTour,
    isRunning,
    canAutoStart
  }), [canAutoStart, isRunning, restartTour, startTour])

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      <Joyride
        run={isRunning && resolvedSteps.length > 0}
        steps={resolvedSteps}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous
        showSkipButton
        showProgress
        scrollToFirstStep
        disableOverlayClose
        disableCloseOnEsc={false}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip',
          nextLabelWithProgress: 'Next (Step {step} of {steps})'
        }}
        styles={{
          options: {
            zIndex: 2000
          }
        }}
      />
    </OnboardingContext.Provider>
  )
}
