import { getTenantBySlug } from '@/lib/tenant'
import TenantProvider from '@/components/TenantProvider'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: userResult } = await supabase.auth.getUser()

  if (!userResult.user) {
    redirect('/login')
  }

  const [{ data: superRes }, { data: profileRes }] = await Promise.all([
    supabase.rpc('has_role', { role_name: 'superadmin' }),
    supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('user_id', userResult.user.id)
      .maybeSingle<{ tenant_id: string | null }>(),
  ])

  const isSuperAdmin = superRes === true
  const tenantProfileId = profileRes?.tenant_id ?? null

  if (!isSuperAdmin && tenantProfileId !== tenant.org.id) {
    if (tenantProfileId) {
      const { data: ownOrg } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', tenantProfileId)
        .maybeSingle<{ slug: string }>()

      if (ownOrg?.slug) {
        redirect(`/${ownOrg.slug}/partners`)
      }
    }

    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="section-card max-w-md p-6">
          <h1 className="section-title">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            You do not have access to this tenant.
          </p>
        </div>
      </div>
    )
  }

  return (
    <TenantProvider config={tenant}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          orgName={tenant.org.name}
          appName={tenant.branding.app_name}
          slug={slug}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar orgName={tenant.org.name} slug={slug} logoUrl={tenant.branding.logo_url} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
