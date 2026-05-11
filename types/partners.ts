export interface Partner {
  id: string
  tenant_id: string
  knack_id: string | null
  assigned_to: string | null
  display_name: string
  entity_name: string | null
  correspondence_greeting: string | null
  external_id: string | null
  partner_type: 'Family' | 'Church' | 'Business' | 'Organization' | 'School' | null
  partner_status: 'Active' | 'Past' | null
  relationship_type: 'Donor' | 'Prospect' | null
  primary_email: string | null
  secondary_email: string | null
  primary_phone: string | null
  primary_phone_type: string | null
  secondary_phone: string | null
  secondary_phone_type: string | null
  address_street: string | null
  address_street2: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  address_country: string | null
  notes: string | null
  social_channels: string[] | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartnerContact {
  id: string
  tenant_id: string
  partner_id: string | null
  knack_id: string | null
  first_name: string | null
  last_name: string | null
  display_name: string | null
  nickname: string | null
  gender: string | null
  marital_status: string | null
  relationship: string | null
  primary_email: string | null
  secondary_email: string | null
  primary_phone: string | null
  primary_phone_type: string | null
  secondary_phone: string | null
  secondary_phone_type: string | null
  birthday: string | null
  anniversary: string | null
  notes: string | null
  source_notes: string | null
  communication_prefs: string[] | null
  email_segment: string[] | null
  campaign_version: string | null
  display_financial_data: boolean | null
  text_message: string | null
  clone_primary_address: boolean | null
  address_street: string | null
  address_street2: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  address_latitude: number | null
  address_longitude: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PartnerTab = 'active' | 'prospects' | 'staff' | 'past'

export interface FinancialGift {
  id: string
  tenant_id: string
  partner_id: string
  pledge_id: string | null
  knack_id: string | null
  date_given: string
  amount: number
  fee_donation: number | null
  base_gift: number | null
  processing_source: string
  towards: string
  towards_active_pledge: boolean | null
  giving_year: number | null
  gl_master_account_id: string | null
  gl_sub_account_id: string | null
  bank_deposit: string | null
  deposit_status: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartnerInKindGift {
  id: string
  tenant_id: string
  partner_id: string | null
  knack_id: string | null
  description: string | null
  notes: string | null
  estimated_value: number | null
  condition_type: 'New' | 'Like New' | 'Good' | 'Fair' | 'Poor' | null
  asset_status: 'Awaiting Transfer' | 'Transferred' | 'In Use' | 'Disposed' | null
  date_given: string | null
  date_transferred: string | null
  quantity: number | null
  location_notes: string | null
  received_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartnerStatement {
  id: string
  tenant_id: string
  partner_id: string
  knack_id: string | null
  year: number
  total_giving: number | null
  intro_letter_url: string | null
  giving_report_url: string | null
  combined_statement_url: string | null
  intro_letter_label: string | null
  giving_report_label: string | null
  combined_statement_label: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Pledge {
  id: string
  tenant_id: string
  partner_id: string
  knack_id: string | null
  pledge_type: string
  status: string
  frequency: string
  pledge_amount: number
  number_of_payments: number | null
  annualized_value: number | null
  start_date: string
  end_date: string | null
  on_hold_until: string | null
  house_knack_id: string | null
  resident_knack_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartnerStaffOption {
  id: string
  full_name: string | null
  email: string | null
}
