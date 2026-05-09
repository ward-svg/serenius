'use client'

import { useMemo, useRef, useState } from 'react'
import SereniusModal from '@/components/ui/SereniusModal'
import { MAX_ATTACHMENT_UPLOAD_BYTES } from '@/lib/attachments/constants'

export interface AddAttachmentValues {
  file_name: string
  file_url: string
  description: string
}

export interface UploadAttachmentValues {
  file: File
  description: string
}

export interface UploadAttachmentResult {
  file: File
  status: 'uploaded' | 'failed'
  error?: string
}

type AttachmentMode = 'upload' | 'link'

interface AddAttachmentModalProps {
  onClose: () => void
  onSaveLink: (values: AddAttachmentValues) => Promise<void>
  onUploadFile: (values: UploadAttachmentValues) => Promise<void>
  onUploadFinished?: (results: UploadAttachmentResult[]) => Promise<void> | void
  allowUpload?: boolean
  defaultMode?: AttachmentMode
}

interface SelectedUploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'uploaded' | 'failed'
  retryable: boolean
  description: string
  error?: string
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function makeUploadId(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`
}

function getUploadButtonLabel(count: number) {
  if (count > 1) {
    return `Upload ${count} Files`
  }

  return 'Upload File'
}

function getStatusLabel(status: SelectedUploadFile['status']) {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'uploading':
      return 'Uploading'
    case 'uploaded':
      return 'Uploaded'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}

export default function AddAttachmentModal({
  onClose,
  onSaveLink,
  onUploadFile,
  onUploadFinished,
  allowUpload = true,
  defaultMode = 'upload',
}: AddAttachmentModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [mode, setMode] = useState<AttachmentMode>(allowUpload ? defaultMode : 'link')
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([])
  const [saving, setSaving] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedUploadTargets = useMemo(() => {
    return selectedFiles.filter(file => (
      (file.status === 'pending' || file.status === 'failed') && file.retryable
    ))
  }, [selectedFiles])

  const selectedFilesWithSizes = useMemo(() => {
    return selectedFiles.map(selected => ({
      ...selected,
      sizeLabel: formatFileSize(selected.file.size),
    }))
  }, [selectedFiles])

  const uploadLabel = getUploadButtonLabel(selectedUploadTargets.length)

  function clearError() {
    setError(null)
  }

  function appendFiles(files: File[]) {
    if (files.length === 0) return

    const nextFiles: SelectedUploadFile[] = files.map((file, index) => ({
      id: makeUploadId(file, index),
      file,
      status: file.size > MAX_ATTACHMENT_UPLOAD_BYTES ? 'failed' : 'pending',
      retryable: file.size <= MAX_ATTACHMENT_UPLOAD_BYTES,
      description: '',
      error: file.size > MAX_ATTACHMENT_UPLOAD_BYTES ? 'Files must be 100 MB or smaller.' : undefined,
    }))

    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(entry => `${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`))
      const deduped = nextFiles.filter(entry => !existingKeys.has(`${entry.file.name}-${entry.file.size}-${entry.file.lastModified}`))
      return [...prev, ...deduped]
    })

    clearError()
  }

  function handleFileSelection(files: FileList | File[] | null) {
    if (!files || files.length === 0) return
    appendFiles(Array.from(files))
  }

  function updateSelectedFileDescription(id: string, nextDescription: string) {
    setSelectedFiles(prev => prev.map(file => (
      file.id === id
        ? { ...file, description: nextDescription }
        : file
    )))
  }

  function removeSelectedFile(id: string) {
    if (saving) return

    setSelectedFiles(prev => prev.filter(file => file.id !== id))
  }

  async function handleUpload() {
    if (selectedUploadTargets.length === 0) {
      setError('Choose at least one file to upload.')
      return
    }

    setSaving(true)
    clearError()

    const results: UploadAttachmentResult[] = []

    try {
      for (const target of selectedUploadTargets) {
        setSelectedFiles(prev => prev.map(file => (
          file.id === target.id
            ? { ...file, status: 'uploading', error: undefined }
            : file
        )))

        try {
          await onUploadFile({
            file: target.file,
            description: target.description.trim(),
          })

          results.push({ file: target.file, status: 'uploaded' })
          setSelectedFiles(prev => prev.map(file => (
            file.id === target.id
              ? { ...file, status: 'uploaded', error: undefined }
              : file
          )))
        } catch (uploadError) {
          const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload file.'
          results.push({ file: target.file, status: 'failed', error: message })
          setSelectedFiles(prev => prev.map(file => (
            file.id === target.id
              ? { ...file, status: 'failed', error: message }
              : file
          )))
        }
      }

      await onUploadFinished?.(results)

      const hasAnyFailed = selectedFiles.some(file => file.status === 'failed') || results.some(result => result.status === 'failed')
      if (!hasAnyFailed) {
        onClose()
      } else {
        setError('Some files could not be uploaded. Review the file list and try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleLinkSave() {
    const trimmedName = fileName.trim()
    const trimmedUrl = fileUrl.trim()

    if (!trimmedName) {
      setError('File name is required.')
      return
    }

    if (!trimmedUrl) {
      setError('File URL is required.')
      return
    }

    setSaving(true)
    clearError()

    try {
      await onSaveLink({
        file_name: trimmedName,
        file_url: trimmedUrl,
        description: description.trim(),
      })
      onClose()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save file.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const uploadEnabled = allowUpload
  const modalTitle = mode === 'upload' ? 'Add Files' : 'Add Link'
  const modalDescription =
    mode === 'upload'
      ? 'Choose one or more files to upload.'
      : 'Add a link to a file stored outside Serenius.'

  return (
    <SereniusModal
      title={modalTitle}
      description={modalDescription}
      onClose={onClose}
      footerLeft={
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Cancel
        </button>
      }
      footer={
        mode === 'upload' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={saving || selectedUploadTargets.length === 0}
          >
            {saving ? 'Uploading…' : uploadLabel}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLinkSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Link'}
          </button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {uploadEnabled && (
            <button
              type="button"
              className={mode === 'upload' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => {
                setMode('upload')
                clearError()
              }}
            >
              Upload File
            </button>
          )}
          <button
            type="button"
            className={mode === 'link' || !uploadEnabled ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => {
              setMode('link')
              clearError()
            }}
          >
            Add Link
          </button>
        </div>

        <p className="text-xs text-gray-500">
          {mode === 'upload'
            ? 'Upload a file to this organization’s connected Google Drive. Serenius stores metadata and links only, not file contents.'
            : 'Save a link to a file stored outside Serenius. Serenius stores metadata and links only, not file contents.'}
        </p>

        {mode === 'upload' ? (
          <div className="space-y-4">
            <div
              className={`rounded-md border-2 border-dashed p-5 text-center transition-colors ${
                dragActive
                  ? 'border-[color:var(--color-primary)] bg-[color:color-mix(in_srgb,var(--color-secondary)_10%,white)]'
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={event => {
                event.preventDefault()
                event.stopPropagation()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={event => {
                event.preventDefault()
                event.stopPropagation()
                setDragActive(false)
                handleFileSelection(event.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            >
              <div className="text-sm font-medium text-gray-800">Drop files here</div>
              <div className="mt-1 text-xs text-gray-500">or browse your device to select one or more files</div>
              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={event => {
                    event.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                >
                  Browse Files
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={event => {
                  handleFileSelection(event.target.files)
                  event.currentTarget.value = ''
                }}
              />
            </div>

            {selectedFilesWithSizes.length > 0 && (
              <div className="space-y-2">
                {selectedFilesWithSizes.map(selected => (
                  <div
                    key={selected.id}
                    className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{selected.file.name}</div>
                        <div className="text-xs text-gray-500">{selected.sizeLabel}</div>
                        {selected.error ? (
                          <div className="mt-1 text-xs text-red-600">{selected.error}</div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium ${
                          selected.status === 'failed'
                            ? 'text-red-600'
                            : selected.status === 'uploaded'
                              ? 'text-green-700'
                              : selected.status === 'uploading'
                                ? 'text-blue-700'
                                : 'text-gray-500'
                        }`}>
                          {getStatusLabel(selected.status)}
                        </span>
                        {selected.status === 'pending' && !saving ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeSelectedFile(selected.id)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {(selected.status === 'pending' || selected.status === 'failed') && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                        <textarea
                          value={selected.description}
                          onChange={event => updateSelectedFileDescription(selected.id, event.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20"
                          placeholder="Optional description for this file"
                          disabled={saving}
                        />
                      </div>
                    )}

                    {selected.status === 'uploaded' && selected.description.trim() ? (
                      <div className="mt-3 text-xs text-gray-600 whitespace-pre-wrap">
                        {selected.description}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

          <p className="text-xs text-gray-500">
            Uploads are limited to 100 MB per file.
          </p>
        </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
              <input
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Document name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File URL</label>
              <input
                type="url"
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
                placeholder="Optional note"
              />
            </div>

          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </SereniusModal>
  )
}
