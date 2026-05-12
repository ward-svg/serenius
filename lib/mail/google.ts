import { createHash, createHmac, randomBytes } from 'node:crypto'

export const GOOGLE_MAIL_OAUTH_COOKIE_NAME = 'serenius_google_mail_oauth'

export const GOOGLE_MAIL_CONNECT_SCOPE = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
].join(' ')

export interface GoogleMailOAuthStatePayload {
  nonce: string
  integrationType: 'mail'
  tenantId: string
  tenantSlug: string
  userId: string
  returnTo: string
  issuedAt: string
}

export interface GoogleMailOAuthCookiePayload extends GoogleMailOAuthStatePayload {
  codeVerifier: string
}

export interface GoogleMailTokens {
  accessToken: string
  refreshToken: string | null
  tokenType: string | null
  scope: string | null
  expiryDate: string | null
  idToken: string | null
}

export interface GoogleMailAccountInfo {
  email: string | null
  name: string | null
}

function getGoogleClientSecret() {
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!secret) {
    throw new Error('Missing GOOGLE_CLIENT_SECRET.')
  }
  return secret
}

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('Missing GOOGLE_CLIENT_ID.')
  }
  return clientId
}

export function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

export function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sanitizeHeaderValue(value: string | null | undefined) {
  return value?.replace(/[\r\n]+/g, ' ').trim() ?? ''
}

export function createGoogleMailOAuthState(input: {
  tenantId: string
  tenantSlug: string
  userId: string
  returnTo: string
}) {
  const nonce = randomBytes(16).toString('base64url')
  const codeVerifier = randomBytes(32).toString('base64url')
  const issuedAt = new Date().toISOString()

  const payload: GoogleMailOAuthStatePayload = {
    nonce,
    integrationType: 'mail',
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    userId: input.userId,
    returnTo: input.returnTo,
    issuedAt,
  }

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload))
  const signature = createHmac('sha256', getGoogleClientSecret())
    .update(payloadBase64)
    .digest('base64url')

  const cookiePayload: GoogleMailOAuthCookiePayload = {
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

export function parseGoogleMailOAuthState(state: string | null) {
  if (!state) return null

  const [payloadBase64, signature] = state.split('.')
  if (!payloadBase64 || !signature) return null

  const expectedSignature = createHmac('sha256', getGoogleClientSecret())
    .update(payloadBase64)
    .digest('base64url')

  if (signature !== expectedSignature) return null

  try {
    return JSON.parse(base64UrlDecode(payloadBase64)) as GoogleMailOAuthStatePayload
  } catch {
    return null
  }
}

export function parseGoogleMailOAuthCookie(value: string | null) {
  if (!value) return null

  try {
    return JSON.parse(base64UrlDecode(value)) as GoogleMailOAuthCookiePayload
  } catch {
    return null
  }
}

export function buildGoogleMailOAuthUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', GOOGLE_MAIL_CONNECT_SCOPE)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent select_account')
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', input.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export function buildPkceCodeChallenge(codeVerifier: string) {
  return createHash('sha256').update(codeVerifier).digest('base64url')
}

async function exchangeGoogleTokenRequest(body: URLSearchParams) {
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
  } satisfies GoogleMailTokens
}

export async function exchangeGoogleMailCodeForTokens(input: {
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

  return exchangeGoogleTokenRequest(body)
}

export async function refreshGoogleMailAccessToken(input: {
  refreshToken: string
}) {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  })

  return exchangeGoogleTokenRequest(body)
}

export async function getGoogleMailAccountInfo(accessToken: string) {
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
  } satisfies GoogleMailAccountInfo
}

function buildGmailMessageHeaders(input: {
  to: string
  subject: string
  fromName: string | null
  fromEmail: string
  replyTo: string | null
}) {
  const headers = [
    `To: ${sanitizeHeaderValue(input.to)}`,
    `Subject: ${sanitizeHeaderValue(input.subject)}`,
    `From: ${sanitizeHeaderValue(input.fromName) ? `${sanitizeHeaderValue(input.fromName)} <${sanitizeHeaderValue(input.fromEmail)}>` : sanitizeHeaderValue(input.fromEmail)}`,
    input.replyTo ? `Reply-To: ${sanitizeHeaderValue(input.replyTo)}` : null,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="serenius_mail_boundary"',
  ].filter(Boolean) as string[]

  return headers.join('\r\n')
}

function buildGmailMultipartBody(input: { text: string; html: string }) {
  const boundary = 'serenius_mail_boundary'

  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    input.text,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    input.html,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

export function buildGmailRawMessage(input: {
  to: string
  subject: string
  fromName: string | null
  fromEmail: string
  replyTo: string | null
  text: string
  html: string
}) {
  const headers = buildGmailMessageHeaders(input)
  const body = buildGmailMultipartBody({ text: input.text, html: input.html })
  return base64UrlEncode(`${headers}\r\n\r\n${body}`)
}

export async function sendGmailMessage(input: {
  accessToken: string
  rawMessage: string
}) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: input.rawMessage }),
  })

  const payload = await response.json().catch(() => null) as {
    id?: string
    threadId?: string
    labelIds?: string[]
    error?: {
      message?: string
      code?: number
      status?: string
    }
  } | null

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.status ||
      `Gmail send failed (${response.status}).`
    throw new Error(message)
  }

  return {
    id: payload?.id ?? null,
    threadId: payload?.threadId ?? null,
    labelIds: payload?.labelIds ?? [],
  }
}

