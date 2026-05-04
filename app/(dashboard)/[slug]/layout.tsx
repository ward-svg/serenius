import { getTenantBySlug } from '@/lib/tenant'
import TenantProvider from '@/components/TenantProvider'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { notFound } from 'next/navigation'

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

  return (
    <TenantProvider config={tenant}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          orgName={tenant.org.name}
          appName={tenant.branding.app_name}
          slug={slug}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar orgName={tenant.org.name} slug={slug} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
