import type { OnboardingRole, TourStepDef } from './types'

const TOUR_DEFINITIONS: Record<OnboardingRole, TourStepDef[]> = {
  admin: [
    {
      id: 'admin-dashboard-overview',
      route: '/',
      target: '[data-tour="dashboard-overview"]',
      title: 'Operations Dashboard',
      content: 'Track live utilization, ticket pressure, and fulfillment KPIs from a single view.',
      placement: 'bottom'
    },
    {
      id: 'admin-open-ticket-signal',
      route: '/',
      target: '[data-tour="dashboard-open-tickets"]',
      title: 'Open Ticket Signal',
      content: 'Use this tile to prioritize support capacity and monitor escalation trend.',
      placement: 'bottom'
    },
    {
      id: 'admin-recent-issuance-activity',
      route: '/',
      target: '[data-tour="dashboard-recent-issuance"]',
      title: 'Recent Issuance Activity',
      content: 'Review the latest handovers and status changes before opening issuance operations.',
      placement: 'top'
    },
    {
      id: 'admin-assets-module',
      route: '/assets',
      target: '[data-tour="assets-page-header"]',
      title: 'Assets Module',
      content: 'Manage inventory lifecycle, ownership, condition, and bulk records here.',
      placement: 'bottom'
    },
    {
      id: 'admin-issuance-module',
      route: '/issuance',
      target: '[data-tour="issuance-new-button"]',
      title: 'Issuance Workflow',
      content: 'Start a new handover from this action and complete assignment + notification flow.',
      placement: 'left'
    },
    {
      id: 'admin-approvals-queue',
      route: '/approvals',
      target: '[data-tour="approvals-assigned"]',
      title: 'Approvals Queue',
      content: 'Review pending PM/Boss/IT stages and capture clear action reasons.',
      placement: 'bottom'
    },
    {
      id: 'admin-user-management',
      route: '/users',
      target: '[data-tour="users-add-form"]',
      title: 'User Administration',
      content: 'Create users and maintain role assignments for access control.',
      placement: 'bottom'
    }
  ],
  support: [
    {
      id: 'support-dashboard-overview',
      route: '/',
      target: '[data-tour="dashboard-overview"]',
      title: 'Service Snapshot',
      content: 'Start each day with current service load and request trend.',
      placement: 'bottom'
    },
    {
      id: 'support-tickets-overview',
      route: '/tickets',
      target: '[data-tour="tickets-page-overview"]',
      title: 'Tickets Workspace',
      content: 'This page is your queue for diagnostics, updates, and closures.',
      placement: 'bottom'
    },
    {
      id: 'support-ticket-filters',
      route: '/tickets',
      target: '[data-tour="tickets-filters"]',
      title: 'Filter and Search',
      content: 'Narrow tickets by status, reporter, date, and text to triage quickly.',
      placement: 'bottom'
    },
    {
      id: 'support-ticket-manage',
      route: '/tickets',
      target: '[data-tour="tickets-actions-column"]',
      title: 'Manage Ticket',
      content: 'Open ticket details to update status, log notes, and record replacement approvals.',
      placement: 'bottom'
    },
    {
      id: 'support-request-workspace',
      route: '/my-requests',
      target: '[data-tour="my-requests-workspace"]',
      title: 'Request Approvals Workspace',
      content: 'Track approval-linked requests and operational actions from this workspace.',
      placement: 'top'
    },
    {
      id: 'support-pending-actions',
      route: '/my-requests',
      target: '[data-tour="my-requests-pending-actions"]',
      title: 'Pending Fulfillment Actions',
      content: 'Use this panel to process fulfillment or return requests waiting on you.',
      placement: 'top'
    }
  ],
  pm: [
    {
      id: 'pm-dashboard-overview',
      route: '/',
      target: '[data-tour="dashboard-overview"]',
      title: 'PM Dashboard',
      content: 'Monitor demand, service trend, and request pressure before approvals.',
      placement: 'bottom'
    },
    {
      id: 'pm-request-workspace',
      route: '/my-requests',
      target: '[data-tour="my-requests-workspace"]',
      title: 'Request Workspace',
      content: 'Create, review, and track requests across the approval chain.',
      placement: 'top'
    },
    {
      id: 'pm-request-submit',
      route: '/my-requests',
      target: '[data-tour="my-requests-submit"]',
      title: 'Submit Request',
      content: 'Submit once mandatory request, approver, and configuration sections are complete.',
      placement: 'top'
    },
    {
      id: 'pm-approval-responsibility',
      route: '/approvals',
      target: '[data-tour="approvals-assigned"]',
      title: 'Assigned Approvals',
      content: 'Review requests assigned to you and capture a clear decision reason.',
      placement: 'bottom'
    },
    {
      id: 'pm-audit-visibility',
      route: '/approvals',
      target: '[data-tour="approvals-audit"]',
      title: 'Audit Trail',
      content: 'Validate end-to-end request decisions and timeline transitions.',
      placement: 'top'
    }
  ],
  user: [
    {
      id: 'user-my-assets-overview',
      route: '/my-assets',
      target: '[data-tour="my-assets-overview"]',
      title: 'My Assets',
      content: 'See assigned devices and your personal operational workspace.',
      placement: 'bottom'
    },
    {
      id: 'user-report-issue',
      route: '/my-assets',
      target: '[data-tour="my-assets-report-issue"]',
      title: 'Report an Issue',
      content: 'Raise hardware or software issues directly to support from here.',
      placement: 'left'
    },
    {
      id: 'user-ticket-tracking',
      route: '/tickets',
      target: '[data-tour="tickets-page-overview"]',
      title: 'Tickets Tracking',
      content: 'Track the status of your submitted tickets and follow support updates here.',
      placement: 'bottom'
    },
    {
      id: 'user-request-workspace',
      route: '/my-requests',
      target: '[data-tour="my-requests-workspace"]',
      title: 'Request Approvals',
      content: 'Open this workspace to create and track approval-based asset requests.',
      placement: 'top'
    },
    {
      id: 'user-request-submit',
      route: '/my-requests',
      target: '[data-tour="my-requests-submit"]',
      title: 'Submit Workflow',
      content: 'Submit requests after filling required business context and approvers.',
      placement: 'top'
    },
    {
      id: 'user-request-history',
      route: '/my-request-history',
      target: '[data-tour="my-request-history"]',
      title: 'Request History',
      content: 'Check approvals, status transitions, and outcomes for your past requests.',
      placement: 'top'
    },
    {
      id: 'user-support-contact',
      route: '/my-assets',
      target: '[data-tour="my-assets-support-contact"]',
      title: 'Support Contact',
      content: 'Reach IT support quickly when you need direct assistance.',
      placement: 'top'
    }
  ]
}

export const getTourSteps = (role: OnboardingRole): TourStepDef[] =>
  (TOUR_DEFINITIONS[role] || []).map(step => ({ ...step }))
