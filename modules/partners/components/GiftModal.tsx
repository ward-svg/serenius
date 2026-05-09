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
  onSuccess: () => void;
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

  const isEdit = !!gift;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    date_given: new Date().toISOString().split("T")[0],
    amount: defaultAmount != null ? String(defaultAmount) : "",
    fee_donation: "",
    base_gift_override: "",
    processing_source: "",
    towards: defaultTowards ?? "",
    notes: "",
  });

  useEffect(() => {
    if (!gift) return;

    setFormData({
      date_given: gift.date_given?.split("T")[0] ?? "",
      amount: String(gift.amount ?? ""),
      fee_donation: gift.fee_donation != null ? String(gift.fee_donation) : "",
      base_gift_override: "",
      processing_source: gift.processing_source ?? "",
      towards: gift.towards ?? "",
      notes: gift.notes ?? "",
    });
  }, [gift]);

  function handleChange(field: string, value: string) {
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

    let result;

    if (isEdit) {
      result = await supabase
        .from("financial_gifts")
        .update(payload)
        .eq("id", gift.id)
        .eq("tenant_id", tenantId);
    } else {
      result = await supabase.from("financial_gifts").insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSuccess();
    onClose();
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

    onSuccess();
    onClose();
  }

  return (
    <SereniusModal
      title={isEdit ? "Edit Gift" : "Record Gift"}
      onClose={onClose}
      footerLeft={
        isEdit ? (
          <button
            type="button"
            className="btn btn-ghost"
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
            onClick={onClose}
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
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Record Gift"}
          </button>
        </>
      }
    >
      <form id="gift-form" onSubmit={handleSubmit}>
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

      </form>
    </SereniusModal>
  );
}
