import { Suspense } from 'react'
import SetupPage from './SetupPage'

function getSearchParamValue(
  value: string | string[] | undefined,
  fallback: string | null = null,
) {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function getStorageErrorMessage(storageError: string | null) {
  switch (storageError) {
    case 'missing_service_role_config':
      return 'Google Drive connection could not be completed because server storage configuration is missing.'
    case 'invalid_oauth_state':
      return 'Google Drive connection could not be completed. Please try again.'
    case 'missing_google_code':
      return 'Google did not return a valid authorization code. Please try again.'
    case 'token_exchange_failed':
      return 'Google Drive connection could not be completed during token exchange.'
    case 'google_account_lookup_failed':
      return 'Google Drive connection could not be completed while reading the connected account.'
    case 'credential_save_failed':
      return 'Google Drive connection could not be saved.'
    case 'storage_settings_update_failed':
      return 'Google Drive settings could not be updated.'
    case 'user_auth_failed':
      return 'Google Drive connection could not be completed because your session could not be verified.'
    case 'invalid_state':
      return 'Google Drive connection could not be completed. Please try again.'
    case 'unknown_oauth_error':
      return 'Google Drive connection could not be completed.'
    default:
      return 'Google Drive connection could not be completed.'
  }
}

const VALID_TABS = new Set([
  'organization',
  'integrations',
  'chart-of-accounts',
  'gift-categories',
  'users-roles',
  'modules',
])

export default async function SetupRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const storageNotice = getSearchParamValue(resolvedSearchParams.storage)
  const storageError = getSearchParamValue(resolvedSearchParams.storage_error)
  const initialTabParam = getSearchParamValue(resolvedSearchParams.tab)
  const parsedTab = VALID_TABS.has(initialTabParam ?? '') ? initialTabParam as 'organization' | 'integrations' | 'chart-of-accounts' | 'gift-categories' | 'users-roles' | 'modules' : 'organization'
  const initialTab = storageNotice || storageError ? 'integrations' : parsedTab

  const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  )

  const integrationNotice = storageNotice === 'connected'
    ? { type: 'success' as const, message: 'Google Drive connected successfully.' }
    : storageError
      ? { type: 'error' as const, message: storageError === 'invalid_state' || storageError === 'invalid_oauth_state'
        ? 'Google Drive connection could not be completed. Please try again.'
        : getStorageErrorMessage(storageError) }
      : null

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    }>
      <SetupPage
        tenantSlug={slug}
        initialTab={initialTab as 'organization' | 'integrations' | 'chart-of-accounts' | 'gift-categories' | 'users-roles' | 'modules'}
        googleOAuthConfigured={googleOAuthConfigured}
        integrationNotice={integrationNotice}
      />
    </Suspense>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `Setup — ${slug} | Serenius` }
}
