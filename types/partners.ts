export interface Partner {
  id: number
  record_id: number | null
  display_name: string
  correspondence_greeting: string | null
  external_id: string | null
  entity_name: string | null
  partner_type: 'Family' | 'Church' | null
  partner_status: 'Active' | 'Past' | null
  relationship_type: 'Donor' | 'Prospect' | null
  city: string | null
  state: string | null
  street1: string | null
  street2: string | null
  zip: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  primary_email: string | null
  primary_phone: string | null
  secondary_phone: string | null
  primary_phone_type: string | null
  secondary_phone_type: string | null
  mailing_list: string | null
  total_giving: number
  giving_2023: number
  giving_2024: number
  giving_2025: number
  giving_2026: number
  created_by: string | null
  created_date: string | null
  created_at: string
  updated_at: string
}

export interface PartnerContact {
  id: number
  wsrv_record_id: number | null
  partner_id: number | null
  name_first: string | null
  name_last: string | null
  name_title: string | null
  nickname: string | null
  email: string | null
  email_segment: string | null
  communication_prefs: string | null
  primary_phone: string | null
  primary_phone_type: string | null
  secondary_phone: string | null
  secondary_phone_type: string | null
  relationship: string | null
  birthday: string | null
  anniversary: string | null
  gender: string | null
  marital_status: string | null
  clone_primary_address: boolean
  street1: string | null
  street2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  text_message: string | null
  campaign_version: string | null
  display_financial_data: string | null
  source_notes: string | null
  notes: string | null
  created_by: string | null
  created_date: string | null
  created_at: string
  updated_at: string
}

export type PartnerTab = 'active' | 'prospects' | 'staff' | 'past'
