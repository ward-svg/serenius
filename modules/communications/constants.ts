import type { CampaignListFilter } from './types'

export const COMMUNICATION_TYPE_OPTIONS = [
  'Ministry Update',
  'New Donor',
  'New Prospect',
  'iMessage',
] as const

export const EMAIL_STYLE_OPTIONS = ['Raw HTML', 'Rich Text'] as const

export const CAMPAIGN_VERSION_OPTIONS = ['A', 'B', 'A+B'] as const

export const CAMPAIGN_FILTERS: {
  key: CampaignListFilter
  label: string
}[] = [
  { key: 'working-scheduled', label: 'Working / Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed-canceled', label: 'Failed / Canceled' },
  { key: 'trash', label: 'Trash' },
  { key: 'all', label: 'All' },
]

export const CONTACT_CAMPAIGN_VERSION_OPTIONS = ['A', 'B', 'Skip'] as const

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  ministry_update: 'Ministry Update',
  new_donor: 'New Donor',
  new_prospect: 'New Prospect',
  imessage: 'iMessage',
  general: 'General',
  custom: 'Custom',
}

export const TEMPLATE_TYPE_OPTIONS = [
  'ministry_update',
  'new_donor',
  'new_prospect',
  'imessage',
  'general',
  'custom',
] as const

export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
}

export const TEMPLATE_STATUS_OPTIONS = ['draft', 'active', 'archived'] as const

export const CONTACT_EMAIL_SEGMENT_SUGGESTIONS = [
  'Donors, All US',
  'Prospects',
  'Staff',
  'Test Emails',
  'New Donor',
  'New Prospect',
  'iMessage Test',
  'Mission Trips',
] as const

// Controlled segment values that match the individual strings assignable to partner_contacts.email_segment.
// Campaigns select one of these — the estimate logic checks contacts.email_segment.includes(segment).
export const CAMPAIGN_SEGMENT_OPTIONS = [
  'Donors',
  'All US',
  'Prospects',
  'Staff',
  'Test Emails',
  'New Donor',
  'New Prospect',
  'iMessage Test',
  'Mission Trips',
] as const
