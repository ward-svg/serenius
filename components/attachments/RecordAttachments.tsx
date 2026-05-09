'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { createRecordAttachment, deleteRecordAttachment, fetchRecordAttachments } from '@/lib/attachments/queries'
import type { RecordAttachment } from '@/lib/attachments/types'
import AttachmentList from './AttachmentList'
import AddAttachmentModal, { type UploadAttachmentResult, type AddAttachmentValues } from './AddAttachmentModal'

interface RecordAttachmentsProps {
  tenantId: string
  recordType: string
  recordId: string
  title?: string
  emptyMessage?: string
  readonly?: boolean
  allowUpload?: boolean
  uploadContext?: {
    partnerId?: string | null
    partnerDisplayName?: string | null
  }
}

export default function RecordAttachments({
  tenantId,
  recordType,
  recordId,
  title = 'Files',
  emptyMessage = 'No files added yet.',
  readonly = false,
  allowUpload,
  uploadContext,
}: RecordAttachmentsProps) {
  const [attachments, setAttachments] = useState<RecordAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const canUpload = readonly ? false : (allowUpload ?? true)

  const loadAttachments = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    setLoading(true)
    setError(null)

    try {
      const nextAttachments = await fetchRecordAttachments(supabase, {
        tenantId,
        recordType,
        recordId,
      })
      setAttachments(nextAttachments)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load files.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, recordId, recordType])

  useEffect(() => {
    void loadAttachments()
  }, [loadAttachments])

  async function handleSaveAttachment(values: AddAttachmentValues) {
    const supabase = createSupabaseBrowserClient()
    const { data: authResult } = await supabase.auth.getUser()

    await createRecordAttachment(supabase, {
      tenant_id: tenantId,
      record_type: recordType,
      record_id: recordId,
      storage_provider: 'google_drive',
      file_name: values.file_name,
      file_url: values.file_url,
      description: values.description || null,
      uploaded_by: authResult.user?.id ?? null,
    })

    await loadAttachments()
    setSuccess('File saved successfully.')
    setShowAddModal(false)
  }

  async function handleUploadAttachment(values: { file: File; description: string }) {
    const formData = new FormData()
    formData.set('tenantId', tenantId)
    formData.set('recordType', recordType)
    formData.set('recordId', recordId)
    formData.set('file', values.file)
    if (uploadContext?.partnerId) {
      formData.set('partnerId', uploadContext.partnerId)
    }
    if (uploadContext?.partnerDisplayName) {
      formData.set('partnerDisplayName', uploadContext.partnerDisplayName)
    }
    if (values.description.trim()) {
      formData.set('description', values.description.trim())
    }

    const response = await fetch('/api/attachments/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    const data = await response.json().catch(() => null) as
      | { ok?: boolean; error?: string; attachment?: RecordAttachment }
      | null

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to upload file.')
    }
  }

  async function handleUploadFinished(results: UploadAttachmentResult[]) {
    const uploadedCount = results.filter(result => result.status === 'uploaded').length

    if (uploadedCount > 0) {
      await loadAttachments()
      setSuccess(uploadedCount === 1
      ? '1 file uploaded successfully.'
      : `${uploadedCount} files uploaded successfully.`)
    }
  }

  async function handleDeleteAttachment(attachment: RecordAttachment) {
    const confirmed = window.confirm(`Delete file "${attachment.file_name}"?`)
    if (!confirmed) return

    const supabase = createSupabaseBrowserClient()
    await deleteRecordAttachment(supabase, tenantId, attachment.id)

    await loadAttachments()
    setSuccess('File deleted successfully.')
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <span className="section-title">{title}</span>
        <span className="section-count">{attachments.length}</span>
        {!readonly && (
          <div className="section-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowAddModal(true)}
            >
              + Add Files
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading files...</div>
      ) : error ? (
        <div className="empty-state" style={{ color: '#b91c1c' }}>
          {error}
        </div>
      ) : (
        <>
          {success && (
            <div className="px-4 pt-4 text-sm text-green-700">
              {success}
            </div>
          )}
          <AttachmentList
            attachments={attachments}
            readonly={readonly}
            emptyMessage={emptyMessage}
            onDelete={readonly ? undefined : handleDeleteAttachment}
          />
        </>
      )}

      {showAddModal && !readonly && (
        <AddAttachmentModal
          allowUpload={canUpload}
          defaultMode={canUpload ? 'upload' : 'link'}
          onClose={() => setShowAddModal(false)}
          onSaveLink={handleSaveAttachment}
          onUploadFile={handleUploadAttachment}
          onUploadFinished={handleUploadFinished}
        />
      )}
    </div>
  )
}
