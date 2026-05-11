import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { PLATFORM_THEME } from '@/lib/platform-theme'

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

  const currentTenantSlug = 'platform-admin'
  const orgName = 'Serenius Platform'
  const appName = PLATFORM_THEME.branding.app_name
  const logoUrl = PLATFORM_THEME.branding.logo_url

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        orgName={orgName}
        appName={appName}
        slug={currentTenantSlug}
        platformMode
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar orgName={orgName} slug={currentTenantSlug} logoUrl={logoUrl} platformMode />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
