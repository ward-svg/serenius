import { Suspense } from 'react'
import SetupPage from './SetupPage'

export default async function SetupRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    }>
      <SetupPage tenantSlug={slug} />
    </Suspense>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `Setup — ${slug} | Serenius` }
}
