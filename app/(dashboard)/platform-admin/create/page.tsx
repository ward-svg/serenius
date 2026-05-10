import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import PlatformTenantCreateForm from '@/components/platform-admin/PlatformTenantCreateForm'

export const revalidate = 0

export default async function CreateTenantPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: userResult }, superRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
  ])

  if (!userResult.user) {
    redirect('/login')
  }

  if (superRes.data !== true) {
    redirect('/platform-admin')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="section-card p-6">
        <div className="section-header">
          <div>
            <h1 className="section-title">Create Tenant</h1>
            <p className="section-subtitle">
              Create the organization and invite its first tenant admin.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <PlatformTenantCreateForm />
        </div>
      </div>
    </div>
  )
}
