import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

export const metadata: Metadata = {
  title: 'Email Preferences — Serenius',
  robots: { index: false, follow: false },
}

type Outcome = 'success' | 'already_used' | 'expired' | 'not_found' | 'error'

async function redeemToken(rawToken: string): Promise<Outcome> {
  // Hash first — raw token never stored, logged, or compared directly
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const supabase = createSupabaseServiceClient()

  const { data: token, error: lookupError } = await supabase
    .from('email_opt_out_tokens')
    .select('id, tenant_id, partner_contact_id, partner_email_id, email, expires_at, used_at, suppression_type')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (lookupError || !token) return 'not_found'

  if (token.used_at) return 'already_used'

  if (token.expires_at && new Date(token.expires_at) < new Date()) return 'expired'

  const email = token.email?.trim()
  // Should never be empty (email is NOT NULL in schema) but guard defensively
  if (!email) return 'error'

  // Check for existing suppression — best-effort guard against duplicate writes
  // (primary deduplication is the used_at check above; this handles crash-recovery)
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

    if (suppressionError) return 'error'
  }

  // Mark token used — after suppression is written (suppression is the critical record)
  await supabase
    .from('email_opt_out_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', token.id)

  return 'success'
}

const MESSAGES: Record<Outcome, { heading: string; body: string }> = {
  success: {
    heading: 'You have been unsubscribed.',
    body: 'Your request has been processed. You will no longer receive campaign emails from this organization.',
  },
  already_used: {
    heading: 'Already unsubscribed.',
    body: 'This unsubscribe link has already been used. No further action is needed.',
  },
  expired: {
    heading: 'This link has expired.',
    body: 'This unsubscribe link has expired. Please contact the organization directly to update your preferences.',
  },
  not_found: {
    heading: 'Invalid link.',
    body: 'This unsubscribe link is not recognized. It may have been copied incorrectly. Please contact the organization directly.',
  },
  error: {
    heading: 'Something went wrong.',
    body: 'We could not complete this request. Please contact the organization directly.',
  },
}

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: rawToken } = await params
  const outcome: Outcome = rawToken?.trim() ? await redeemToken(rawToken.trim()) : 'not_found'
  const msg = MESSAGES[outcome]

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: 24,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '40px 36px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            marginBottom: 20,
            fontSize: 11,
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Email Preferences
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: '#111827',
            marginBottom: 12,
            lineHeight: 1.3,
          }}
        >
          {msg.heading}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, margin: 0 }}>
          {msg.body}
        </p>
      </div>
    </div>
  )
}
