import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getTenantBySlug } from '@/lib/tenant'
import type {
  Partner,
  PartnerContact,
  MonthlyPartnerPledge,
} from './types'

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
monthlyPledges: MonthlyPartnerPledge[]
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
  { data: pledgeData },
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

  supabase
    .from('pledges')
    .select('id, partner_id, pledge_type, status, frequency, pledge_amount, annualized_value, start_date')
    .eq('tenant_id', orgId)
    .eq('status', 'Active')
    .order('start_date'),
])

  const partners = (allPartners ?? []) as Partner[]
  const staff = (staffData ?? []) as PartnerContact[]
  const partnerNameById = new Map(
  partners.map(partner => [partner.id, partner.display_name])
)

const monthlyPledges = (pledgeData ?? [])
  .filter(pledge => pledge.frequency === 'Monthly')
  .map(pledge => ({
    id: pledge.id,
    partner_id: pledge.partner_id,
    partner_name: partnerNameById.get(pledge.partner_id) ?? 'Unknown Partner',
    pledge_type: pledge.pledge_type,
    frequency: pledge.frequency,
    pledge_amount: pledge.pledge_amount ?? 0,
    annualized_value:
      pledge.annualized_value ??
      ((pledge.pledge_amount ?? 0) * 12),
    start_date: pledge.start_date,
  })) as MonthlyPartnerPledge[]

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
    monthlyPledges,
    givingByPartner,
  }
}