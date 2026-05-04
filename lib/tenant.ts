import { supabase } from './supabase'

export interface OrganizationBranding {
  tenant_id: string
  app_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  alert_color: string
  sidebar_color: string
  font_heading: string
  font_body: string
  dark_mode_enabled: boolean
  custom_css: string | null
}

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
}

export interface TenantConfig {
  org: Organization
  branding: OrganizationBranding
}

export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    console.error('Org lookup failed:', orgError)
    return null
  }

  const { data: branding, error: brandingError } = await supabase
    .from('organization_branding')
    .select('*')
    .eq('tenant_id', org.id)
    .single()

  if (brandingError || !branding) {
    console.error('Branding lookup failed:', brandingError)
    return null
  }

  return { org, branding }
}

export const DEFAULT_TENANT_SLUG = 'wellspring'
