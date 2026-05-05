import { createSupabaseServerClient } from '@/lib/supabase-server'
import EditPartnerForm from '@/components/partners/EditPartnerForm'
import { notFound } from 'next/navigation'
import type { Partner } from '@/types/partners'

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: partner, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !partner) notFound()

  return (
    <EditPartnerForm
      partner={partner as Partner}
      slug={slug}
    />
  )
}
