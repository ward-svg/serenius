"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  Partner,
  PartnerContact,
  PartnerCommunication,
  PartnerCommunicationFollowup,
  PartnerEmailOpen,
} from "@/modules/partners/types";
import CommunicationModal from "./CommunicationModal";

interface Props {
  partner: Partner;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function truncate(value: string | null | undefined, limit: number): string {
  if (!value || value.trim() === "") return "—";
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function boolLabel(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

type EmailContactLookup = Pick<
  PartnerContact,
  "id" | "display_name" | "first_name" | "last_name" | "primary_email"
>;

type EmailCampaignLookup = {
  id: string;
  subject: string | null;
  communication_type: string | null;
  segment: string | null;
  campaign_version: string | null;
  email_sent_at: string | null;
};

type EmailInteraction = PartnerEmailOpen & {
  contact: EmailContactLookup | null;
  email: EmailCampaignLookup | null;
};

export default function CommunicationsTab({ partner }: Props) {
  const [communications, setCommunications] = useState<PartnerCommunication[]>(
    [],
  );
  const [followups, setFollowups] = useState<PartnerCommunicationFollowup[]>([]);
  const [emailInteractions, setEmailInteractions] = useState<EmailInteraction[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] =
    useState<PartnerCommunication | null>(null);

  const loadCommunications = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    setLoading(true);
    try {
      const [{ data: communicationData }, { data: emailOpenData }] =
        await Promise.all([
          supabase
            .from("partner_communications")
            .select("*")
            .eq("tenant_id", partner.tenant_id)
            .eq("partner_id", partner.id)
            .order("communication_date", { ascending: false }),
          supabase
            .from("partner_email_opens")
            .select("*")
            .eq("tenant_id", partner.tenant_id)
            .eq("partner_id", partner.id)
            .order("sent_at", { ascending: false }),
        ]);

      const nextCommunications = (communicationData ?? []) as PartnerCommunication[];
      setCommunications(nextCommunications);

      if (nextCommunications.length > 0) {
        const { data: followupData } = await supabase
          .from("partner_communication_followups")
          .select("*")
          .eq("tenant_id", partner.tenant_id)
          .in(
            "communication_id",
            nextCommunications.map((communication) => communication.id),
          )
          .order("due_date", { ascending: true });

        setFollowups((followupData ?? []) as PartnerCommunicationFollowup[]);
      } else {
        setFollowups([]);
      }

      const nextEmailInteractions = (emailOpenData ?? []) as PartnerEmailOpen[];

      if (nextEmailInteractions.length === 0) {
        setEmailInteractions([]);
        return;
      }

      const contactIds = Array.from(
        new Set(
          nextEmailInteractions
            .map((interaction) => interaction.partner_contact_id)
            .filter((contactId): contactId is string => Boolean(contactId)),
        ),
      );
      const emailIds = Array.from(
        new Set(
          nextEmailInteractions
            .map((interaction) => interaction.partner_email_id)
            .filter((emailId): emailId is string => Boolean(emailId)),
        ),
      );

      const [contactResult, emailResult] = await Promise.all([
        contactIds.length > 0
          ? supabase
              .from("partner_contacts")
              .select("id, display_name, first_name, last_name, primary_email")
              .in("id", contactIds)
          : Promise.resolve({ data: [] as EmailContactLookup[] }),
        emailIds.length > 0
          ? supabase
              .from("partner_emails")
              .select(
                "id, subject, communication_type, segment, campaign_version, email_sent_at",
              )
              .in("id", emailIds)
          : Promise.resolve({ data: [] as EmailCampaignLookup[] }),
      ]);

      const contactById = new Map(
        ((contactResult.data ?? []) as EmailContactLookup[]).map((contact) => [
          contact.id,
          contact,
        ]),
      );
      const emailById = new Map(
        ((emailResult.data ?? []) as EmailCampaignLookup[]).map((email) => [
          email.id,
          email,
        ]),
      );

      setEmailInteractions(
        nextEmailInteractions.map((interaction) => ({
          ...interaction,
          contact: interaction.partner_contact_id
            ? contactById.get(interaction.partner_contact_id) ?? null
            : null,
          email: interaction.partner_email_id
            ? emailById.get(interaction.partner_email_id) ?? null
            : null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [partner.id, partner.tenant_id]);

  useEffect(() => {
    void loadCommunications();
  }, [loadCommunications]);

  const totalCommunications = communications.length;
  const openFollowUps =
    communications.filter(
      (communication) =>
        communication.followup_needed && !communication.followup_complete,
    ).length +
    followups.filter((followup) => !followup.completed).length;
  const lastCommunication = communications[0]?.communication_date ?? null;
  const totalEmailInteractions = emailInteractions.length;
  const emailOpens = emailInteractions.filter(
    (interaction) =>
      (interaction.open_count ?? 0) > 0 || Boolean(interaction.first_opened),
  ).length;

  const followupsByCommunication = useMemo(() => {
    return followups.reduce((acc, followup) => {
      if (!acc[followup.communication_id]) {
        acc[followup.communication_id] = [];
      }

      acc[followup.communication_id].push(followup);
      return acc;
    }, {} as Record<string, PartnerCommunicationFollowup[]>);
  }, [followups]);

  const contactLabelByInteraction = useCallback((interaction: EmailInteraction) => {
    const contact = interaction.contact;

    if (contact?.display_name?.trim()) {
      return contact.display_name;
    }

    const firstName = contact?.first_name?.trim() ?? "";
    const lastName = contact?.last_name?.trim() ?? "";

    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(" ");
    }

    if (contact?.primary_email?.trim()) {
      return contact.primary_email;
    }

    return "Unknown Contact";
  }, []);

  const campaignLabelByInteraction = useCallback((interaction: EmailInteraction) => {
    return (
      interaction.email?.subject?.trim() ||
      interaction.campaign_message?.trim() ||
      "—"
    );
  }, []);

  const sentAtByInteraction = useCallback((interaction: EmailInteraction) => {
    return interaction.sent_at ?? interaction.email?.email_sent_at ?? null;
  }, []);

  function handleNewCommunication() {
    setSelectedCommunication(null);
    setShowCommunicationModal(true);
  }

  function handleEditCommunication(communication: PartnerCommunication) {
    setSelectedCommunication(communication);
    setShowCommunicationModal(true);
  }

  function handleCloseModal() {
    setShowCommunicationModal(false);
    setSelectedCommunication(null);
  }

  function handleCommunicationSuccess(savedCommunication: PartnerCommunication) {
    const editingExistingCommunication = selectedCommunication !== null;

    void loadCommunications();

    if (editingExistingCommunication) {
      setSelectedCommunication(savedCommunication);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}>
          {partner.display_name}
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "2px 0 0" }}>
          Communication Summary
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">TOTAL COMMUNICATIONS</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: totalCommunications > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {totalCommunications}
          </div>
          <div className="stat-sub">All recorded communications</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">OPEN FOLLOW-UPS</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: openFollowUps > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {openFollowUps}
          </div>
          <div className="stat-sub">Incomplete follow-up items</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">LAST COMMUNICATION</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: lastCommunication ? "#3B6D11" : "#9ca3af",
            }}
          >
            {formatDate(lastCommunication)}
          </div>
          <div className="stat-sub">Most recent communication</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">EMAIL OPENS</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: emailOpens > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {emailOpens}
          </div>
          <div className="stat-sub">Email engagement records</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <span className="section-title">Communications</span>
          <span className="section-count">{communications.length}</span>
          <div className="section-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleNewCommunication}
            >
              + New Communication
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading communications...</div>
        ) : communications.length === 0 ? (
          <div className="empty-state">No communications recorded yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <th>Communication Date</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>Notes</th>
                  <th>Follow-Up</th>
                  <th>Follow-Up Due</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {communications.map((communication) => (
                  <tr key={communication.id}>
                    <td className="actions-column">
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => handleEditCommunication(communication)}
                      >
                        View/Edit
                      </button>
                    </td>
                    <td>{formatDate(communication.communication_date)}</td>
                    <td>{communication.communication_type ?? "—"}</td>
                    <td>{communication.communication_channel ?? "—"}</td>
                    <td>{truncate(communication.notes, 80)}</td>
                    <td>
                      {communication.followup_complete
                        ? "Complete"
                        : communication.followup_needed
                          ? "Needed"
                          : "—"}
                    </td>
                    <td>{formatDate(communication.followup_due)}</td>
                    <td>{boolLabel(communication.followup_complete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-header">
          <span className="section-title">Email Interactions</span>
          <span className="section-count">{totalEmailInteractions}</span>
        </div>

        {loading ? (
          <div className="empty-state">Loading email interactions...</div>
        ) : emailInteractions.length === 0 ? (
          <div className="empty-state">No email interactions recorded yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Contact</th>
                  <th>Campaign / Subject</th>
                  <th>Opens</th>
                  <th>First Opened</th>
                  <th>Last Opened</th>
                </tr>
              </thead>
              <tbody>
                {emailInteractions.map((interaction) => (
                  <tr
                    key={interaction.id}
                    style={
                      (interaction.open_count ?? 0) >= 5
                        ? { background: "var(--color-background-info)" }
                        : undefined
                    }
                  >
                    <td>{formatDate(sentAtByInteraction(interaction))}</td>
                    <td>{contactLabelByInteraction(interaction)}</td>
                    <td>{campaignLabelByInteraction(interaction)}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span>{interaction.open_count ?? 0}</span>
                        {(interaction.open_count ?? 0) >= 5 && (
                          <span className="badge badge-info">High engagement</span>
                        )}
                      </span>
                    </td>
                    <td>{formatDate(interaction.first_opened)}</td>
                    <td>{formatDate(interaction.last_opened)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCommunicationModal && (
        <CommunicationModal
          partnerId={partner.id}
          partnerDisplayName={partner.display_name}
          tenantId={partner.tenant_id}
          communication={selectedCommunication}
          followups={
            selectedCommunication
              ? followupsByCommunication[selectedCommunication.id] ?? []
              : []
          }
          onClose={handleCloseModal}
          onSuccess={handleCommunicationSuccess}
        />
      )}
    </div>
  );
}
