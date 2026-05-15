import { createHash, randomBytes } from 'node:crypto'
import type { createSupabaseServiceClient } from '@/lib/supabase-service'

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

export type SuppressionType =
  | 'unsubscribed'
  | 'manually_suppressed'
  | 'bounced'
  | 'complained'
  | 'invalid_email'

export type CreateEmailOptOutTokenParams = {
  supabase: ServiceClient
  tenantId: string
  email: string
  partnerContactId?: string | null
  partnerEmailId?: string | null
  suppressionType?: SuppressionType
  expiresAt?: string | null
  baseUrl?: string
}

export type CreateEmailOptOutTokenResult = {
  tokenId: string
  rawToken: string
  tokenHash: string
  preferenceUrl: string
}

const MAX_RETRIES = 3

function generateRawToken(): string {
  // 32 random bytes → 64-char hex string; URL-safe, no padding
  return randomBytes(32).toString('hex')
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Generates a per-recipient opt-out token, stores only its sha256 hash in
 * email_opt_out_tokens, and returns the public preference page URL.
 *
 * Raw token is returned to the caller (for URL construction) but never stored.
 * Caller must use a service-role client — this table has superadmin-only RLS.
 *
 * Intended for live send use only. Test sends must NOT call this function.
 */
export async function createEmailOptOutToken(
  params: CreateEmailOptOutTokenParams,
): Promise<CreateEmailOptOutTokenResult> {
  const {
    supabase,
    tenantId,
    email,
    partnerContactId = null,
    partnerEmailId = null,
    suppressionType = 'unsubscribed',
    expiresAt = null,
    baseUrl,
  } = params

  if (!tenantId?.trim()) {
    throw new Error('createEmailOptOutToken: tenantId is required.')
  }
  if (!email?.trim()) {
    throw new Error('createEmailOptOutToken: email is required.')
  }

  let lastError: string | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)

    const { data, error } = await supabase
      .from('email_opt_out_tokens')
      .insert({
        tenant_id: tenantId,
        email: email.trim(),
        partner_contact_id: partnerContactId,
        partner_email_id: partnerEmailId,
        token_hash: tokenHash,
        suppression_type: suppressionType,
        expires_at: expiresAt,
        used_at: null,
      })
      .select('id')
      .single()

    if (!error && data) {
      const path = `/mail/preferences/${rawToken}`
      const preferenceUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path
      return { tokenId: data.id as string, rawToken, tokenHash, preferenceUrl }
    }

    // Retry only on unique constraint violation (token_hash collision — extremely unlikely)
    if (error.code === '23505') {
      lastError = `Attempt ${attempt + 1}: token_hash collision.`
      continue
    }

    // Any other DB error is surfaced immediately — do not swallow
    throw new Error(`createEmailOptOutToken: DB insert failed — ${error.message}`)
  }

  throw new Error(
    `createEmailOptOutToken: Failed to generate a unique token after ${MAX_RETRIES} attempts. ${lastError ?? ''}`.trim(),
  )
}
