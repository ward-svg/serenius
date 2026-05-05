export interface Partner {
  id: string
  tenant_id: string
  knack_id: string | null
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
  secondary_phone: string | null
  mobile_phone: string | null
  address_street: string | null
  address_street2: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  address_country: string | null
  notes: string | null
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
  gender: string | null
  marital_status: string | null
  relationship: string | null
  email_segment: string | null
  primary_email: string | null
  secondary_email: string | null
  primary_phone: string | null
  secondary_phone: string | null
  mobile_phone: string | null
  birthday: string | null
  anniversary: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PartnerTab = 'active' | 'prospects' | 'staff' | 'past'
