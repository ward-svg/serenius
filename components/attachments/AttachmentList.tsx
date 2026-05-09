import type { RecordAttachment } from '@/lib/attachments/types'
import { getStorageProviderLabel } from '@/lib/attachments/types'

interface AttachmentListProps {
  attachments: RecordAttachment[]
  readonly?: boolean
  emptyMessage?: string
  onDelete?: (attachment: RecordAttachment) => void
}

function formatDate(dateValue: string | null | undefined): string {
  if (!dateValue) return '—'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  })
}

function formatFileSize(bytes: number | string | null | undefined): string {
  if (bytes == null || bytes === '') return '—'

  const value = Number(bytes)
  if (Number.isNaN(value) || value < 0) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default function AttachmentList({
  attachments,
  readonly = false,
  emptyMessage = 'No files added yet.',
  onDelete,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th className="actions-column">ACTIONS</th>
            <th>File Name</th>
            <th>Description</th>
            <th>Provider</th>
            <th>Created</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {attachments.map(attachment => (
            <tr key={attachment.id}>
              <td className="actions-column">
                {attachment.file_url ? (
                  <a
                    href={attachment.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-link"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                {attachment.metadata?.downloadUrl && (
                  <a
                    href={String(attachment.metadata.downloadUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-link ml-3"
                  >
                    Download
                  </a>
                )}
                {!readonly && onDelete && (
                  <button
                    type="button"
                    className="action-link action-link-danger ml-3"
                    onClick={() => onDelete(attachment)}
                  >
                    Delete
                  </button>
                )}
              </td>
              <td className="font-medium text-gray-900">{attachment.file_name}</td>
              <td>{attachment.description?.trim() ? attachment.description : '—'}</td>
              <td>
                <span className="badge badge-info text-xs">
                  {getStorageProviderLabel(attachment.storage_provider)}
                </span>
              </td>
              <td>{formatDate(attachment.created_at)}</td>
              <td>{formatFileSize(attachment.file_size_bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
