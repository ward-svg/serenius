"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  CommWorkspaceTab,
  CommunicationEmailAsset,
  CommunicationsPageData,
  EmailBrandSettings,
  EmailTemplate,
  MailSettingsSummary,
} from "../types";
import CommunicationsDashboard from "./CommunicationsDashboard";
import TemplatesTab from "./TemplatesTab";
import ImageGalleryTab from "./ImageGalleryTab";
import BrandKitTab from "./BrandKitTab";
import DeliverySetupTab from "./DeliverySetupTab";

interface Props extends CommunicationsPageData {
  canManage: boolean;
}

export default function CommunicationsWorkspace(props: Props) {
  const [activeTab, setActiveTab] = useState<CommWorkspaceTab>("campaigns");
  const [templates, setTemplates] = useState<EmailTemplate[]>(props.templates);
  const [brandSettings, setBrandSettings] = useState<EmailBrandSettings | null>(
    props.brandSettings,
  );
  const [emailAssets, setEmailAssets] = useState<CommunicationEmailAsset[]>(props.emailAssets);
  const [mailSettings, setMailSettings] = useState<MailSettingsSummary | null>(
    props.mailSettings,
  );

  async function handleUseAsLogo(url: string) {
    if (!brandSettings) return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("communication_email_brand_settings")
      .update({ logo_url: url })
      .eq("id", brandSettings.id)
      .eq("tenant_id", props.orgId);
    if (!error) {
      setBrandSettings({ ...brandSettings, logo_url: url });
    }
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div className="page-header">
        <div>
          <div className="page-title">Communications</div>
          <div className="page-subtitle">
            Marketing emails, campaign history, and engagement tracking.
          </div>
        </div>
      </div>

      <div className="tab-row" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`tab${activeTab === "campaigns" ? " active" : ""}`}
          onClick={() => setActiveTab("campaigns")}
        >
          Campaigns
        </button>
        <button
          type="button"
          className={`tab${activeTab === "templates" ? " active" : ""}`}
          onClick={() => setActiveTab("templates")}
        >
          Templates
        </button>
        <button
          type="button"
          className={`tab${activeTab === "image-gallery" ? " active" : ""}`}
          onClick={() => setActiveTab("image-gallery")}
        >
          Image Gallery
        </button>
        <button
          type="button"
          className={`tab${activeTab === "brandkit" ? " active" : ""}`}
          onClick={() => setActiveTab("brandkit")}
        >
          Brand Kit
        </button>
        <button
          type="button"
          className={`tab${activeTab === "delivery-setup" ? " active" : ""}`}
          onClick={() => setActiveTab("delivery-setup")}
        >
          Delivery Setup
        </button>
      </div>

      {activeTab === "campaigns" && (
        <CommunicationsDashboard
          {...props}
          mailSettings={mailSettings}
          brandSettings={brandSettings}
          emailAssets={emailAssets}
          onAssetsChange={setEmailAssets}
        />
      )}
      {activeTab === "templates" && (
        <TemplatesTab
          tenantId={props.orgId}
          templates={templates}
          canManage={props.canManage}
          brandSettings={brandSettings}
          emailAssets={emailAssets}
          onTemplatesChange={setTemplates}
          onAssetsChange={setEmailAssets}
        />
      )}
      {activeTab === "image-gallery" && (
        <ImageGalleryTab
          tenantId={props.orgId}
          emailAssets={emailAssets}
          canManage={props.canManage}
          brandSettings={brandSettings}
          onAssetsChange={setEmailAssets}
          onUseAsLogo={handleUseAsLogo}
        />
      )}
      {activeTab === "brandkit" && (
        <BrandKitTab
          tenantId={props.orgId}
          brandSettings={brandSettings}
          canManage={props.canManage}
          onSaved={setBrandSettings}
        />
      )}
      {activeTab === "delivery-setup" && (
        <DeliverySetupTab
          slug={props.slug}
          orgId={props.orgId}
          canManage={props.canManage}
          mailSettings={mailSettings}
          testRecipients={props.testRecipients}
          onMailSettingsChange={setMailSettings}
        />
      )}
    </div>
  );
}
