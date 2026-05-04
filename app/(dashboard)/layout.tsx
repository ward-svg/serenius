import { getTenantBySlug, DEFAULT_TENANT_SLUG } from '@/lib/tenant'
import TenantProvider from '@/components/TenantProvider'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenantBySlug(DEFAULT_TENANT_SLUG)

  const fallback = {
    org: { id: '', name: 'WellSpring Rescue', slug: 'wellspring', plan: 'pro', is_active: true },
    branding: {
      tenant_id: '',
      app_name: 'WellSpring CRM',
      logo_url: null,
      favicon_url: null,
      primary_color: '#3D5A80',
      secondary_color: '#98C1D9',
      accent_color: '#E0FBFC',
      alert_color: '#EE6C4D',
      sidebar_color: '#293241',
      font_heading: 'Inter',
      font_body: 'Inter',
      dark_mode_enabled: false,
      custom_css: null,
    },
  }

  const config = tenant ?? fallback

  return (
    <TenantProvider config={config}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar orgName={config.org.name} appName={config.branding.app_name} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar orgName={config.org.name} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
