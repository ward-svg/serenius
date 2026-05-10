import { createSupabaseServerClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import PartnerDetailClient from '@/modules/partners/components/PartnerDetailClient'
import type { Partner, PartnerContact } from '@/modules/partners/types'

export const revalidate = 0

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const supabase = await createSupabaseServerClient()

  const [
    { data: partnerData },
    { data: contacts },
    { data: lifetimeGiving },
    { data: ytdGiving },
    { data: firstGift },
  ] = await Promise.all([
    supabase.from('partners').select('*').eq('id', id).single(),
    supabase.from('partner_contacts').select('*').eq('partner_id', id).order('relationship'),
    supabase.from('financial_gifts').select('amount').eq('partner_id', id),
    supabase.from('financial_gifts').select('amount').eq('partner_id', id).eq('giving_year', 2026),
    supabase.from('financial_gifts').select('date_given').eq('partner_id', id).order('date_given', { ascending: true }).limit(1).single(),
  ])

  if (!partnerData) notFound()

  const { data: staffData } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .eq('tenant_id', partnerData.tenant_id)
    .order('full_name')

  const { data: settingsData } = await supabase
    .from('organization_settings')
    .select('google_maps_api_key')
    .eq('tenant_id', partnerData.tenant_id)
    .maybeSingle()

  const totalGiving =
    lifetimeGiving?.reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0

  const givingYTD =
    ytdGiving?.reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0

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
      initialPartner={partnerData as Partner}
      contacts={(contacts ?? []) as PartnerContact[]}
      staff={(staffData ?? []) as { id: string; full_name: string | null; email: string | null }[]}
      createdByName={createdByName}
      totalGiving={totalGiving}
      givingYTD={givingYTD}
      firstGiftDate={firstGiftDate}
      googleMapsApiKey={settingsData?.google_maps_api_key ?? null}
    />
  )
}
