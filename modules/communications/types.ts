export interface MailSettingsSummary {
  id: string
  tenant_id: string
  provider: string | null
  display_name: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  provider_account_email: string | null
  provider_account_name: string | null
  is_enabled: boolean | null
  connection_status: string | null
  send_mode: string | null
}

export interface MailTestRecipient {
  id: string
  tenant_id: string
  email: string
  display_name: string | null
  is_active: boolean | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PartnerEmailCampaign {
  id: string
  tenant_id: string
  knack_id: string | null
  knack_email_id: string | null
  sending_status: string | null
  message_status: string | null
  communication_type: string | null
  email_style: string | null
  sent_type: string | null
  segment: string | null
  campaign_version: string | null
  subject: string | null
  message: string | null
  message_raw_html: string | null
  html_file_name: string | null
  html_file_url: string | null
  media_attachments: unknown
  number_of_attachments: number | null
  delivery_datetime: string | null
  email_sent_at: string | null
  total_emails_sent: number | null
  sent_to_bot: string | null
  original_opens: number | null
  total_touches: number | null
  clear_partner_emails: string | null
  design_json: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  template_id: string | null
}

export interface PartnerEmailOpenSummary {
  id: string
  tenant_id: string
  partner_email_id: string | null
  open_count: number | null
  first_opened: string | null
  last_opened: string | null
  sent_at: string | null
}

export interface PartnerContactEstimate {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  primary_email: string | null
  email_segment: string[] | null
  campaign_version: string | null
}

export interface PartnerEmailSuppression {
  id: string
  tenant_id: string
  partner_contact_id: string | null
  email: string
  suppression_type: string
  source: string | null
  reason: string | null
  suppressed_at: string
}

export interface CommunicationEmailAsset {
  id: string
  tenant_id: string
  asset_type: string
  file_name: string
  original_file_name: string | null
  public_url: string
  mime_type: string
  file_size_bytes: number
  width: number | null
  height: number | null
  alt_text: string | null
  created_at: string
  updated_at: string
}

export interface CommunicationsPageData {
  slug: string
  orgId: string
  orgName: string
  mailSettings: MailSettingsSummary | null
  testRecipients: MailTestRecipient[]
  campaigns: PartnerEmailCampaign[]
  opens: PartnerEmailOpenSummary[]
  contacts: PartnerContactEstimate[]
  suppressions: PartnerEmailSuppression[]
  templates: EmailTemplate[]
  brandSettings: EmailBrandSettings | null
  emailAssets: CommunicationEmailAsset[]
}

export type CampaignListFilter =
  | 'working-scheduled'
  | 'completed'
  | 'failed-canceled'
  | 'trash'
  | 'all'

export type CampaignFormMode = 'create' | 'view' | 'edit'

export interface EmailTemplate {
  id: string
  tenant_id: string
  name: string
  description: string | null
  template_type: string
  status: string
  is_default: boolean
  subject_default: string | null
  preheader_default: string | null
  html_template: string | null
  plain_text_template: string | null
  thumbnail_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EmailBrandSettings {
  id: string
  tenant_id: string
  logo_url: string | null
  logo_width: number | null
  header_html: string | null
  footer_html: string | null
  primary_color: string
  accent_color: string
  button_color: string
  button_text_color: string
  background_color: string
  text_color: string
  default_font: string
  heading_font: string
  body_font: string
  default_signature: string | null
  default_donation_url: string | null
  preference_center_url: string | null
  social_links: Record<string, string> | null
  organization_name: string | null
  mailing_address: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string
  phone: string | null
  website_url: string | null
  unsubscribe_text: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CommWorkspaceTab = 'campaigns' | 'templates' | 'brandkit' | 'delivery-setup'
