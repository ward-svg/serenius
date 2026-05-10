import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface UserProfileRow {
  tenant_id: string | null
}

interface OrganizationRow {
  slug: string
}

export async function resolveLandingPathForCurrentUser(
  supabase?: SupabaseClient,
): Promise<string> {
  const client = supabase ?? await createSupabaseServerClient()
  const [{ data: userResult }, superRes] = await Promise.all([
    client.auth.getUser(),
    client.rpc('has_role', { role_name: 'superadmin' }),
  ])

  const user = userResult.user
  if (!user) {
    return '/login'
  }

  const { data: profile } = await client
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle<UserProfileRow>()

  if (profile?.tenant_id) {
    const { data: organization } = await client
      .from('organizations')
      .select('slug')
      .eq('id', profile.tenant_id)
      .maybeSingle<OrganizationRow>()

    if (organization?.slug) {
      return `/${organization.slug}/partners`
    }
  }

  if (superRes.data === true) {
    return '/platform-admin'
  }

  return '/login?error=access_denied'
}
