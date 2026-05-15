"use client";

import type { CommunicationEmailAsset, EmailBrandSettings } from "../types";
import EmailAssetsSection from "./EmailAssetsSection";

interface Props {
  tenantId: string;
  emailAssets: CommunicationEmailAsset[];
  canManage: boolean;
  brandSettings: EmailBrandSettings | null;
  onAssetsChange: (assets: CommunicationEmailAsset[]) => void;
  onUseAsLogo: (url: string) => void;
}

export default function ImageGalleryTab({
  tenantId,
  emailAssets,
  canManage,
  brandSettings,
  onAssetsChange,
  onUseAsLogo,
}: Props) {
  return (
    <EmailAssetsSection
      tenantId={tenantId}
      assets={emailAssets}
      canManage={canManage}
      brandSettings={brandSettings}
      onAssetsChange={onAssetsChange}
      onUseAsLogo={onUseAsLogo}
    />
  );
}
