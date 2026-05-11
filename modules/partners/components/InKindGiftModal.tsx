"use client";

import { useEffect, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { PartnerInKindGift } from "@/modules/partners/types";
import {
  IN_KIND_ASSET_STATUSES,
  IN_KIND_GIFT_CONDITIONS,
} from "@/modules/partners/constants";

interface Props {
  partnerId: string;
  tenantId: string;
  gift?: PartnerInKindGift | null;
  onClose: () => void;
  onSuccess: (gift: PartnerInKindGift) => void;
}

type Mode = "view" | "edit";

type FormData = {
  date_given: string;
  description: string;
  estimated_value: string;
  condition_type: string;
  asset_status: string;
  date_transferred: string;
  quantity: string;
  received_by: string;
  location_notes: string;
  notes: string;
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";

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

export default function InKindGiftModal({
  partnerId,
  tenantId,
  gift,
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
    description: "",
    estimated_value: "",
    condition_type: "",
    asset_status: "Awaiting Transfer",
    date_transferred: "",
    quantity: "",
    received_by: "",
    location_notes: "",
    notes: "",
  });

  function mapGiftToFormData(source: PartnerInKindGift): FormData {
    return {
      date_given: source.date_given?.split("T")[0] ?? "",
      description: source.description ?? "",
      estimated_value:
        source.estimated_value != null ? String(source.estimated_value) : "",
      condition_type: source.condition_type ?? "",
      asset_status: source.asset_status ?? "",
      date_transferred: source.date_transferred?.split("T")[0] ?? "",
      quantity: source.quantity != null ? String(source.quantity) : "",
      received_by: source.received_by ?? "",
      location_notes: source.location_notes ?? "",
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
    setSaving(true);

    const { data: userResult } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    const payload = {
      tenant_id: tenantId,
      partner_id: partnerId,
      date_given: formData.date_given || null,
      description: formData.description || null,
      estimated_value: formData.estimated_value
        ? parseFloat(formData.estimated_value)
        : null,
      condition_type: formData.condition_type || null,
      asset_status: formData.asset_status || null,
      date_transferred: formData.date_transferred || null,
      quantity: formData.quantity ? parseInt(formData.quantity, 10) : null,
      location_notes: formData.location_notes || null,
      received_by: formData.received_by || null,
      notes: formData.notes || null,
    };

    const result = !isCreate
      ? await supabase
          .from("partner_in_kind_gifts")
          .update({
            ...payload,
            updated_at: now,
          })
          .eq("id", gift.id)
          .eq("tenant_id", tenantId)
          .select("*")
          .single()
      : await supabase
          .from("partner_in_kind_gifts")
          .insert({
            ...payload,
            created_by: userResult.user?.id ?? null,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single();

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const savedGift = result.data as PartnerInKindGift;

    onSuccess(savedGift);

    if (isCreate) {
      onClose();
      return;
    }

    setFormData(mapGiftToFormData(savedGift));
    setMode("view");
  }

  if (!isCreate && mode === "view") {
    const viewGift = gift;

    return (
      <SereniusModal
        title="View In-Kind Gift"
        description={viewGift?.description || undefined}
        onClose={onClose}
        maxWidth={900}
        contentPadding={0}
        headerActions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMode("edit")}
          >
            Edit In-Kind Gift
          </button>
        }
      >
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Given</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatDate(viewGift?.date_given)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewGift?.description)}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estimated Value</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatCurrency(viewGift?.estimated_value)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Condition</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewGift?.condition_type)}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewGift?.quantity)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Asset Status</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewGift?.asset_status)}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Transferred</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatDate(viewGift?.date_transferred)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Received By</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewGift?.received_by)}
              </div>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Location Notes</label>
              <div style={{ fontSize: 14, color: "#111827", whiteSpace: "pre-wrap", lineHeight: 1.6, paddingTop: 4 }}>
                {valueOrDash(viewGift?.location_notes)}
              </div>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>
              <div style={{ fontSize: 14, color: "#111827", whiteSpace: "pre-wrap", lineHeight: 1.6, paddingTop: 4 }}>
                {valueOrDash(viewGift?.notes)}
              </div>
            </div>
          </div>

          {error ? (
            <div style={{ color: "#c92a2a", fontSize: 13 }}>
              {error}
            </div>
          ) : null}
        </div>
      </SereniusModal>
    );
  }

  const isEditMode = !isCreate && mode === "edit";

  return (
    <SereniusModal
      title={isCreate ? "Record In-Kind Gift" : "Edit In-Kind Gift"}
      onClose={onClose}
      maxWidth={900}
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
            form="inkind-gift-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : isCreate ? "Record In-Kind Gift" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="inkind-gift-form" onSubmit={handleSubmit}>
        <div style={{ padding: 24 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Given</label>
              <input
                type="date"
                className="form-input"
                value={formData.date_given}
                onChange={(e) => handleChange("date_given", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Estimated Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={formData.estimated_value}
                onChange={(e) => handleChange("estimated_value", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Condition</label>
              <select
                className="form-input"
                value={formData.condition_type}
                onChange={(e) => handleChange("condition_type", e.target.value)}
                disabled={!isCreate && !isEditMode}
              >
                <option value="">Select...</option>
                {IN_KIND_GIFT_CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                min="0"
                step="1"
                className="form-input"
                value={formData.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Asset Status</label>
              <select
                className="form-input"
                value={formData.asset_status}
                onChange={(e) => handleChange("asset_status", e.target.value)}
                disabled={!isCreate && !isEditMode}
              >
                <option value="">Select...</option>
                {IN_KIND_ASSET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date Transferred</label>
              <input
                type="date"
                className="form-input"
                value={formData.date_transferred}
                onChange={(e) => handleChange("date_transferred", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Received By</label>
              <input
                type="text"
                className="form-input"
                value={formData.received_by}
                onChange={(e) => handleChange("received_by", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Location Notes</label>
              <textarea
                rows={3}
                className="form-input"
                value={formData.location_notes}
                onChange={(e) => handleChange("location_notes", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                rows={4}
                className="form-input"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                disabled={!isCreate && !isEditMode}
              />
            </div>
          </div>

          {error ? (
            <div style={{ color: "#c92a2a", fontSize: 13 }}>
              {error}
            </div>
          ) : null}
        </div>
      </form>
    </SereniusModal>
  );
}
