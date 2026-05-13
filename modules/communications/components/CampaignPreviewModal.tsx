"use client";

import SereniusModal from "@/components/ui/SereniusModal";
import type { PartnerEmailCampaign } from "../types";

interface Props {
  campaign: PartnerEmailCampaign;
  onClose: () => void;
}

export default function CampaignPreviewModal({ campaign, onClose }: Props) {
  const title = campaign.subject || "Campaign Preview";

  return (
    <SereniusModal
      title={title}
      description="Read-only preview — no content is sent from this view."
      onClose={onClose}
      maxWidth={900}
      contentPadding={0}
    >
      {campaign.message_raw_html ? (
        <iframe
          srcDoc={campaign.message_raw_html}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: 2000,
            border: "none",
            display: "block",
            pointerEvents: "none",
          }}
          title="Email preview"
        />
      ) : campaign.message ? (
        <div style={{ padding: "20px 28px" }}>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.7,
              fontFamily: "inherit",
              margin: 0,
            }}
          >
            {campaign.message}
          </pre>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: "48px 28px" }}>
          No content available for preview.
        </div>
      )}
    </SereniusModal>
  );
}
