import type { PartnerTab } from './types'

export const PARTNER_TABS: {
  key: PartnerTab
  label: string
}[] = [
  {
    key: 'active',
    label: 'Active Partners',
  },
  {
    key: 'prospects',
    label: 'Prospects',
  },
  {
    key: 'staff',
    label: 'Staff / Volunteers',
  },
  {
    key: 'past',
    label: 'Past Relationships',
  },
]