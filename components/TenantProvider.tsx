"use client";

import { useEffect } from "react";
import type { TenantConfig } from "@/lib/tenant";

interface Props {
  config: TenantConfig;
  children: React.ReactNode;
}

export default function TenantProvider({ config, children }: Props) {
  const { branding } = config;

  function normalizeHexColor(value: string | null | undefined) {
    if (!value) return null;
    const trimmed = value.trim();
    const short = /^#([0-9a-fA-F]{3})$/;
    const long = /^#([0-9a-fA-F]{6})$/;

    if (short.test(trimmed)) {
      const [, hex] = trimmed.match(short) ?? [];
      if (!hex) return null;
      return `#${hex
        .split("")
        .map(char => `${char}${char}`)
        .join("")}`;
    }

    if (long.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  function hexToRgb(hex: string) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;
    const parts = normalized.slice(1).match(/.{2}/g);
    if (!parts || parts.length !== 3) return null;
    const [r, g, b] = parts.map(part => Number.parseInt(part, 16));
    return { r, g, b };
  }

  function getLuminance(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0.15;
    const transform = (channel: number) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * transform(rgb.r) + 0.7152 * transform(rgb.g) + 0.0722 * transform(rgb.b);
  }

  function rgbaFromHex(hex: string, alpha: number) {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  useEffect(() => {
    const root = document.documentElement;
    const brandPrimary = normalizeHexColor(branding.primary_color) ?? "#3D5A80";
    const brandSecondary = normalizeHexColor(branding.secondary_color) ?? "#98C1D9";
    const brandAccent = normalizeHexColor(branding.accent_color) ?? "#EE6C4D";
    const brandAlert = normalizeHexColor(branding.alert_color) ?? brandAccent;
    const brandSidebar = normalizeHexColor(branding.sidebar_background_color)
      ?? normalizeHexColor(branding.primary_color)
      ?? normalizeHexColor(branding.sidebar_color)
      ?? "#293241";
    const sidebarIsDark = getLuminance(brandSidebar) < 0.45;

    // ─────────────────────────────────────────────
    // Raw brand colors
    // ─────────────────────────────────────────────

    root.style.setProperty("--brand-primary", brandPrimary);

    root.style.setProperty("--brand-secondary", brandSecondary);

    root.style.setProperty("--brand-accent", brandAccent);

    root.style.setProperty("--brand-alert", brandAlert);

    root.style.setProperty("--brand-sidebar", brandSidebar);
    root.style.setProperty(
      "--brand-sidebar-text",
      sidebarIsDark ? "#ffffff" : "#1f2937",
    );
    root.style.setProperty(
      "--brand-sidebar-muted",
      sidebarIsDark ? "rgba(255,255,255,0.68)" : "rgba(31,41,55,0.68)",
    );
    root.style.setProperty(
      "--brand-sidebar-dim",
      sidebarIsDark ? "rgba(255,255,255,0.38)" : "rgba(31,41,55,0.38)",
    );
    root.style.setProperty(
      "--brand-sidebar-border",
      sidebarIsDark ? "rgba(255,255,255,0.1)" : "rgba(31,41,55,0.12)",
    );
    root.style.setProperty(
      "--brand-sidebar-active-bg",
      sidebarIsDark ? "rgba(255,255,255,0.12)" : rgbaFromHex(brandSidebar, 0.12),
    );
    root.style.setProperty(
      "--brand-sidebar-hover-bg",
      sidebarIsDark ? "rgba(255,255,255,0.08)" : rgbaFromHex(brandSidebar, 0.06),
    );

    // ─────────────────────────────────────────────
    // Semantic UI tokens
    // ─────────────────────────────────────────────

    root.style.setProperty("--color-primary", brandPrimary);

    root.style.setProperty("--color-secondary", brandSecondary);

    root.style.setProperty("--color-accent", brandAccent);

    root.style.setProperty("--button-primary-bg", brandPrimary);

    root.style.setProperty("--button-primary-text", "#ffffff");

    root.style.setProperty("--button-ghost-border", brandPrimary);

    root.style.setProperty("--button-ghost-text", brandPrimary);

    root.style.setProperty("--link-action-color", brandAccent);

    root.style.setProperty(
      "--table-header-bg",
      `${brandSecondary}22`,
    );

    root.style.setProperty(
      "--table-row-hover-bg",
      `${brandSecondary}14`,
    );

    // Fonts

    root.style.setProperty("--brand-font-heading", branding.font_heading);

    root.style.setProperty("--brand-font-body", branding.font_body);

    document.title = config.branding.app_name;

    const fonts = [...new Set([branding.font_heading, branding.font_body])];

    const existingLink = document.getElementById("tenant-fonts");

    if (existingLink) existingLink.remove();

    const fontQuery = fonts
      .filter((f) => f !== "system-ui")
      .map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700`)
      .join("&");

    if (fontQuery) {
      const link = document.createElement("link");

      link.id = "tenant-fonts";
      link.rel = "stylesheet";

      link.href = `https://fonts.googleapis.com/css2?${fontQuery}&display=swap`;

      document.head.appendChild(link);
    }
  }, [config, branding]);

  return <>{children}</>;
}
