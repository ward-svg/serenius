import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getTenantBySlug } from '@/lib/tenant'
import type { Partner, PartnerContact } from '@/types/partners'

export interface PartnersPageData {
  slug: string
  orgId: string | null
  stats: {
    total: number
    activeDonors: number
    prospects: number
    totalGiving: number
    giving2026: number
  }
  activeDonors: Partner[]
  prospects: Partner[]
  pastPartners: Partner[]
  staff: PartnerContact[]
  givingByPartner: Record<string, { total: number; ytd: number }>
}

export async function getPartnersPageData(
  slug: string
): Promise<PartnersPageData> {
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

  const activeDonors = partners.filter(
    p =>
      p.partner_status === 'Active' &&
      p.relationship_type === 'Donor'
  )

  const prospects = partners.filter(
    p =>
      p.partner_status === 'Active' &&
      p.relationship_type === 'Prospect'
  )

  const pastPartners = partners.filter(
    p => p.partner_status === 'Past'
  )

  const totalGiving =
    givingData?.reduce(
      (sum, g) => sum + (g.amount ?? 0),
      0
    ) ?? 0

  const giving2026 =
    givingData
      ?.filter(g => g.giving_year === 2026)
      .reduce((sum, g) => sum + (g.amount ?? 0), 0) ?? 0

  const givingByPartner = (givingData ?? []).reduce(
    (map, g) => {
      const pid = g.partner_id

      if (!pid) return map

      if (!map[pid]) {
        map[pid] = {
          total: 0,
          ytd: 0,
        }
      }

      map[pid].total += g.amount ?? 0

      if (g.giving_year === 2026) {
        map[pid].ytd += g.amount ?? 0
      }

      return map
    },
    {} as Record<string, { total: number; ytd: number }>
  )

  return {
    slug,
    orgId,
    stats: {
      total: partners.length,
      activeDonors: activeDonors.length,
      prospects: prospects.length,
      totalGiving,
      giving2026,
    },
    activeDonors,
    prospects,
    pastPartners,
    staff,
    givingByPartner,
  }
}