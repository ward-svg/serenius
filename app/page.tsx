import Link from 'next/link'
import { redirect } from 'next/navigation'
import { resolveLandingPathForCurrentUser } from '@/lib/auth/landing'

export default async function Home() {
  const landingPath = await resolveLandingPathForCurrentUser()

  if (landingPath === '/login?error=access_denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="section-card max-w-md p-6">
          <h1 className="section-title">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account is not assigned to a tenant.
          </p>
          <div className="mt-6">
            <Link href="/login" className="btn btn-ghost">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  redirect(landingPath)
}
