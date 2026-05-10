import { createHash, createHmac, randomBytes } from 'node:crypto'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

export const GOOGLE_STORAGE_OAUTH_COOKIE_NAME = 'serenius_google_storage_oauth'
export const GOOGLE_STORAGE_CONNECT_SCOPE = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
].join(' ')

export interface GoogleStorageOAuthStatePayload {
  nonce: string
  tenantId: string
  tenantSlug: string
  userId: string
  returnTo: string
  issuedAt: string
}

export interface GoogleStorageOAuthCookiePayload extends GoogleStorageOAuthStatePayload {
  codeVerifier: string
}

export interface GoogleStorageTokens {
  accessToken: string
  refreshToken: string | null
  tokenType: string | null
  scope: string | null
  expiryDate: string | null
  idToken: string | null
}

export interface GoogleAccountInfo {
  email: string | null
  name: string | null
}

export interface GoogleStorageSettingsRow {
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

export interface GoogleStorageCredentialsRow {
  id: string
  tenant_id: string
  provider: 'google_drive' | 'onedrive' | 'dropbox' | 's3'
  access_token: string
  refresh_token: string | null
  token_type: string | null
  scope: string | null
  expiry_date: string | null
  external_account_email: string | null
  external_account_name: string | null
  created_at: string | null
  updated_at: string | null
}

export interface GoogleDriveTenantContext {
  settings: GoogleStorageSettingsRow
  credentials: GoogleStorageCredentialsRow
  accessToken: string
  refreshToken: string | null
  expiryDate: string | null
}

export interface GoogleDriveFolderMetadata {
  id: string
  name: string
  mimeType: string
  webViewLink: string | null
}

export interface GoogleDrivePreparedFolder {
  key: 'partners' | 'partner_communications' | 'partner_inkind_gifts' | 'partner_statements'
  displayName: string
  providerFolderId: string
  created: boolean
}

export type DriveUploadRecordType = 'partner_communication' | 'partner_in_kind_gift' | 'partner_statement'

export interface DriveUploadFolderTarget {
  rootFolder: GoogleDriveFolderMetadata
  recordFolder: GoogleDriveFolderMetadata
}

export function buildTenantRootFolderName(input: {
  organizationName?: string | null
  tenantSlug?: string | null
}) {
  const organizationName = input.organizationName?.trim()
  if (organizationName) {
    return `Serenius - ${organizationName}`
  }

  const tenantSlug = input.tenantSlug?.trim()
  if (tenantSlug) {
    return `Serenius - ${tenantSlug}`
  }

  return 'Serenius'
}

export function sanitizeDriveFolderName(value: string) {
  const sanitized = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '')

  return sanitized.slice(0, 120)
}

export function extractGoogleDriveFileIdFromUrl(value: string | null | undefined) {
  const rawValue = value?.trim()
  if (!rawValue) return null

  const tryExtract = (candidate: string) => {
    const idMatch = candidate.match(/[?&]id=([^&]+)/)
    if (idMatch?.[1]) return decodeURIComponent(idMatch[1])

    const fileMatch = candidate.match(/\/file\/d\/([^/]+)/)
    if (fileMatch?.[1]) return decodeURIComponent(fileMatch[1])

    const openMatch = candidate.match(/\/open\?id=([^&]+)/)
    if (openMatch?.[1]) return decodeURIComponent(openMatch[1])

    return null
  }

  try {
    const parsed = new URL(rawValue)
    const searchId = parsed.searchParams.get('id')
    if (searchId) return searchId

    const pathnameMatch = tryExtract(parsed.pathname)
    if (pathnameMatch) return pathnameMatch

    return tryExtract(rawValue)
  } catch {
    return tryExtract(rawValue)
  }
}

export function buildPartnerCommunicationUploadFolderName(input: {
  partnerDisplayName?: string | null
  partnerId?: string | null
}) {
  const partnerId = input.partnerId?.trim()
  if (!partnerId) {
    return 'Unknown Partner'
  }

  const displayName = sanitizeDriveFolderName(input.partnerDisplayName?.trim() || '')
  const baseName = displayName || `Partner-${partnerId}`
  return `${baseName}-${partnerId}`
}

function requireGoogleClientSecret() {
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!secret) {
    throw new Error('Missing GOOGLE_CLIENT_SECRET.')
  }
  return secret
}

export function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

export function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

export function createGoogleStorageOAuthState(input: {
  tenantId: string
  tenantSlug: string
  userId: string
  returnTo: string
}) {
  const nonce = randomBytes(16).toString('base64url')
  const codeVerifier = randomBytes(32).toString('base64url')
  const issuedAt = new Date().toISOString()

  const payload: GoogleStorageOAuthStatePayload = {
    nonce,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    userId: input.userId,
    returnTo: input.returnTo,
    issuedAt,
  }

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload))
  const signature = createHmac('sha256', requireGoogleClientSecret())
    .update(payloadBase64)
    .digest('base64url')

  const cookiePayload: GoogleStorageOAuthCookiePayload = {
    ...payload,
    codeVerifier,
  }

  return {
    nonce,
    codeVerifier,
    state: `${payloadBase64}.${signature}`,
    cookieValue: base64UrlEncode(JSON.stringify(cookiePayload)),
  }
}

export function parseGoogleStorageOAuthState(state: string | null) {
  if (!state) return null

  const [payloadBase64, signature] = state.split('.')
  if (!payloadBase64 || !signature) return null

  const expectedSignature = createHmac('sha256', requireGoogleClientSecret())
    .update(payloadBase64)
    .digest('base64url')

  if (signature !== expectedSignature) return null

  try {
    return JSON.parse(base64UrlDecode(payloadBase64)) as GoogleStorageOAuthStatePayload
  } catch {
    return null
  }
}

export function parseGoogleStorageOAuthCookie(value: string | null) {
  if (!value) return null

  try {
    return JSON.parse(base64UrlDecode(value)) as GoogleStorageOAuthCookiePayload
  } catch {
    return null
  }
}

function isSensitiveLogKey(key: string) {
  return /^(access_token|refresh_token|token|client_secret|clientsecret|authorization_code|auth_code|codeverifier|state|cookie|cookies)$/i.test(
    key,
  )
}

function serializeSafeObject(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    return undefined
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeSafeObject(entry, seen))
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }

    seen.add(value)

    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = {}

    for (const [key, entry] of Object.entries(record)) {
      if (isSensitiveLogKey(key)) {
        result[key] = '[redacted]'
        continue
      }

      const serialized = serializeSafeObject(entry, seen)
      if (serialized !== undefined) {
        result[key] = serialized
      }
    }

    return result
  }

  return undefined
}

export function serializeSafeError(error: unknown) {
  if (error instanceof Error) {
    const maybeRecord = error as Error & Record<string, unknown>
    const hasSupabaseShape =
      typeof maybeRecord.message === 'string' &&
      (
        typeof maybeRecord.code === 'string' ||
        typeof maybeRecord.details === 'string' ||
        typeof maybeRecord.hint === 'string'
      )

    if (hasSupabaseShape) {
      return {
        kind: 'supabase_error' as const,
        name: maybeRecord.name,
        message: maybeRecord.message,
        code: typeof maybeRecord.code === 'string' ? maybeRecord.code : null,
        details: maybeRecord.details ?? null,
        hint: typeof maybeRecord.hint === 'string' ? maybeRecord.hint : null,
      }
    }

    return {
      kind: 'generic_error' as const,
      constructorName: error.constructor?.name ?? 'Error',
      name: error.name,
      message: error.message,
      safeFields: serializeSafeObject(error),
    }
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const hasSupabaseShape =
      typeof record.message === 'string' &&
      (
        typeof record.code === 'string' ||
        typeof record.details === 'string' ||
        typeof record.hint === 'string'
      )

    if (hasSupabaseShape) {
      return {
        kind: 'supabase_error' as const,
        name: typeof record.name === 'string' ? record.name : 'Error',
        message: record.message,
        code: typeof record.code === 'string' ? record.code : null,
        details: record.details ?? null,
        hint: typeof record.hint === 'string' ? record.hint : null,
      }
    }

    return {
      kind: 'generic_error' as const,
      constructorName: error.constructor?.name ?? 'Object',
      safeFields: serializeSafeObject(error),
    }
  }

  return {
    kind: 'primitive_error' as const,
    constructorName: typeof error,
  }
}

export function buildGoogleOAuthUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_STORAGE_CONNECT_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent select_account')
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export function buildPkceCodeChallenge(codeVerifier: string) {
  return createHash('sha256').update(codeVerifier).digest('base64url')
}

export async function exchangeGoogleCodeForTokens(input: {
  code: string
  codeVerifier: string
  clientId: string
  clientSecret: string
  redirectUri: string
}) {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const payload = await response.json().catch(() => null) as {
    access_token?: string
    refresh_token?: string
    token_type?: string
    scope?: string
    expires_in?: number
    id_token?: string
    error?: string
    error_description?: string
  } | null

  if (!response.ok || !payload?.access_token) {
    const message = payload?.error_description || payload?.error || `Google token exchange failed (${response.status}).`
    throw new Error(message)
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    tokenType: payload.token_type ?? null,
    scope: payload.scope ?? null,
    expiryDate: typeof payload.expires_in === 'number'
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
    idToken: payload.id_token ?? null,
  } satisfies GoogleStorageTokens
}

export async function getGoogleAccountInfo(accessToken: string) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const payload = await response.json().catch(() => null) as {
    email?: string
    name?: string
  } | null

  if (!payload) return null

  return {
    email: payload.email ?? null,
    name: payload.name ?? null,
  } satisfies GoogleAccountInfo
}

function isGoogleTokenExpired(expiryDate: string | null) {
  if (!expiryDate) return false
  const expiryTime = new Date(expiryDate).getTime()
  if (Number.isNaN(expiryTime)) return false
  return Date.now() >= expiryTime - 60_000
}

async function refreshGoogleAccessToken(input: {
  refreshToken: string
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.')
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const payload = await response.json().catch(() => null) as {
    access_token?: string
    refresh_token?: string
    token_type?: string
    scope?: string
    expires_in?: number
    error?: string
    error_description?: string
  } | null

  if (!response.ok || !payload?.access_token) {
    const message = payload?.error_description || payload?.error || `Google token refresh failed (${response.status}).`
    throw new Error(message)
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? input.refreshToken,
    tokenType: payload.token_type ?? null,
    scope: payload.scope ?? null,
    expiryDate: typeof payload.expires_in === 'number'
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null,
  }
}

export async function getAuthorizedDriveClientForTenant(tenantId: string) {
  const client = createSupabaseServiceClient()

  const [settingsRes, credentialsRes] = await Promise.all([
    client
      .from('organization_storage_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    client
      .from('organization_storage_credentials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_drive')
      .maybeSingle(),
  ])

  const settings = settingsRes.data as GoogleStorageSettingsRow | null
  const credentials = credentialsRes.data as GoogleStorageCredentialsRow | null

  if (!settings) {
    throw new Error('Google Drive storage is not configured for this organization.')
  }

  if (settings.provider !== 'google_drive') {
    throw new Error('This organization is already using an unsupported storage provider.')
  }

  if (!credentials) {
    throw new Error('Google Drive credentials are missing. Reconnect Google Workspace.')
  }

  let nextCredentials = credentials

  if (isGoogleTokenExpired(credentials.expiry_date)) {
    if (!credentials.refresh_token) {
      throw new Error('Google Drive refresh token is missing. Reconnect Google Workspace.')
    }

    const refreshed = await refreshGoogleAccessToken({
      refreshToken: credentials.refresh_token,
    })

    const { error: updateError } = await client
      .from('organization_storage_credentials')
      .update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        token_type: refreshed.tokenType,
        scope: refreshed.scope,
        expiry_date: refreshed.expiryDate,
      })
      .eq('id', credentials.id)

    if (updateError) {
      throw updateError
    }

    nextCredentials = {
      ...credentials,
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      token_type: refreshed.tokenType,
      scope: refreshed.scope,
      expiry_date: refreshed.expiryDate,
    }
  }

  return {
    client,
    settings,
    credentials: nextCredentials,
    accessToken: nextCredentials.access_token,
    refreshToken: nextCredentials.refresh_token,
    expiryDate: nextCredentials.expiry_date,
  } satisfies GoogleDriveTenantContext & { client: ReturnType<typeof createSupabaseServiceClient> }
}

export function escapeGoogleDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function googleDriveApiJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as T & {
    error?: {
      message?: string
      status?: string
      code?: number
    }
  } | null

  if (!response.ok) {
    const message = (payload as { error?: { message?: string } } | null)?.error?.message || `Google Drive request failed (${response.status}).`
    throw new Error(message)
  }

  return payload as T
}

export async function getDriveFolderMetadata(accessToken: string, folderId: string) {
  const payload = await googleDriveApiJson<{
    id?: string
    name?: string
    mimeType?: string
    webViewLink?: string
    trashed?: boolean
  }>(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink,trashed&supportsAllDrives=true`, accessToken)

  if (!payload.id || !payload.name || !payload.mimeType) {
    throw new Error('Unable to read folder metadata from Google Drive.')
  }

  if (payload.trashed) {
    throw new Error('The configured root folder is in the trash.')
  }

  if (payload.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('The configured root folder is not a folder.')
  }

  return {
    id: payload.id,
    name: payload.name,
    mimeType: payload.mimeType,
    webViewLink: payload.webViewLink ?? null,
  } satisfies GoogleDriveFolderMetadata
}

export async function findChildFolderByName(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
) {
  const query = [
    `'${escapeGoogleDriveQueryValue(parentFolderId)}' in parents`,
    `name = '${escapeGoogleDriveQueryValue(folderName)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ')

  const payload = await googleDriveApiJson<{
    files?: Array<{
      id?: string
      name?: string
      mimeType?: string
      webViewLink?: string
    }>
  }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink)&pageSize=10`,
    accessToken,
  )

  const folder = payload.files?.[0]
  if (!folder?.id || !folder.name) return null

  return {
    id: folder.id,
    name: folder.name,
    mimeType: folder.mimeType ?? 'application/vnd.google-apps.folder',
    webViewLink: folder.webViewLink ?? null,
  } satisfies GoogleDriveFolderMetadata
}

export async function findRootFolderByName(accessToken: string, folderName: string) {
  const query = [
    `'root' in parents`,
    `name = '${escapeGoogleDriveQueryValue(folderName)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ')

  const payload = await googleDriveApiJson<{
    files?: Array<{
      id?: string
      name?: string
      mimeType?: string
      webViewLink?: string
    }>
  }>(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink)&pageSize=10`,
    accessToken,
  )

  const folder = payload.files?.[0]
  if (!folder?.id || !folder.name) return null

  return {
    id: folder.id,
    name: folder.name,
    mimeType: folder.mimeType ?? 'application/vnd.google-apps.folder',
    webViewLink: folder.webViewLink ?? null,
  } satisfies GoogleDriveFolderMetadata
}

export async function ensureChildFolder(
  accessToken: string,
  parentFolderId: string,
  folderName: string,
) {
  const existing = await findChildFolderByName(accessToken, parentFolderId, folderName)
  if (existing) {
    return { folder: existing, created: false }
  }

  const payload = await googleDriveApiJson<{
    id?: string
    name?: string
    mimeType?: string
    webViewLink?: string
  }>('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  })

  if (!payload.id || !payload.name) {
    throw new Error(`Unable to create ${folderName} folder in Google Drive.`)
  }

  return {
    folder: {
      id: payload.id,
      name: payload.name,
      mimeType: payload.mimeType ?? 'application/vnd.google-apps.folder',
      webViewLink: payload.webViewLink ?? null,
    } satisfies GoogleDriveFolderMetadata,
    created: true,
  }
}

export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string | null,
) {
  const payload = await googleDriveApiJson<{
    id?: string
    name?: string
    mimeType?: string
    webViewLink?: string
  }>('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    }),
  })

  if (!payload.id || !payload.name) {
    throw new Error(`Unable to create ${folderName} folder in Google Drive.`)
  }

  return {
    id: payload.id,
    name: payload.name,
    mimeType: payload.mimeType ?? 'application/vnd.google-apps.folder',
    webViewLink: payload.webViewLink ?? null,
  } satisfies GoogleDriveFolderMetadata
}

export async function createOrReuseTenantRootFolder(
  accessToken: string,
  folderName: string,
) {
  const existing = await findRootFolderByName(accessToken, folderName)
  if (existing) {
    return { folder: existing, created: false }
  }

  const folder = await createDriveFolder(accessToken, folderName, 'root')
  const metadata = await getDriveFolderMetadata(accessToken, folder.id)
  return { folder: metadata, created: true }
}

export async function ensurePartnerCommunicationUploadFolder(
  accessToken: string,
  input: {
    rootFolderId: string
    partnerId?: string | null
    partnerDisplayName?: string | null
    recordId: string
  },
) {
  const rootFolder = await getDriveFolderMetadata(accessToken, input.rootFolderId)
  const partnersFolder = await ensureChildFolder(accessToken, rootFolder.id, 'Partners')
  const communicationsFolder = await ensureChildFolder(accessToken, partnersFolder.folder.id, 'Partner Communications')
  const partnerFolderName = buildPartnerCommunicationUploadFolderName({
    partnerDisplayName: input.partnerDisplayName,
    partnerId: input.partnerId,
  })
  const partnerFolder = await ensureChildFolder(accessToken, communicationsFolder.folder.id, partnerFolderName)
  const recordFolder = await ensureChildFolder(accessToken, partnerFolder.folder.id, input.recordId)

  return {
    rootFolder,
    recordFolder: recordFolder.folder,
  } satisfies DriveUploadFolderTarget
}

export async function resolveDriveUploadFolderForRecord(
  accessToken: string,
  input: {
    rootFolderId: string
    recordType: DriveUploadRecordType
    recordId: string
    partnerId?: string | null
    partnerDisplayName?: string | null
  },
) {
  switch (input.recordType) {
    case 'partner_communication':
      return ensurePartnerCommunicationUploadFolder(accessToken, input)
    default:
      throw new Error(`Unsupported record type for Drive upload: ${input.recordType}`)
  }
}

export async function uploadFileToDrive(
  accessToken: string,
  input: {
    file: File
    folderId: string
    fileName: string
    mimeType: string
  },
) {
  const boundary = `serenius_${randomBytes(12).toString('hex')}`
  const metadata = {
    name: input.fileName,
    parents: [input.folderId],
    mimeType: input.mimeType,
  }

  const metadataPart = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    'utf8',
  )
  const fileBytes = Buffer.from(await input.file.arrayBuffer())
  const mediaPart = Buffer.from(
    `--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
    'utf8',
  )
  const footerPart = Buffer.from(`\r\n--${boundary}--`, 'utf8')

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: Buffer.concat([metadataPart, mediaPart, fileBytes, footerPart]),
  })

  const payload = await response.json().catch(() => null) as {
    id?: string
    name?: string
    mimeType?: string
    size?: string
    webViewLink?: string
    webContentLink?: string
    error?: { message?: string }
  } | null

  if (!response.ok || !payload?.id || !payload?.name) {
    const message = payload?.error?.message || `Google Drive upload failed (${response.status}).`
    throw new Error(message)
  }

  return {
    id: payload.id,
    name: payload.name,
    mimeType: payload.mimeType ?? input.mimeType,
    size: payload.size ?? null,
    webViewLink: payload.webViewLink ?? null,
    webContentLink: payload.webContentLink ?? null,
  }
}

export async function fetchGoogleDriveFileBytes(accessToken: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const buffer = await response.arrayBuffer()

  if (!response.ok) {
    const message = `Google Drive file download failed (${response.status}).`
    throw new Error(message)
  }

  return {
    bytes: Buffer.from(buffer),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  }
}

export async function makeDriveFilePublic(accessToken: string, fileId: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
      allowFileDiscovery: false,
    }),
  })

  const payload = await response.json().catch(() => null) as {
    id?: string
    error?: { message?: string }
  } | null

  if (!response.ok || !payload?.id) {
    const message = payload?.error?.message || `Unable to make Google Drive file public (${response.status}).`
    throw new Error(message)
  }

  return {
    id: payload.id,
  }
}

export function buildGoogleDriveRenderableImageUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
}

export async function prepareSereniusFolderStructure(
  accessToken: string,
  rootFolderId: string,
) {
  const rootFolder = await getDriveFolderMetadata(accessToken, rootFolderId)
  const partners = await ensureChildFolder(accessToken, rootFolder.id, 'Partners')
  const partnerCommunications = await ensureChildFolder(accessToken, partners.folder.id, 'Partner Communications')
  const partnerInKindGifts = await ensureChildFolder(accessToken, partners.folder.id, 'Partner In-Kind Gifts')
  const partnerStatements = await ensureChildFolder(accessToken, partners.folder.id, 'Partner Statements')

  return {
    rootFolder,
    folders: [
      {
        key: 'partners' as const,
        displayName: 'Partners',
        providerFolderId: partners.folder.id,
        created: partners.created,
      },
      {
        key: 'partner_communications' as const,
        displayName: 'Partner Communications',
        providerFolderId: partnerCommunications.folder.id,
        created: partnerCommunications.created,
      },
      {
        key: 'partner_inkind_gifts' as const,
        displayName: 'Partner In-Kind Gifts',
        providerFolderId: partnerInKindGifts.folder.id,
        created: partnerInKindGifts.created,
      },
      {
        key: 'partner_statements' as const,
        displayName: 'Partner Statements',
        providerFolderId: partnerStatements.folder.id,
        created: partnerStatements.created,
      },
    ] satisfies GoogleDrivePreparedFolder[],
  }
}
