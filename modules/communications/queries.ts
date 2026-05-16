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
    { data: templates },
    { data: brandSettings },
    { data: emailAssets },
  ] = await Promise.all([
    supabase
      .from('organization_mail_settings')
      .select(
        'id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode, campaign_live_send_authorized',
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
        'id, tenant_id, knack_id, knack_email_id, sending_status, message_status, communication_type, email_style, sent_type, segment, campaign_version, subject, message, message_raw_html, html_file_name, html_file_url, media_attachments, number_of_attachments, delivery_datetime, email_sent_at, total_emails_sent, sent_to_bot, original_opens, total_touches, clear_partner_emails, design_json, created_by, created_at, updated_at, deleted_at, template_id',
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
        'id, tenant_id, partner_contact_id, partner_email_id, email, suppression_type, source, reason, suppressed_at, restored_at, restored_by, restore_reason',
      )
      .eq('tenant_id', tenant.org.id),
    supabase
      .from('communication_email_templates')
      .select(
        'id, tenant_id, name, description, template_type, status, is_default, email_style, subject_default, preheader_default, html_template, plain_text_template, design_json, thumbnail_url, created_by, created_at, updated_at, deleted_at',
      )
      .eq('tenant_id', tenant.org.id)
      .order('name'),
    supabase
      .from('communication_email_brand_settings')
      .select(
        'id, tenant_id, logo_url, preference_page_logo_url, logo_width, header_html, footer_html, primary_color, accent_color, button_color, button_text_color, background_color, text_color, default_font, heading_font, body_font, default_signature, default_donation_url, preference_center_url, social_links, organization_name, mailing_address, city, state, zip, country, phone, website_url, unsubscribe_text, footer_background_color, footer_text_color, footer_link_color, footer_font_size, footer_divider_enabled, footer_divider_color, preference_page_background_color, preference_card_background_color, preference_text_color, preference_button_color, preference_button_text_color, preference_logo_background_color, theme_color_1, theme_color_2, theme_color_3, theme_color_4, theme_color_5, created_by, created_at, updated_at',
      )
      .eq('tenant_id', tenant.org.id)
      .maybeSingle(),
    supabase
      .from('communication_email_assets')
      .select(
        'id, tenant_id, asset_type, file_name, original_file_name, public_url, mime_type, file_size_bytes, width, height, alt_text, created_at, updated_at',
      )
      .eq('tenant_id', tenant.org.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
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
    templates: (templates ?? []) as CommunicationsPageData['templates'],
    brandSettings: (brandSettings ?? null) as CommunicationsPageData['brandSettings'],
    emailAssets: (emailAssets ?? []) as CommunicationsPageData['emailAssets'],
  }
}
