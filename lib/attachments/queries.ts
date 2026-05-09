import type { SupabaseClient } from '@supabase/supabase-js'
import type { RecordAttachment, RecordAttachmentInsertInput } from './types'

interface AttachmentLookupParams {
  tenantId: string
  recordType: string
  recordId: string
}

export async function fetchRecordAttachments(
  supabase: SupabaseClient,
  { tenantId, recordType, recordId }: AttachmentLookupParams
): Promise<RecordAttachment[]> {
  const { data, error } = await supabase
    .from('record_attachments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as RecordAttachment[]
}

export async function createRecordAttachment(
  supabase: SupabaseClient,
  input: RecordAttachmentInsertInput
): Promise<RecordAttachment> {
  const { data, error } = await supabase
    .from('record_attachments')
    .insert({
      tenant_id: input.tenant_id,
      record_type: input.record_type,
      record_id: input.record_id,
      storage_provider: input.storage_provider ?? 'google_drive',
      provider_file_id: null,
      provider_folder_id: null,
      file_name: input.file_name,
      file_url: input.file_url,
      mime_type: null,
      file_size_bytes: null,
      description: input.description ?? null,
      metadata: { source: 'manual' },
      uploaded_by: input.uploaded_by ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  return data as RecordAttachment
}

export async function deleteRecordAttachment(
  supabase: SupabaseClient,
  tenantId: string,
  attachmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('record_attachments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', attachmentId)

  if (error) throw error
}
