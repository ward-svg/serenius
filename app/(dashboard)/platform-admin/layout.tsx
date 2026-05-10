import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: activeOrg }, { data: anyOrg }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('id, name, slug')
      .order('name')
      .limit(1)
      .maybeSingle(),
  ])

  const currentTenantSlug = activeOrg?.slug ?? anyOrg?.slug ?? 'wellspring'
  const currentTenantId = activeOrg?.id ?? anyOrg?.id ?? null
  const orgName = activeOrg?.name ?? anyOrg?.name ?? 'Serenius'
  const brandingRes = currentTenantId
    ? await supabase
      .from('organization_branding')
      .select('app_name, logo_url')
      .eq('tenant_id', currentTenantId)
      .maybeSingle<{ app_name: string | null; logo_url: string | null }>()
    : { data: null as { app_name: string | null; logo_url: string | null } | null }

  const appName = brandingRes.data?.app_name ?? 'Serenius'
  const logoUrl = brandingRes.data?.logo_url ?? null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        orgName={orgName}
        appName={appName}
        slug={currentTenantSlug}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar orgName={orgName} slug={currentTenantSlug} logoUrl={logoUrl} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
