export type StorageProvider = 'google_drive' | 'onedrive' | 'dropbox' | 's3'

export interface RecordAttachmentMetadata {
  downloadUrl?: string
  originalFileName?: string
  googleMimeType?: string
  uploadSource?: string
  rootFolderId?: string
  [key: string]: unknown
}

export interface RecordAttachment {
  id: string
  tenant_id: string
  record_type: string
  record_id: string
  storage_provider: StorageProvider
  provider_file_id: string | null
  provider_folder_id: string | null
  file_name: string
  file_url: string | null
  mime_type: string | null
  file_size_bytes: number | string | null
  description: string | null
  metadata: RecordAttachmentMetadata | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface RecordAttachmentInsertInput {
  tenant_id: string
  record_type: string
  record_id: string
  storage_provider?: StorageProvider
  file_name: string
  file_url: string
  description?: string | null
  uploaded_by?: string | null
}

export function getStorageProviderLabel(provider: StorageProvider | null | undefined): string {
  switch (provider) {
    case 'google_drive':
      return 'Google Drive'
    case 'onedrive':
      return 'OneDrive'
    case 'dropbox':
      return 'Dropbox'
    case 's3':
      return 'S3'
    default:
      return 'Google Drive'
  }
}
