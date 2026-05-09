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

export interface SetupIntegrationNotice {
  type: 'success' | 'error'
  message: string
}
