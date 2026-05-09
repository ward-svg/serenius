"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Partner, PartnerInKindGift } from "@/modules/partners/types";
import InKindGiftModal from "./InKindGiftModal";

interface Props {
  partner: Partner;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
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

function valueOrDash(value: string | number | null | undefined): string {
  if (value == null) return "—";
  if (typeof value === "string" && value.trim() === "") return "—";
  return String(value);
}

export default function InKindTab({ partner }: Props) {
  const [gifts, setGifts] = useState<PartnerInKindGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [selectedGift, setSelectedGift] = useState<PartnerInKindGift | null>(null);

  const loadGifts = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();

    setLoading(true);

    const { data } = await supabase
      .from("partner_in_kind_gifts")
      .select("*")
      .eq("tenant_id", partner.tenant_id)
      .eq("partner_id", partner.id)
      .order("date_given", { ascending: false });

    setGifts((data ?? []) as PartnerInKindGift[]);
    setLoading(false);
  }, [partner.id, partner.tenant_id]);

  useEffect(() => {
    void loadGifts();
  }, [loadGifts]);

  const totalInKindValue = gifts.reduce(
    (sum, gift) => sum + (gift.estimated_value ?? 0),
    0,
  );
  const totalItems = gifts.length;

  function handleCreateGift() {
    setSelectedGift(null);
    setShowGiftModal(true);
  }

  function handleEditGift(gift: PartnerInKindGift) {
    setSelectedGift(gift);
    setShowGiftModal(true);
  }

  function handleCloseModal() {
    setShowGiftModal(false);
    setSelectedGift(null);
  }

  function handleGiftSuccess(savedGift: PartnerInKindGift) {
    const editingExistingGift = selectedGift !== null;

    void loadGifts();

    if (editingExistingGift) {
      setSelectedGift(savedGift);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}>
          {partner.display_name}
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "2px 0 0" }}>
          In-Kind Giving Summary
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">TOTAL IN-KIND VALUE</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: totalInKindValue > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {formatCurrency(totalInKindValue)}
          </div>
          <div className="stat-sub">All recorded in-kind gifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">TOTAL ITEMS</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: totalItems > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {totalItems}
          </div>
          <div className="stat-sub">Recorded in-kind entries</div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <span className="section-title">In-Kind Gifts</span>
          <span className="section-count">{gifts.length}</span>
          <div className="section-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCreateGift}
            >
              + Record In-Kind Gift
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading in-kind gifts...</div>
        ) : gifts.length === 0 ? (
          <div className="empty-state">No in-kind gifts recorded yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <th>Date Given</th>
                  <th>Description</th>
                  <th>Condition</th>
                  <th>Quantity</th>
                  <th style={{ textAlign: "right" }}>Estimated Value</th>
                  <th>Asset Status</th>
                  <th>Date Transferred</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((gift) => (
                  <tr key={gift.id}>
                    <td className="actions-column">
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => handleEditGift(gift)}
                      >
                        View/Edit
                      </button>
                    </td>
                    <td>{formatDate(gift.date_given)}</td>
                    <td>{valueOrDash(gift.description)}</td>
                    <td>{valueOrDash(gift.condition_type)}</td>
                    <td>{valueOrDash(gift.quantity)}</td>
                    <td className="money" style={{ textAlign: "right" }}>
                      {formatCurrency(gift.estimated_value)}
                    </td>
                    <td>{valueOrDash(gift.asset_status)}</td>
                    <td>{formatDate(gift.date_transferred)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGiftModal && (
        <InKindGiftModal
          partnerId={partner.id}
          tenantId={partner.tenant_id}
          gift={selectedGift}
          onClose={handleCloseModal}
          onSuccess={handleGiftSuccess}
        />
      )}
    </div>
  );
}
