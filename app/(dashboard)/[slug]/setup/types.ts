export interface OrganizationStorageSettings {
  id: string
  tenant_id: string
  provider: 'google_drive' | 'onedrive' | 'dropbox' | 's3'
  display_name: string | null
  root_folder_id: string | null
  root_folder_url: string | null
  is_enabled: boolean
  connection_status: string | null
  locked_at: string | null
  locked_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface StorageSettingsInput {
  is_enabled: boolean
  root_folder_id: string
  root_folder_url: string
}

export interface OrganizationStorageConnection {
  provider: 'google_drive' | 'onedrive' | 'dropbox' | 's3'
  credentialsConnected: boolean
  external_account_email: string | null
  external_account_name: string | null
}

export type MailConnectionStatus = 'manual' | 'connected' | 'error' | 'disabled'
export type MailSendMode = 'disabled' | 'test_only' | 'live'

export interface OrganizationMailConnection {
  provider: 'google_workspace' | 'microsoft_365' | 'custom_smtp' | 'amazon_ses' | null
  connection_status: MailConnectionStatus | null
  credentialsConnected: boolean
  external_account_email: string | null
  external_account_name: string | null
}

export interface SetupIntegrationNotice {
  type: 'success' | 'error'
  message: string
}

export interface OrganizationMailSettings {
  id: string
  tenant_id: string
  provider: 'google_workspace' | 'microsoft_365' | 'custom_smtp' | 'amazon_ses'
  display_name: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  provider_account_email: string | null
  provider_account_name: string | null
  is_enabled: boolean | null
  connection_status: MailConnectionStatus | null
  send_mode: MailSendMode | null
  locked_at: string | null
  locked_by: string | null
  connected_at: string | null
  connected_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface OrganizationMailTestRecipient {
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
