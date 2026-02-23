import { apiClient } from './client'

export type RequestType =
  | 'new_asset'
  | 'upgrade'
  | 'replacement'
  | 'transfer'
  | 'return'
  | 'loss_theft'
  | 'damage'
  | 'accessory_peripheral'
  | 'temporary_loan'

export type RequestUrgency = 'low' | 'medium' | 'high' | 'critical'

export type RequestStatus =
  | 'submitted'
  | 'pending_pm'
  | 'pm_approved'
  | 'pending_boss'
  | 'boss_approved'
  | 'pending_it_fulfillment'
  | 'fulfilled'
  | 'closed'
  | 'rejected_pm'
  | 'rejected_boss'
  | 'rejected_it'
  | 'returned_for_info'

export type AssetRequest = {
  id: string
  requestNumber: string
  requestType: RequestType
  requesterEmail: string
  requesterName?: string
  requesterUserId?: string
  requestedForEmail?: string
  department: string
  costCenter?: string
  location: string
  businessJustification: string
  urgency: RequestUrgency
  status: RequestStatus
  currentApprovalLevel: 'pm' | 'boss' | 'it' | 'closed'
  pmApproverEmail: string
  bossApproverEmail: string
  destinationUserEmail?: string
  destinationManagerEmail?: string
  relatedAssetId?: string
  requestedCategory?: string
  requestedConfigurationJson?: string
  securityIncidentFlag: boolean
  incidentDate?: string
  incidentLocation?: string
  policeReportNumber?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export type CreateAssetRequestPayload = {
  requestType: RequestType
  requesterEmail: string
  requesterName?: string
  requesterUserId?: string
  requestedForEmail?: string
  department: string
  costCenter?: string
  location: string
  businessJustification: string
  urgency: RequestUrgency
  pmApproverEmail: string
  bossApproverEmail: string
  destinationUserEmail?: string
  destinationManagerEmail?: string
  relatedAssetId?: string
  requestedCategory?: string
  requestedConfigurationJson?: string
  incidentDate?: string
  incidentLocation?: string
  policeReportNumber?: string
}

export type ListAssetRequestsPayload = {
  requesterEmail?: string
  approverEmail?: string
  status?: string
  requestType?: RequestType
  createdFrom?: string
  createdTo?: string
  limit?: number
}

export type RequestActionPayload = {
  actorEmail: string
  actorRole?: string
  comment?: string
}

export type ItFulfillPayload = RequestActionPayload & {
  assignedAssetId?: string
}

export type RequestCommentPayload = {
  authorEmail: string
  comment: string
}

export type NotifyPayload = {
  recipientEmail: string
  channel: 'in_app' | 'email'
  type: string
  subject?: string
  html?: string
  status?: string
}

export type AssetRequestAudit = {
  id: string
  requestId: string
  requestNumber: string
  requestType: RequestType
  action: string
  actorEmail: string
  actorRole?: string
  fromStatus?: string
  toStatus?: string
  decision?: string
  comment?: string
  createdAt: string
}

export type AuditListPayload = {
  requestId?: string
  requestNumber?: string
  requestType?: RequestType
  requesterEmail?: string
  approverEmail?: string
  pmApproverEmail?: string
  bossApproverEmail?: string
  action?: string
  actorEmail?: string
  decision?: string
  status?: string
  createdFrom?: string
  createdTo?: string
  limit?: number
}

export const requestsClient = {
  create: (payload: CreateAssetRequestPayload) => apiClient.post<AssetRequest>('/api/requests/create', payload),
  list: (payload: ListAssetRequestsPayload) => apiClient.post<AssetRequest[]>('/api/requests/list', payload),
  get: (id: string) => apiClient.get<{ request: AssetRequest; approvals: any[]; comments: any[]; notifications: any[] }>(`/api/requests/${id}`),
  approve: (id: string, payload: RequestActionPayload) => apiClient.post<AssetRequest>(`/api/requests/${id}/approve`, payload),
  reject: (id: string, payload: RequestActionPayload) => apiClient.post<AssetRequest>(`/api/requests/${id}/reject`, payload),
  returnForInfo: (id: string, payload: RequestActionPayload) => apiClient.post<AssetRequest>(`/api/requests/${id}/return-for-info`, payload),
  itFulfill: (id: string, payload: ItFulfillPayload) => apiClient.post<AssetRequest>(`/api/requests/${id}/it-fulfill`, payload),
  itClose: (id: string, payload: RequestActionPayload) => apiClient.post<AssetRequest>(`/api/requests/${id}/it-close`, payload),
  comment: (id: string, payload: RequestCommentPayload) => apiClient.post<any>(`/api/requests/${id}/comment`, payload),
  notify: (id: string, payload: NotifyPayload) => apiClient.post<any>(`/api/requests/${id}/notify`, payload),
  auditList: (payload: AuditListPayload) => apiClient.post<AssetRequestAudit[]>(`/api/requests/audit/list`, payload),
  pendingMe: (_email: string, role?: string) => apiClient.get<AssetRequest[]>(`/api/requests/pending/me?role=${encodeURIComponent(role || '')}`),
  summaryMe: (_email: string, role?: string) => apiClient.get<{ mine: number; pendingMine: number; pendingApprovals: number }>(`/api/requests/summary/me?role=${encodeURIComponent(role || '')}`)
}
