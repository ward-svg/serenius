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

  const [{ data: partnerData }, { data: contacts }, { data: lifetimeGiving }, { data: ytdGiving }, { data: firstGift }] = await Promise.all([
    supabase.from('partners').select('*').eq('id', id).single(),
    supabase.from('partner_contacts').select('*').eq('partner_id', id).order('relationship'),
    supabase.from('financial_gifts').select('amount').eq('partner_id', id),
    supabase.from('financial_gifts').select('amount').eq('partner_id', id).eq('giving_year', 2026),
    supabase.from('financial_gifts').select('date_given').eq('partner_id', id).order('date_given', { ascending: true }).limit(1).single(),
  ])

  if (!partnerData) notFound()

  const totalGiving = lifetimeGiving?.reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0
  const givingYTD = ytdGiving?.reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0
  const firstGiftDate = firstGift?.date_given ?? null

  let createdByName: string | null = null
  if (partnerData.created_by) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .eq('user_id', partnerData.created_by)
      .single()
    createdByName = profile?.full_name ?? profile?.email ?? null
  }

  return (
    <PartnerDetailClient
      slug={slug}
      partner={partnerData as Partner}
      contacts={(contacts ?? []) as PartnerContact[]}
      createdByName={createdByName}
      totalGiving={totalGiving}
      givingYTD={givingYTD}
      firstGiftDate={firstGiftDate}
    />
  )
}
