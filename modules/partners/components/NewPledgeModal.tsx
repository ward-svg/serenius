"use client";

import { useEffect, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Pledge } from "@/modules/partners/types";
import {
  PLEDGE_FREQUENCIES,
  PLEDGE_STATUSES,
  PLEDGE_TYPES,
} from "@/modules/partners/constants";

interface Props {
  partnerId: string;
  tenantId: string;
  pledge?: Pledge | null;
  onClose: () => void;
  onSuccess: (pledge: Pledge) => void;
}

export default function NewPledgeModal({
  partnerId,
  tenantId,
  pledge,
  onClose,
  onSuccess,
}: Props) {
  const supabase = createSupabaseBrowserClient();

  const isCreate = !pledge;
  const [mode, setMode] = useState<"view" | "edit">(isCreate ? "edit" : "view");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    pledge_type: "",
    status: "Active",
    frequency: "Monthly",
    pledge_amount: "",
    number_of_payments: "",
    start_date: "",
    end_date: "",
    on_hold_until: "",
    notes: "",
  });

  function mapPledgeToFormData(source: Pledge) {
    return {
      pledge_type: source.pledge_type ?? "",
      status: source.status ?? "Active",
      frequency: source.frequency ?? "Monthly",
      pledge_amount: String(source.pledge_amount ?? ""),
      number_of_payments: source.number_of_payments
        ? String(source.number_of_payments)
        : "",
      start_date: source.start_date?.split("T")[0] ?? "",
      end_date: source.end_date?.split("T")[0] ?? "",
      on_hold_until: source.on_hold_until?.split("T")[0] ?? "",
      notes: source.notes ?? "",
    };
  }

  useEffect(() => {
    if (!pledge) return;

    setFormData(mapPledgeToFormData(pledge));
    setError(null);
    setMode("view");
  }, [pledge]);

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function pledgeAmountLabel(frequency: string = formData.frequency): string {
    if (frequency === "Monthly") {
      return "Monthly Pledge Amount *";
    }

    if (frequency === "Quarterly") {
      return "Quarterly Pledge Amount *";
    }

    if (frequency === "Annually") {
      return "Annual Pledge Amount *";
    }

    return "Pledge Amount *";
  }

  function returnToViewMode() {
    if (pledge) {
      setFormData(mapPledgeToFormData(pledge));
    }

    setError(null);
    setMode("view");
  }

  function formatMoney(value: string): string {
    const amount = parseFloat(value);

    if (Number.isNaN(amount)) {
      return "—";
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);

    const amount = parseFloat(formData.pledge_amount);

    if (
      !formData.pledge_type ||
      !formData.status ||
      !formData.frequency ||
      !formData.start_date ||
      isNaN(amount)
    ) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const payload = {
      tenant_id: tenantId,
      partner_id: partnerId,
      pledge_type: formData.pledge_type,
      status: formData.status,
      frequency: formData.frequency,
      pledge_amount: amount,
      number_of_payments: formData.number_of_payments
        ? parseInt(formData.number_of_payments, 10)
        : null,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      on_hold_until: formData.on_hold_until || null,
      notes: formData.notes || null,
    };

    let result;

    if (!isCreate) {
      result = await supabase
        .from("pledges")
        .update(payload)
        .eq("id", pledge.id)
        .eq("tenant_id", tenantId)
        .select("*")
        .single();
    } else {
      result = await supabase
        .from("pledges")
        .insert(payload)
        .select("*")
        .single();
    }

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const savedPledge = result.data as Pledge;

    onSuccess(savedPledge);

    if (isCreate) {
      onClose();
      return;
    }

    setFormData(mapPledgeToFormData(savedPledge));
    setMode("view");
  }

  async function handleArchive() {
    if (!pledge) return;

    const confirmed = window.confirm("Archive this pledge?");

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("pledges")
      .update({
        status: "Canceled",
      })
      .eq("id", pledge.id)
      .eq("tenant_id", tenantId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSuccess({ ...pledge, status: "Canceled" });
    onClose();
  }

  if (!isCreate && mode === "view") {
    const viewPledge = pledge;

    return (
      <SereniusModal
        title="View Pledge"
        description={
          viewPledge
            ? `${viewPledge.pledge_type} · ${viewPledge.frequency} · ${new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
              }).format(viewPledge.pledge_amount ?? 0)}`
            : undefined
        }
        onClose={onClose}
        maxWidth={680}
        contentPadding={0}
        headerActions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMode("edit")}
          >
            Edit Pledge
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
              <label className="form-label">Pledge Type</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.pledge_type || "—"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.status || "—"}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Frequency</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.frequency || "—"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {pledgeAmountLabel(viewPledge?.frequency)}
              </label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatMoney(String(viewPledge?.pledge_amount ?? ""))}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.start_date || "—"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.end_date || "—"}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">On Hold Until</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.on_hold_until || "—"}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payments</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {viewPledge?.number_of_payments || "—"}
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
                {viewPledge?.notes || "—"}
              </div>
            </div>
          </div>
        </div>
      </SereniusModal>
    );
  }

  return (
    <SereniusModal
      title={isCreate ? "New Pledge" : "Edit Pledge"}
      onClose={onClose}
      showCloseButton={isCreate}
      closeOnOverlayClick={isCreate}
      closeOnEscape={isCreate}
      contentPadding={0}
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
        !isCreate && mode === "edit" ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleArchive}
            disabled={saving}
          >
            Archive
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
            form="new-pledge-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : isCreate ? "Create Pledge" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="new-pledge-form" onSubmit={handleSubmit}>
        <div style={{ padding: 24 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pledge Type *</label>

              <select
                className="form-input"
                value={formData.pledge_type}
                onChange={(e) => handleChange("pledge_type", e.target.value)}
              >
                <option value="">Select...</option>

                {PLEDGE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status *</label>

              <select
                className="form-input"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                {PLEDGE_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Frequency *</label>

              <select
                className="form-input"
                value={formData.frequency}
                onChange={(e) => handleChange("frequency", e.target.value)}
              >
                {PLEDGE_FREQUENCIES.map((freq) => (
                  <option key={freq}>{freq}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{pledgeAmountLabel()}</label>

              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={formData.pledge_amount}
                onChange={(e) => handleChange("pledge_amount", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date *</label>

              <input
                type="date"
                className="form-input"
                value={formData.start_date}
                onChange={(e) => handleChange("start_date", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>

              <input
                type="date"
                className="form-input"
                value={formData.end_date}
                onChange={(e) => handleChange("end_date", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>

              <textarea
                rows={4}
                className="form-input"
                style={{ resize: "vertical" }}
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
