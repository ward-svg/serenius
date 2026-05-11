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
  { key: 'all', label: 'All' },
  { key: 'draft-building', label: 'Draft / Building' },
  { key: 'in-process-ready', label: 'In Process / Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed-canceled', label: 'Failed / Canceled' },
]

export const CONTACT_CAMPAIGN_VERSION_OPTIONS = ['A', 'B', 'Skip'] as const

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
