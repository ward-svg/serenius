import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import ConfirmForm from './ConfirmForm'

export const metadata: Metadata = {
  title: 'Email Preferences — Serenius',
  robots: { index: false, follow: false },
}

// Accepts only 6-digit hex; returns fallback for null/empty/invalid values.
function safeHex(value: string | null | undefined, fallback: string): string {
  if (!value?.trim()) return fallback
  return /^#[0-9a-fA-F]{6}$/i.test(value.trim()) ? value.trim() : fallback
}

type TokenState =
  | { status: 'not_found' }
  | { status: 'expired'; tenantId: string }
  | { status: 'already_used'; tenantId: string; email: string }
  | {
      status: 'valid'
      tenantId: string
      email: string
      partnerContactId: string | null
      partnerEmailId: string | null
    }

type TenantContext = {
  orgName: string
  logoUrl: string | null
  // Resolved colors — all safe hex values, fallbacks already applied
  pageBackground: string
  cardBackground: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  logoBackground: string
  contactName: string | null
  campaignSubject: string | null
}

async function lookupToken(rawToken: string): Promise<TokenState> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const supabase = createSupabaseServiceClient()

  const { data: token, error } = await supabase
    .from('email_opt_out_tokens')
    .select(
      'id, tenant_id, partner_contact_id, partner_email_id, email, expires_at, used_at, suppression_type',
    )
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !token) return { status: 'not_found' }

  if (token.used_at) {
    return { status: 'already_used', tenantId: token.tenant_id, email: token.email ?? '' }
  }

  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    return { status: 'expired', tenantId: token.tenant_id }
  }

  return {
    status: 'valid',
    tenantId: token.tenant_id,
    email: token.email ?? '',
    partnerContactId: token.partner_contact_id ?? null,
    partnerEmailId: token.partner_email_id ?? null,
  }
}

async function loadTenantContext(
  tenantId: string,
  partnerContactId: string | null,
  partnerEmailId: string | null,
): Promise<TenantContext> {
  const supabase = createSupabaseServiceClient()

  const [orgResult, brandResult, contactResult, campaignResult] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', tenantId).maybeSingle(),
    supabase
      .from('communication_email_brand_settings')
      .select(
        'organization_name, logo_url, background_color, text_color, primary_color, button_color, button_text_color, preference_page_background_color, preference_card_background_color, preference_text_color, preference_button_color, preference_button_text_color, preference_logo_background_color',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    partnerContactId
      ? supabase
          .from('partner_contacts')
          .select('display_name')
          .eq('id', partnerContactId)
          .eq('tenant_id', tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    partnerEmailId
      ? supabase
          .from('partner_emails')
          .select('subject')
          .eq('id', partnerEmailId)
          .eq('tenant_id', tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const b = brandResult.data
  const orgName =
    b?.organization_name?.trim() || orgResult.data?.name?.trim() || 'this organization'

  // Preference-page color fallback chains — preference_* fields take priority,
  // then existing brand colors, then hardcoded safe defaults.
  const pageBackground = safeHex(
    b?.preference_page_background_color,
    safeHex(b?.background_color, '#f9fafb'),
  )
  const cardBackground = safeHex(b?.preference_card_background_color, '#ffffff')
  const textColor = safeHex(
    b?.preference_text_color,
    safeHex(b?.text_color, '#111827'),
  )
  const buttonColor = safeHex(
    b?.preference_button_color,
    safeHex(b?.button_color, safeHex(b?.primary_color, '#3d5a80')),
  )
  const buttonTextColor = safeHex(
    b?.preference_button_text_color,
    safeHex(b?.button_text_color, '#ffffff'),
  )
  const logoBackground = safeHex(
    b?.preference_logo_background_color,
    safeHex(b?.primary_color, '#111827'),
  )

  return {
    orgName,
    logoUrl: b?.logo_url ?? null,
    pageBackground,
    cardBackground,
    textColor,
    buttonColor,
    buttonTextColor,
    logoBackground,
    contactName: contactResult.data?.display_name ?? null,
    campaignSubject: campaignResult.data?.subject ?? null,
  }
}

function LogoArea({
  logoUrl,
  orgName,
  logoBackground,
}: {
  logoUrl: string
  orgName: string
  logoBackground: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: logoBackground,
        borderRadius: 10,
        padding: '18px 24px',
        width: '100%',
        maxWidth: 348,
        minHeight: 126,
        boxSizing: 'border-box' as const,
        marginBottom: 12,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={orgName}
        style={{ maxHeight: 90, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  )
}

function PoweredBy() {
  return (
    <div
      style={{
        marginTop: 28,
        paddingTop: 14,
        borderTop: '1px solid #f3f4f6',
        fontSize: 11,
        color: '#d1d5db',
        textAlign: 'center' as const,
      }}
    >
      Powered by Serenius
    </div>
  )
}

interface CardProps {
  children: React.ReactNode
  logoUrl?: string | null
  orgName?: string
  textColor?: string
  pageBackground?: string
  cardBackground?: string
  logoBackground?: string
}

function Card({
  children,
  logoUrl,
  orgName,
  textColor = '#111827',
  pageBackground = '#f9fafb',
  cardBackground = '#ffffff',
  logoBackground = '#111827',
}: CardProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: pageBackground,
        padding: 24,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: cardBackground,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '40px 36px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            marginBottom: orgName ? 16 : 20,
            fontSize: 11,
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.08em',
          }}
        >
          Email Preferences
        </div>

        {/* Tenant identity area — logo tile + org name */}
        {orgName && (
          <div style={{ marginBottom: 20 }}>
            {logoUrl && (
              <LogoArea logoUrl={logoUrl} orgName={orgName} logoBackground={logoBackground} />
            )}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: textColor,
                marginTop: logoUrl ? 6 : 0,
              }}
            >
              {orgName}
            </div>
          </div>
        )}

        {children}
        <PoweredBy />
      </div>
    </div>
  )
}

function StaticMessage({
  heading,
  body,
  textColor = '#111827',
}: {
  heading: string
  body: string
  textColor?: string
}) {
  return (
    <>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: textColor,
          marginBottom: 12,
          lineHeight: 1.3,
        }}
      >
        {heading}
      </h1>
      <p style={{ fontSize: 14, color: textColor, lineHeight: 1.65, margin: 0 }}>{body}</p>
    </>
  )
}

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: rawToken } = await params

  if (!rawToken?.trim()) {
    return (
      <Card>
        <StaticMessage
          heading="Invalid link."
          body="This unsubscribe link is not recognized. It may have been copied incorrectly. Please contact the organization directly."
        />
      </Card>
    )
  }

  const tokenState = await lookupToken(rawToken.trim())

  if (tokenState.status === 'not_found') {
    return (
      <Card>
        <StaticMessage
          heading="Invalid link."
          body="This unsubscribe link is not recognized. It may have been copied incorrectly. Please contact the organization directly."
        />
      </Card>
    )
  }

  if (tokenState.status === 'expired') {
    const ctx = await loadTenantContext(tokenState.tenantId, null, null)
    return (
      <Card
        logoUrl={ctx.logoUrl}
        orgName={ctx.orgName}
        textColor={ctx.textColor}
        pageBackground={ctx.pageBackground}
        cardBackground={ctx.cardBackground}
        logoBackground={ctx.logoBackground}
      >
        <StaticMessage
          heading="This link has expired."
          body="This unsubscribe link has expired. Please contact the organization directly to update your preferences."
          textColor={ctx.textColor}
        />
      </Card>
    )
  }

  if (tokenState.status === 'already_used') {
    const ctx = await loadTenantContext(tokenState.tenantId, null, null)
    return (
      <Card
        logoUrl={ctx.logoUrl}
        orgName={ctx.orgName}
        textColor={ctx.textColor}
        pageBackground={ctx.pageBackground}
        cardBackground={ctx.cardBackground}
        logoBackground={ctx.logoBackground}
      >
        <StaticMessage
          heading="Already unsubscribed."
          body="Your email address has already been unsubscribed. No further action is needed."
          textColor={ctx.textColor}
        />
      </Card>
    )
  }

  const ctx = await loadTenantContext(
    tokenState.tenantId,
    tokenState.partnerContactId,
    tokenState.partnerEmailId,
  )

  return (
    <Card
      logoUrl={ctx.logoUrl}
      orgName={ctx.orgName}
      textColor={ctx.textColor}
      pageBackground={ctx.pageBackground}
      cardBackground={ctx.cardBackground}
      logoBackground={ctx.logoBackground}
    >
      <ConfirmForm
        rawToken={rawToken.trim()}
        orgName={ctx.orgName}
        recipientEmail={tokenState.email}
        buttonColor={ctx.buttonColor}
        buttonTextColor={ctx.buttonTextColor}
        textColor={ctx.textColor}
      />
    </Card>
  )
}
