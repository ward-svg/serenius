import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getTenantBySlug } from '@/lib/tenant'
import type { CommunicationsPageData } from './types'

export async function getCommunicationsPageData(
  slug: string,
): Promise<CommunicationsPageData | null> {
  const tenant = await getTenantBySlug(slug)

  if (!tenant) {
    return null
  }

  const supabase = await createSupabaseServerClient()

  const [
    { data: mailSettings },
    { data: testRecipients },
    { data: campaigns },
    { data: opens },
    { data: contacts },
    { data: suppressions },
  ] = await Promise.all([
    supabase
      .from('organization_mail_settings')
      .select(
        'id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode',
      )
      .eq('tenant_id', tenant.org.id)
      .maybeSingle(),
    supabase
      .from('organization_mail_test_recipients')
      .select(
        'id, tenant_id, email, display_name, is_active, notes, created_by, created_at, updated_at',
      )
      .eq('tenant_id', tenant.org.id)
      .order('display_name', { ascending: true }),
    supabase
      .from('partner_emails')
      .select(
        'id, tenant_id, knack_id, knack_email_id, sending_status, message_status, communication_type, email_style, sent_type, segment, campaign_version, subject, message, message_raw_html, html_file_name, html_file_url, media_attachments, number_of_attachments, delivery_datetime, email_sent_at, total_emails_sent, sent_to_bot, original_opens, total_touches, clear_partner_emails, created_by, created_at, updated_at',
      )
      .eq('tenant_id', tenant.org.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('partner_email_opens')
      .select('id, tenant_id, partner_email_id, open_count, first_opened, last_opened, sent_at')
      .eq('tenant_id', tenant.org.id)
      .order('sent_at', { ascending: false }),
    supabase
      .from('partner_contacts')
      .select(
        'id, display_name, first_name, last_name, primary_email, email_segment, campaign_version',
      )
      .eq('tenant_id', tenant.org.id),
    supabase
      .from('partner_email_suppressions')
      .select(
        'id, tenant_id, partner_contact_id, email, suppression_type, source, reason, suppressed_at',
      )
      .eq('tenant_id', tenant.org.id),
  ])

  return {
    slug,
    orgId: tenant.org.id,
    orgName: tenant.org.name,
    mailSettings: (mailSettings ?? null) as CommunicationsPageData['mailSettings'],
    testRecipients: (testRecipients ?? []) as CommunicationsPageData['testRecipients'],
    campaigns: (campaigns ?? []) as CommunicationsPageData['campaigns'],
    opens: (opens ?? []) as CommunicationsPageData['opens'],
    contacts: (contacts ?? []) as CommunicationsPageData['contacts'],
    suppressions: (suppressions ?? []) as CommunicationsPageData['suppressions'],
  }
}
