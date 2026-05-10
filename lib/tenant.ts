import { createSupabaseServerClient } from "./supabase-server";

export interface TenantConfig {
  org: {
    id: string;
    name: string;
    slug: string;
  };
  branding: {
    app_name: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    alert_color: string;
    sidebar_background_color: string;
    sidebar_color: string;
    logo_url: string | null;
    font_heading: string;
    font_body: string;
  };
}

const FALLBACK: TenantConfig = {
  org: {
    id: "",
    name: "Serenius",
    slug: "serenius",
  },
  branding: {
    app_name: "Serenius",
    primary_color: "#3D5A80",
    secondary_color: "#98C1D9",
    accent_color: "#EE6C4D",
    alert_color: "#EE6C4D",
    sidebar_background_color: "#293241",
    sidebar_color: "#293241",
    logo_url: null,
    font_heading: "Inter",
    font_body: "Inter",
  },
};

export async function getTenantBySlug(
  slug: string,
): Promise<TenantConfig | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (orgError || !org) {
      console.error("Tenant lookup failed for slug:", slug, orgError?.message);
      return null;
    }

    const { data: branding, error: brandingError } = await supabase
      .from("organization_branding")
      .select("*")
      .eq("tenant_id", org.id)
      .single();

    if (brandingError || !branding) {
      console.error(
        "Branding lookup failed for tenant:",
        org.id,
        brandingError?.message,
      );

      return {
        org,
        branding: FALLBACK.branding,
      };
    }

    return {
      org,
      branding: {
        app_name: branding.app_name ?? FALLBACK.branding.app_name,

        primary_color:
          branding.primary_color ?? FALLBACK.branding.primary_color,

        secondary_color:
          branding.secondary_color ?? FALLBACK.branding.secondary_color,

        accent_color: branding.accent_color ?? FALLBACK.branding.accent_color,

        alert_color: branding.alert_color ?? FALLBACK.branding.alert_color,

        sidebar_background_color:
          branding.sidebar_background_color ??
          FALLBACK.branding.sidebar_background_color,

        sidebar_color:
          branding.sidebar_color ?? FALLBACK.branding.sidebar_color,

        logo_url: branding.logo_url ?? FALLBACK.branding.logo_url,

        font_heading: branding.font_heading ?? FALLBACK.branding.font_heading,

        font_body: branding.font_body ?? FALLBACK.branding.font_body,
      },
    };
  } catch (err) {
    console.error("getTenantBySlug error:", err);
    return null;
  }
}
