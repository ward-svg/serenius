'use server'

import { createHash } from 'node:crypto'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

export type ConfirmResult = { ok: true } | { ok: false; error: string }

export async function confirmUnsubscribe(
  _prevState: ConfirmResult | null,
  formData: FormData,
): Promise<ConfirmResult> {
  const rawToken = (formData.get('token') as string | null)?.trim() ?? ''
  if (!rawToken) return { ok: false, error: 'Invalid request.' }

  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const supabase = createSupabaseServiceClient()

  const { data: token, error: lookupError } = await supabase
    .from('email_opt_out_tokens')
    .select(
      'id, tenant_id, partner_contact_id, partner_email_id, email, expires_at, used_at, suppression_type',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (lookupError || !token) return { ok: false, error: 'This link is not recognized.' }

  if (token.used_at) return { ok: true }

  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    return { ok: false, error: 'This link has expired. Please contact the organization directly.' }
  }

  const email = token.email?.trim()
  if (!email) return { ok: false, error: 'Unable to process this request.' }

  const { data: existing } = await supabase
    .from('partner_email_suppressions')
    .select('id')
    .eq('tenant_id', token.tenant_id)
    .ilike('email', email)
    .eq('suppression_type', token.suppression_type ?? 'unsubscribed')
    .is('restored_at', null)
    .maybeSingle()

  if (!existing) {
    const { error: suppressionError } = await supabase
      .from('partner_email_suppressions')
      .insert({
        tenant_id: token.tenant_id,
        partner_contact_id: token.partner_contact_id ?? null,
        partner_email_id: token.partner_email_id ?? null,
        email,
        suppression_type: token.suppression_type ?? 'unsubscribed',
        source: 'email_opt_out',
        reason: 'Recipient opted out via email link',
        suppressed_at: new Date().toISOString(),
      })

    if (suppressionError) {
      return { ok: false, error: 'Unable to process this request. Please try again.' }
    }
  }

  await supabase
    .from('email_opt_out_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)

  return { ok: true }
}
