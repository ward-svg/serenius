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

export interface PartnerCommunication {
  id: string
  tenant_id: string
  partner_id: string | null
  knack_id: string | null
  communication_type:
    | 'Thank You For...'
    | 'House Update'
    | 'Program Update'
    | 'Request'
    | null
  communication_channel:
    | 'Email - Broadcast'
    | 'Email - Personal'
    | 'Face to Face'
    | 'Phone Call'
    | 'Small Group'
    | 'Text'
    | null
  communication_date: string
  notes: string | null
  followup_needed: boolean | null
  followup_due: string | null
  followup_notes: string | null
  followup_complete: boolean | null
  completion_notes: string | null
  completion_date: string | null
  file_attachment_name: string | null
  file_attachment_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartnerCommunicationFollowup {
  id: string
  tenant_id: string
  communication_id: string
  action_type:
    | 'Send Thank You'
    | 'Send Email'
    | 'Mail Letter'
    | 'Make Phone Call'
    | 'Send Form'
    | 'Schedule Visit'
    | 'Other'
  instructions: string | null
  assigned_to: string | null
  assigned_by: string | null
  due_date: string | null
  completed: boolean | null
  completed_at: string | null
  completion_notes: string | null
  created_at: string
  updated_at: string
}

export interface PartnerEmailOpen {
  id: string
  tenant_id: string
  partner_email_id: string | null
  partner_id: string | null
  partner_contact_id: string | null
  campaign_message: string | null
  sent_at: string | null
  first_opened: string | null
  last_opened: string | null
  open_count: number | null
  user_country: string | null
  user_ip_address: string | null
  user_agent: string | null
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
export interface MonthlyPartnerPledge {
  id: string
  partner_id: string
  partner_name: string
  pledge_type: string
  frequency: string
  pledge_amount: number
  annualized_value: number
  start_date: string
}

export interface PartnerStaffOption {
  id: string
  full_name: string | null
  email: string | null
}
