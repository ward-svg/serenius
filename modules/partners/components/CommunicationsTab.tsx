"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  Partner,
  PartnerCommunication,
  PartnerCommunicationFollowup,
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

export default function CommunicationsTab({ partner }: Props) {
  const [communications, setCommunications] = useState<PartnerCommunication[]>(
    [],
  );
  const [followups, setFollowups] = useState<PartnerCommunicationFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCommunicationModal, setShowCommunicationModal] = useState(false);
  const [selectedCommunication, setSelectedCommunication] =
    useState<PartnerCommunication | null>(null);

  const loadCommunications = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    setLoading(true);

    const { data: communicationData } = await supabase
      .from("partner_communications")
      .select("*")
      .eq("tenant_id", partner.tenant_id)
      .eq("partner_id", partner.id)
      .order("communication_date", { ascending: false });

    const nextCommunications = (communicationData ?? []) as PartnerCommunication[];
    setCommunications(nextCommunications);

    if (nextCommunications.length === 0) {
      setFollowups([]);
      setLoading(false);
      return;
    }

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
    setLoading(false);
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

  const followupsByCommunication = useMemo(() => {
    return followups.reduce((acc, followup) => {
      if (!acc[followup.communication_id]) {
        acc[followup.communication_id] = [];
      }

      acc[followup.communication_id].push(followup);
      return acc;
    }, {} as Record<string, PartnerCommunicationFollowup[]>);
  }, [followups]);

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
          gridTemplateColumns: "repeat(3, 1fr)",
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

      {showCommunicationModal && (
        <CommunicationModal
          partnerId={partner.id}
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
