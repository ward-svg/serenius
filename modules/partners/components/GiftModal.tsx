"use client";

import { useEffect, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { FinancialGift } from "@/modules/partners/types";
import {
  GIFT_PROCESSING_SOURCES,
  GIFT_TOWARDS_OPTIONS,
} from "@/modules/partners/constants";

interface Props {
  partnerId: string;
  tenantId: string;
  gift?: FinancialGift | null;
  pledgeId?: string | null;
  defaultAmount?: number | null;
  defaultTowards?: string | null;
  towardsActivePledge?: boolean;
  onClose: () => void;
  onSuccess: (gift: FinancialGift) => void;
}

type Mode = "view" | "edit";

type FormData = {
  date_given: string;
  amount: string;
  fee_donation: string;
  base_gift_override: string;
  processing_source: string;
  towards: string;
  notes: string;
};

function formatMoney(value: number | null | undefined): string {
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

export default function GiftModal({
  partnerId,
  tenantId,
  gift,
  pledgeId = null,
  defaultAmount = null,
  defaultTowards = null,
  towardsActivePledge = false,
  onClose,
  onSuccess,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const isCreate = !gift;
  const [mode, setMode] = useState<Mode>(isCreate ? "edit" : "view");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    date_given: new Date().toISOString().split("T")[0],
    amount: defaultAmount != null ? String(defaultAmount) : "",
    fee_donation: "",
    base_gift_override: "",
    processing_source: "",
    towards: defaultTowards ?? "",
    notes: "",
  });

  function mapGiftToFormData(source: FinancialGift): FormData {
    return {
      date_given: source.date_given?.split("T")[0] ?? "",
      amount: String(source.amount ?? ""),
      fee_donation:
        source.fee_donation != null ? String(source.fee_donation) : "",
      base_gift_override: "",
      processing_source: source.processing_source ?? "",
      towards: source.towards ?? "",
      notes: source.notes ?? "",
    };
  }

  useEffect(() => {
    if (!gift) return;

    setFormData(mapGiftToFormData(gift));
    setError(null);
    setMode("view");
  }, [gift]);

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function computedBaseGift(): number {
    const amount = parseFloat(formData.amount || "0");
    const feeDonation = parseFloat(formData.fee_donation || "0");

    if (formData.base_gift_override) {
      return parseFloat(formData.base_gift_override);
    }

    return Math.max(amount - feeDonation, 0);
  }

  function viewBaseGift(source: FinancialGift): number {
    if (source.base_gift != null) {
      return source.base_gift;
    }

    return Math.max((source.amount ?? 0) - (source.fee_donation ?? 0), 0);
  }

  function returnToViewMode() {
    if (gift) {
      setFormData(mapGiftToFormData(gift));
    }

    setError(null);
    setMode("view");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);

    const amount = parseFloat(formData.amount);

    if (!formData.date_given || !formData.processing_source || isNaN(amount)) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const givingYear = new Date(formData.date_given).getFullYear();

    const payload = {
      tenant_id: tenantId,
      partner_id: partnerId,
      pledge_id: gift ? gift.pledge_id : pledgeId,
      towards_active_pledge: gift
        ? gift.towards_active_pledge
        : towardsActivePledge,
      date_given: formData.date_given,
      amount,
      fee_donation: formData.fee_donation
        ? parseFloat(formData.fee_donation)
        : null,
      processing_source: formData.processing_source,
      towards: formData.towards || null,
      giving_year: givingYear,
      notes: formData.notes || null,
    };

    const result = !isCreate
      ? await supabase
          .from("financial_gifts")
          .update(payload)
          .eq("id", gift.id)
          .eq("tenant_id", tenantId)
          .select("*")
          .single()
      : await supabase
          .from("financial_gifts")
          .insert(payload)
          .select("*")
          .single();

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const savedGift = result.data as FinancialGift;

    onSuccess(savedGift);

    if (isCreate) {
      onClose();
      return;
    }

    setFormData(mapGiftToFormData(savedGift));
    setMode("view");
  }

  async function handleDelete() {
    if (!gift) return;

    const confirmed = window.confirm(
      "Delete this gift? This cannot be undone.",
    );

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("financial_gifts")
      .delete()
      .eq("id", gift.id)
      .eq("tenant_id", tenantId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSuccess(gift);
    onClose();
  }

  if (!isCreate && mode === "view") {
    const viewGift = gift;

    return (
      <SereniusModal
        title="View Gift"
        description={
          viewGift
            ? `${formatDate(viewGift.date_given)} · ${formatMoney(viewGift.amount)}`
            : undefined
        }
        onClose={onClose}
        maxWidth={760}
        contentPadding={0}
        headerActions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMode("edit")}
          >
            Edit Gift
          </button>
        }
      >
        <div
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Given</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatDate(viewGift?.date_given)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Total Gift</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatMoney(viewGift?.amount)}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fee Donation</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatMoney(viewGift?.fee_donation)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Base Gift</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatMoney(viewBaseGift(viewGift))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pledge ID</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewGift?.pledge_id || "—"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Towards Active Pledge</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewGift?.towards_active_pledge == null
                  ? "—"
                  : viewGift.towards_active_pledge
                    ? "Yes"
                    : "No"}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Processing Source</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewGift?.processing_source || "—"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Towards</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewGift?.towards || "—"}
              </div>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>
              <div
                style={{
                  fontSize: 14,
                  color: "#111827",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  paddingTop: 4,
                }}
              >
                {viewGift?.notes || "—"}
              </div>
            </div>
          </div>
        </div>
      </SereniusModal>
    );
  }

  const isEditMode = !isCreate && mode === "edit";

  return (
    <SereniusModal
      title={isCreate ? "Record Gift" : "Edit Gift"}
      onClose={onClose}
      maxWidth={760}
      contentPadding={0}
      showCloseButton={isCreate}
      closeOnOverlayClick={isCreate}
      closeOnEscape={isCreate}
      headerActions={
        !isCreate ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={returnToViewMode}
          >
            Back to View
          </button>
        ) : null
      }
      footerLeft={
        isEditMode ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </button>
        ) : null
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={isCreate ? onClose : returnToViewMode}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="gift-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : isCreate ? "Record Gift" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="gift-form" onSubmit={handleSubmit}>
        <div style={{ padding: 24 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Given *</label>

              <input
                type="date"
                className="form-input"
                value={formData.date_given}
                onChange={(e) => handleChange("date_given", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount *</label>

              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={formData.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fee Donation</label>

              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={formData.fee_donation}
                onChange={(e) => handleChange("fee_donation", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Base Gift</label>

              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={
                  formData.base_gift_override || String(computedBaseGift())
                }
                onChange={(e) =>
                  handleChange("base_gift_override", e.target.value)
                }
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Processing Source *</label>

              <select
                className="form-input"
                value={formData.processing_source}
                onChange={(e) =>
                  handleChange("processing_source", e.target.value)
                }
              >
                <option value="">Select...</option>

                {GIFT_PROCESSING_SOURCES.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Towards</label>

              <select
                className="form-input"
                value={formData.towards}
                onChange={(e) => handleChange("towards", e.target.value)}
              >
                <option value="">Select...</option>

                {GIFT_TOWARDS_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>

              <textarea
                rows={4}
                className="form-input"
                style={{
                  resize: "vertical",
                }}
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#fff5f5",
                border: "1px solid #ffa8a8",
                borderRadius: 6,
                color: "#c92a2a",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </form>
    </SereniusModal>
  );
}
