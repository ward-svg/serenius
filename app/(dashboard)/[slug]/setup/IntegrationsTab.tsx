'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type {
  OrganizationStorageConnection,
  OrganizationStorageSettings,
  SetupIntegrationNotice,
  StorageSettingsInput,
} from './types'
import MailSenderSection from './MailSenderSection'

interface IntegrationsTabProps {
  tenantId: string
  tenantSlug: string
  googleOAuthConfigured: boolean
  integrationNotice?: SetupIntegrationNotice | null
  mailIntegrationNotice?: SetupIntegrationNotice | null
  googleMapsApiKey: string
  setGoogleMapsApiKey: (value: string) => void
  sereniusApiKey: string
  sereniusApiKeyGeneratedAt: string | null
  showMapsKey: boolean
  setShowMapsKey: Dispatch<SetStateAction<boolean>>
  showSereniusKey: boolean
  setShowSereniusKey: Dispatch<SetStateAction<boolean>>
  onGenerateApiKey: () => void
  onCopyToClipboard: (value: string) => void
  storageSettings: OrganizationStorageSettings | null
  storageConnection: OrganizationStorageConnection | null
  onSaveStorageSettings: (values: StorageSettingsInput) => Promise<OrganizationStorageSettings>
  onStorageSettingsChange: (value: OrganizationStorageSettings) => void
}

interface StorageFormState {
  isEnabled: boolean
  rootFolderId: string
  rootFolderUrl: string
}

interface DriveFolderValidationResult {
  id: string
  name: string
  webViewLink: string | null
}

interface DrivePreparedFolderSummary {
  key: 'partners' | 'partner_communications' | 'partner_inkind_gifts' | 'partner_statements'
  displayName: string
  providerFolderId: string
  created: boolean
}

function buildStorageForm(storageSettings: OrganizationStorageSettings | null): StorageFormState {
  return {
    isEnabled: storageSettings?.provider === 'google_drive'
      ? storageSettings.is_enabled
      : false,
    rootFolderId: storageSettings?.root_folder_id ?? '',
    rootFolderUrl: storageSettings?.root_folder_url ?? '',
  }
}

function getStorageStatus(storageSettings: OrganizationStorageSettings | null, form: StorageFormState) {
  if (!storageSettings) return 'Not configured'
  if (storageSettings.provider !== 'google_drive') return 'Unsupported provider'
  if (storageSettings.connection_status === 'connected') return 'Connected'
  if (storageSettings.connection_status === 'error') return 'Error'
  if (!form.isEnabled) return 'Disabled'
  return 'Manual configuration'
}

function getProviderLabel(provider: OrganizationStorageSettings['provider'] | null | undefined) {
  switch (provider) {
    case 'google_drive':
      return 'Google Drive'
    case 'onedrive':
      return 'Microsoft OneDrive'
    case 'dropbox':
      return 'Dropbox'
    case 's3':
      return 'S3'
    default:
      return 'Google Drive'
  }
}

export default function IntegrationsTab({
  tenantId,
  tenantSlug,
  googleOAuthConfigured,
  integrationNotice,
  mailIntegrationNotice,
  googleMapsApiKey,
  setGoogleMapsApiKey,
  sereniusApiKey,
  sereniusApiKeyGeneratedAt,
  showMapsKey,
  setShowMapsKey,
  showSereniusKey,
  setShowSereniusKey,
  onGenerateApiKey,
  onCopyToClipboard,
  storageSettings,
  storageConnection,
  onSaveStorageSettings,
  onStorageSettingsChange,
}: IntegrationsTabProps) {
  const [selectedStorageProvider, setSelectedStorageProvider] = useState<'google-drive'>('google-drive')
  const [formState, setFormState] = useState<StorageFormState>(() => buildStorageForm(storageSettings))
  const [savingStorage, setSavingStorage] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [storageSuccess, setStorageSuccess] = useState(false)
  const [creatingRootFolder, setCreatingRootFolder] = useState(false)
  const [validatingRootFolder, setValidatingRootFolder] = useState(false)
  const [preparingFolders, setPreparingFolders] = useState(false)
  const [validationResult, setValidationResult] = useState<DriveFolderValidationResult | null>(null)
  const [preparedFolders, setPreparedFolders] = useState<DrivePreparedFolderSummary[] | null>(null)
  const [folderTaskError, setFolderTaskError] = useState<string | null>(null)
  const [folderTaskSuccess, setFolderTaskSuccess] = useState<string | null>(null)

  const googleDriveConnected = storageSettings?.provider === 'google_drive' && storageSettings.connection_status === 'connected'
  const googleDriveOAuthConnected = Boolean(storageConnection?.credentialsConnected)
  const connectedAccountLabel = storageConnection?.external_account_name || storageConnection?.external_account_email || null
  const connectUrl = `/api/storage/google/connect?tenantId=${encodeURIComponent(tenantId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`
  const isUnsupportedProvider = storageSettings?.provider && storageSettings.provider !== 'google_drive'
  const rootFolderConfigured = Boolean(formState.rootFolderId.trim())
  const canCreateRootFolder = googleDriveConnected && !isUnsupportedProvider
  const canValidateOrPrepare = googleDriveConnected && rootFolderConfigured && !isUnsupportedProvider

  const storageStatus = getStorageStatus(storageSettings, formState)
  const currentProviderLabel = getProviderLabel(storageSettings?.provider)

  async function handleSaveStorageSettings() {
    setSavingStorage(true)
    setStorageError(null)
    setStorageSuccess(false)

    try {
      const saved = await onSaveStorageSettings({
        is_enabled: formState.isEnabled,
        root_folder_id: formState.rootFolderId,
        root_folder_url: formState.rootFolderUrl,
      })

      setFormState(buildStorageForm(saved))
      setStorageSuccess(true)
      window.setTimeout(() => setStorageSuccess(false), 3000)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save storage settings.'
      setStorageError(message)
    } finally {
      setSavingStorage(false)
    }
  }

  async function handleValidateRootFolder() {
    if (!canValidateOrPrepare) return

    setValidatingRootFolder(true)
    setFolderTaskError(null)
    setFolderTaskSuccess(null)

    try {
      const response = await fetch(`/api/storage/google/validate-root?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await response.json() as {
        ok?: boolean
        error?: string
        folder?: DriveFolderValidationResult
      }

      if (!response.ok || !data.ok || !data.folder) {
        throw new Error(data.error || 'Unable to validate the Google Drive root folder.')
      }

      setValidationResult(data.folder)
      setPreparedFolders(null)
      setFolderTaskSuccess(`Validated ${data.folder.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to validate the Google Drive root folder.'
      setFolderTaskError(message)
      setValidationResult(null)
    } finally {
      setValidatingRootFolder(false)
    }
  }

  async function handlePrepareFolders() {
    if (!canValidateOrPrepare) return

    setPreparingFolders(true)
    setFolderTaskError(null)
    setFolderTaskSuccess(null)

    try {
      const response = await fetch(`/api/storage/google/prepare-folders?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await response.json() as {
        ok?: boolean
        error?: string
        rootFolder?: DriveFolderValidationResult
        folders?: DrivePreparedFolderSummary[]
      }

      if (!response.ok || !data.ok || !data.folders || !data.rootFolder) {
        throw new Error(data.error || 'Unable to prepare the Google Drive folder structure.')
      }

      setValidationResult(data.rootFolder)
      setPreparedFolders(data.folders)
      setFolderTaskSuccess('Folder structure prepared.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare the Google Drive folder structure.'
      setFolderTaskError(message)
      setPreparedFolders(null)
    } finally {
      setPreparingFolders(false)
    }
  }

  async function handleCreateRootFolder() {
    if (!canCreateRootFolder) return

    setCreatingRootFolder(true)
    setFolderTaskError(null)
    setFolderTaskSuccess(null)

    try {
      const response = await fetch(`/api/storage/google/create-root-folder?tenantId=${encodeURIComponent(tenantId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await response.json() as {
        ok?: boolean
        error?: string
        created?: boolean
        folderId?: string
        folderName?: string
        folderUrl?: string | null
      }

      if (!response.ok || !data.ok || !data.folderId || !data.folderName) {
        throw new Error(data.error || 'Unable to create the Google Drive root folder.')
      }

      const nextStorageSettings: OrganizationStorageSettings = {
        ...(storageSettings ?? {
          id: '',
          tenant_id: tenantId,
          provider: 'google_drive',
          display_name: 'Google Drive',
          root_folder_id: null,
          root_folder_url: null,
          is_enabled: true,
          connection_status: 'connected',
          locked_at: null,
          locked_by: null,
          created_at: null,
          updated_at: null,
        }),
        provider: 'google_drive',
        display_name: 'Google Drive',
        root_folder_id: data.folderId,
        root_folder_url: data.folderUrl ?? null,
        is_enabled: true,
        connection_status: 'connected',
      }

      setFormState(f => ({
        ...f,
        isEnabled: true,
        rootFolderId: data.folderId as string,
        rootFolderUrl: data.folderUrl ?? '',
      }))
      setValidationResult({
        id: data.folderId,
        name: data.folderName,
        webViewLink: data.folderUrl ?? null,
      })
      setPreparedFolders(null)
      onStorageSettingsChange(nextStorageSettings)
      setFolderTaskSuccess(`${data.created ? 'Root folder created' : 'Existing root folder reused'}: ${data.folderName}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create the Google Drive root folder.'
      setFolderTaskError(message)
      setValidationResult(null)
      setPreparedFolders(null)
    } finally {
      setCreatingRootFolder(false)
    }
  }

  return (
    <div className="space-y-6">
      {integrationNotice && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            integrationNotice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {integrationNotice.message}
        </div>
      )}

      <div className="section-card p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">API Keys</h2>
        <p className="text-xs text-gray-400 mb-4">Keys are stored securely and never exposed in logs.</p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Maps API Key
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Used for address autocomplete and geocoding. Get a key at{' '}
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                Google Cloud Console
              </a>.
            </p>
            <div className="flex items-center gap-2">
              <input
                type={showMapsKey ? 'text' : 'password'}
                value={googleMapsApiKey}
                onChange={e => setGoogleMapsApiKey(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="AIza..."
              />
              <button
                type="button"
                onClick={() => setShowMapsKey(v => !v)}
                className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
              >
                {showMapsKey ? 'Hide' : 'Show'}
              </button>
              {googleMapsApiKey && (
                <button
                  type="button"
                  onClick={() => onCopyToClipboard(googleMapsApiKey)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serenius API Key
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Used for external integrations and webhooks.
              {sereniusApiKeyGeneratedAt && (
                <span className="ml-1">
                  Last generated: {new Date(sereniusApiKeyGeneratedAt).toLocaleDateString()}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <input
                type={showSereniusKey ? 'text' : 'password'}
                value={sereniusApiKey}
                readOnly
                className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono bg-gray-50 text-gray-600"
                placeholder="No key generated yet"
              />
              <button
                type="button"
                onClick={() => setShowSereniusKey(v => !v)}
                className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
              >
                {showSereniusKey ? 'Hide' : 'Show'}
              </button>
              {sereniusApiKey && (
                <button
                  type="button"
                  onClick={() => onCopyToClipboard(sereniusApiKey)}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                >
                  Copy
                </button>
              )}
              <button
                type="button"
                onClick={onGenerateApiKey}
                className="px-3 py-2 text-xs bg-gray-800 text-white rounded-md hover:bg-gray-700"
              >
                {sereniusApiKey ? 'Rotate Key' : 'Generate Key'}
              </button>
            </div>
            {sereniusApiKey && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Rotating generates a new key immediately. Any existing integrations using the old key will stop working.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="section-card p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Storage Connector</h2>
        <p className="text-xs text-gray-400 mb-4">
          Choose where your organization&apos;s files will live. Serenius stores metadata and links only; file contents remain in your organization&apos;s connected storage provider.
        </p>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setSelectedStorageProvider('google-drive')}
              className={`text-left rounded-md border p-4 transition-colors ${
                selectedStorageProvider === 'google-drive'
                  ? 'border-[color:var(--color-primary)] bg-[color:color-mix(in_srgb,var(--color-secondary)_14%,white)]'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">Google Drive</div>
                  <div className="mt-1 text-xs text-gray-500">Available now</div>
                  <div className="mt-1 text-xs text-gray-500">Recommended for Google Workspace nonprofits</div>
                </div>
                <span className="badge-info text-xs">{googleDriveConnected ? 'Connected' : 'Active'}</span>
              </div>
            </button>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 opacity-60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-500">Microsoft OneDrive</div>
                  <div className="mt-1 text-xs text-gray-500">Future</div>
                </div>
                <span className="badge-info text-xs">Future</span>
              </div>
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 opacity-60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-500">Dropbox</div>
                  <div className="mt-1 text-xs text-gray-500">Future</div>
                </div>
                <span className="badge-info text-xs">Future</span>
              </div>
            </div>
          </div>

          {isUnsupportedProvider && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This organization already has an unsupported storage provider configured ({currentProviderLabel}). The current UI only supports Google Drive. Contact Serenius support to migrate this connector.
            </div>
          )}

          {!isUnsupportedProvider && selectedStorageProvider === 'google-drive' && (
            <div className="space-y-4">
              <p className="text-xs text-amber-600">
                Storage connector selection is organization-wide. Changing providers later will require an assisted migration.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.location.assign(connectUrl)}
                  disabled={!googleOAuthConfigured}
                  className="btn btn-ghost btn-sm"
                >
                  {googleDriveConnected ? 'Reconnect Google Workspace' : 'Connect Google Workspace'}
                </button>
                {googleDriveConnected && (
                  <button
                    type="button"
                    onClick={handleCreateRootFolder}
                    disabled={!canCreateRootFolder || creatingRootFolder || validatingRootFolder || preparingFolders || savingStorage}
                    className="btn btn-ghost btn-sm"
                  >
                    {creatingRootFolder ? 'Creating…' : 'Create Root Folder'}
                  </button>
                )}
                {!googleOAuthConfigured && (
                  <p className="text-xs text-amber-600">
                    Google OAuth is not configured in this environment.
                  </p>
                )}
                {googleDriveConnected && connectedAccountLabel && (
                  <p className="text-xs text-gray-500">
                    Connected as {connectedAccountLabel}
                  </p>
                )}
              </div>

              {googleDriveOAuthConnected && !googleDriveConnected && (
                <p className="text-xs text-amber-600">
                  Google Workspace is connected, but the storage settings row is still saved as manual configuration. Save Storage Settings to mark this connector as connected.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleValidateRootFolder}
                  disabled={!canValidateOrPrepare || validatingRootFolder || preparingFolders}
                  className="btn btn-ghost btn-sm"
                >
                  {validatingRootFolder ? 'Validating…' : 'Validate Root Folder'}
                </button>
                <button
                  type="button"
                  onClick={handlePrepareFolders}
                  disabled={!canValidateOrPrepare || validatingRootFolder || preparingFolders}
                  className="btn btn-ghost btn-sm"
                >
                  {preparingFolders ? 'Preparing…' : 'Prepare Folder Structure'}
                </button>
                {!canValidateOrPrepare && (
                  <p className="text-xs text-gray-500">
                    Connect Google Drive and save a root folder ID before validating or preparing folders.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                  <input
                    type="text"
                    value="Google Drive"
                    disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <input
                    type="text"
                    value={storageStatus}
                    disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="enable-google-drive-storage"
                      type="checkbox"
                      checked={formState.isEnabled}
                      onChange={e => setFormState(f => ({ ...f, isEnabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-[color:var(--color-primary)] focus:ring-[color:var(--color-primary)]"
                    />
                    <label htmlFor="enable-google-drive-storage" className="text-sm font-medium text-gray-700">
                      Enable Google Drive storage
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Root Folder ID</label>
                  <input
                    type="text"
                    value={formState.rootFolderId}
                    onChange={e => {
                      const value = e.target.value
                      setFormState(f => ({ ...f, rootFolderId: value }))
                      setValidationResult(null)
                      setPreparedFolders(null)
                      setFolderTaskError(null)
                      setFolderTaskSuccess(null)
                    }}
                    placeholder="Not configured"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Root Folder URL</label>
                  <input
                    type="url"
                    value={formState.rootFolderUrl}
                    onChange={e => {
                      const value = e.target.value
                      setFormState(f => ({ ...f, rootFolderUrl: value }))
                      setValidationResult(null)
                      setPreparedFolders(null)
                      setFolderTaskError(null)
                      setFolderTaskSuccess(null)
                    }}
                    placeholder="Not configured"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Enter the Google Drive folder Serenius should use as the root file home for this organization. Automated OAuth and folder creation will be added later.
              </p>

              {validationResult && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  <div className="font-medium">Validated folder</div>
                  <div className="mt-1 text-sm">
                    {validationResult.name}
                    {validationResult.webViewLink && (
                      <>
                        {' '}
                        <a
                          href={validationResult.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Open in Google Drive
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}

              {preparedFolders && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  <div className="font-medium">Folder structure ready</div>
                  <div className="mt-3 space-y-2">
                    {preparedFolders.map(folder => (
                      <div key={folder.key} className="flex items-center justify-between gap-3 text-sm">
                        <span>{folder.displayName}</span>
                        <span className="text-xs text-green-700">
                          {folder.created ? 'Created' : 'Reused'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveStorageSettings}
                  disabled={savingStorage || isUnsupportedProvider}
                  className="btn btn-primary"
                >
                  {savingStorage ? 'Saving…' : 'Save Storage Settings'}
                </button>
                {storageError && <p className="text-sm text-red-600">{storageError}</p>}
                {storageSuccess && <p className="text-sm text-green-600">Storage settings saved successfully.</p>}
              </div>

              {folderTaskError && <p className="text-sm text-red-600">{folderTaskError}</p>}
              {folderTaskSuccess && <p className="text-sm text-green-600">{folderTaskSuccess}</p>}
            </div>
          )}
        </div>
      </div>

      <MailSenderSection
        tenantId={tenantId}
        tenantSlug={tenantSlug}
        mailIntegrationNotice={mailIntegrationNotice}
      />
    </div>
  )
}
