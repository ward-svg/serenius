import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCommunicationsPageData } from "@/modules/communications/queries";
import CommunicationsDashboard from "@/modules/communications/components/CommunicationsDashboard";

export const revalidate = 0;

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCommunicationsPageData(slug);

  if (!data) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    redirect("/login");
  }

  const [{ data: superRes }, { data: tenantAdminRes }] = await Promise.all([
    supabase.rpc("has_role", { role_name: "superadmin" }),
    supabase.rpc("has_role", { role_name: "tenant_admin" }),
  ]);

  const canManage = superRes === true || tenantAdminRes === true;

  return <CommunicationsDashboard {...data} canManage={canManage} />;
}
