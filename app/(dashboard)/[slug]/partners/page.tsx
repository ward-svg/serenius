import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getTenantBySlug } from '@/lib/tenant'
import PartnersClient from '@/components/partners/PartnersClient'
import type { Partner, PartnerContact } from '@/types/partners'

export const revalidate = 0

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Get tenant to find org id
  const tenant = await getTenantBySlug(slug)
  const orgId = tenant?.org.id ?? null
  const supabase = await createSupabaseServerClient()

  const [
    { data: allPartners },
    { data: staffData },
    { data: givingData },
  ] = await Promise.all([
    supabase
      .from('partners')
      .select('*')
      .eq('tenant_id', orgId)
      .order('display_name'),
    supabase
      .from('partner_contacts')
      .select('*')
      .eq('tenant_id', orgId)
      .eq('email_segment', 'Staff')
      .order('last_name'),
    supabase
      .from('financial_gifts')
      .select('partner_id, amount, giving_year')
      .eq('tenant_id', orgId),
  ])

  const partners = (allPartners ?? []) as Partner[]
  const staff = (staffData ?? []) as PartnerContact[]

  const activeDonors = partners.filter(p => p.partner_status === 'Active' && p.relationship_type === 'Donor')
  const prospects = partners.filter(p => p.partner_status === 'Active' && p.relationship_type === 'Prospect')
  const pastPartners = partners.filter(p => p.partner_status === 'Past')

  const totalGiving = givingData?.reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0
  const giving2026 = givingData?.filter(g => g.giving_year === 2026)
    .reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0

  const stats = {
    total: partners.length,
    activeDonors: activeDonors.length,
    prospects: prospects.length,
    totalGiving,
    giving2026,
  }

  const givingByPartner = (givingData ?? []).reduce((map, g) => {
    const pid = g.partner_id
    if (!pid) return map
    if (!map[pid]) map[pid] = { total: 0, ytd: 0 }
    map[pid].total += g.amount ?? 0
    if (g.giving_year === 2026) map[pid].ytd += g.amount ?? 0
    return map
  }, {} as Record<string, { total: number; ytd: number }>)

  return (
    <PartnersClient
      slug={slug}
      orgId={tenant?.org.id ?? null}
      stats={stats}
      activeDonors={activeDonors}
      prospects={prospects}
      pastPartners={pastPartners}
      staff={staff}
      givingByPartner={givingByPartner}
    />
  )
}
