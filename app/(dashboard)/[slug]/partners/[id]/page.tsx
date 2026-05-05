import { createSupabaseServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import PartnerDetailClient from '@/components/partners/PartnerDetailClient'
import type { Partner, PartnerContact } from '@/types/partners'

export const revalidate = 0

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const supabase = await createSupabaseServerClient()

  const [{ data: partner }, { data: contacts }] = await Promise.all([
    supabase.from('partners').select('*').eq('id', id).single(),
    supabase.from('partner_contacts').select('*').eq('partner_id', id).order('relationship'),
  ])

  if (!partner) notFound()

  return (
    <PartnerDetailClient
      slug={slug}
      partner={partner as Partner}
      contacts={(contacts ?? []) as PartnerContact[]}
    />
  )
}
