import { supabase } from '@/lib/supabase'
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

  const [
    { data: allPartners },
    { data: staffData },
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
      .is('partner_id', null)
      .eq('email_segment', 'Staff')
      .order('name_last'),
  ])

  const partners = (allPartners ?? []) as Partner[]
  const staff = (staffData ?? []) as PartnerContact[]

  const activeDonors = partners.filter(p => p.partner_status === 'Active' && p.relationship_type === 'Donor')
  const prospects = partners.filter(p => p.partner_status === 'Active' && p.relationship_type === 'Prospect')
  const pastPartners = partners.filter(p => p.partner_status === 'Past')

  const stats = {
    total: partners.length,
    activeDonors: activeDonors.length,
    prospects: prospects.length,
    totalGiving: partners.reduce((s, p) => s + (p.total_giving ?? 0), 0),
    giving2026: partners.reduce((s, p) => s + (p.giving_2026 ?? 0), 0),
  }

   return (
    <PartnersClient
      slug={slug}
      orgId={tenant?.org.id ?? null}
      stats={stats}
      activeDonors={activeDonors}
      prospects={prospects}
      pastPartners={pastPartners}
      staff={staff}
    />
  )
}
