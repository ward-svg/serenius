import PartnersClient from '@/modules/partners/components/PartnersClient'
import { getPartnersPageData } from '@/modules/partners'

export const revalidate = 0

export default async function PartnersPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const data = await getPartnersPageData(slug)

  return <PartnersClient {...data} />
}