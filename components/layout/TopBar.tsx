import { logout } from '@/lib/actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface TopBarProps {
  orgName: string
  slug: string
  logoUrl?: string | null
}

export default async function TopBar({ orgName, slug, logoUrl }: TopBarProps) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const displayEmail = user?.email ?? ''
  const logoSrc = logoUrl ? `/api/branding/logo?tenantSlug=${encodeURIComponent(slug)}` : null

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={orgName}
            className="max-h-[32px] max-w-[160px] object-contain"
            style={{ display: 'block' }}
          />
        ) : (
          <span className="text-sm font-semibold text-gray-800">{orgName}</span>
        )}
        <span className="text-gray-300">·</span>
        <span className="text-sm text-gray-500">{slug}</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500 hidden sm:block">{displayEmail}</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5
                       rounded-lg hover:bg-gray-100 border border-transparent hover:border-gray-200"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
