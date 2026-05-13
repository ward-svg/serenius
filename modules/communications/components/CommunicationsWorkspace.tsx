"use client";

import { useState } from "react";
import type {
  CommWorkspaceTab,
  CommunicationsPageData,
  EmailBrandSettings,
  EmailTemplate,
} from "../types";
import CommunicationsDashboard from "./CommunicationsDashboard";
import TemplatesTab from "./TemplatesTab";
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

      {activeTab === "campaigns" && <CommunicationsDashboard {...props} />}
      {activeTab === "templates" && (
        <TemplatesTab
          tenantId={props.orgId}
          templates={templates}
          canManage={props.canManage}
          onTemplatesChange={setTemplates}
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
          mailSettings={props.mailSettings}
          testRecipients={props.testRecipients}
        />
      )}
    </div>
  );
}
