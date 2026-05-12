"use client";

import { useEffect, useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  OrganizationMailSettings,
  OrganizationMailTestRecipient,
} from "./types";

interface MailSenderSectionProps {
  tenantId: string;
}

type MailSenderFormState = {
  display_name: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  is_enabled: boolean;
  send_mode: "disabled" | "test_only" | "live";
}

type RecipientFormState = {
  display_name: string;
  email: string;
  notes: string;
  is_active: boolean;
}

function buildDefaultMailSenderForm(): MailSenderFormState {
  return {
    display_name: "",
    from_name: "",
    from_email: "",
    reply_to: "",
    is_enabled: false,
    send_mode: "disabled",
  };
}

function mapSettingsToForm(settings: OrganizationMailSettings | null): MailSenderFormState {
  return {
    display_name: settings?.display_name ?? "",
    from_name: settings?.from_name ?? "",
    from_email: settings?.from_email ?? "",
    reply_to: settings?.reply_to ?? "",
    is_enabled: Boolean(settings?.is_enabled),
    send_mode: (settings?.send_mode as MailSenderFormState["send_mode"]) ?? "disabled",
  };
}

function buildDefaultRecipientForm(): RecipientFormState {
  return {
    display_name: "",
    email: "",
    notes: "",
    is_active: true,
  };
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function MailSenderSection({ tenantId }: MailSenderSectionProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationMailSettings | null>(null);
  const [recipients, setRecipients] = useState<OrganizationMailTestRecipient[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [settingsForm, setSettingsForm] = useState<MailSenderFormState>(buildDefaultMailSenderForm());
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<OrganizationMailTestRecipient | null>(null);
  const [recipientForm, setRecipientForm] = useState<RecipientFormState>(buildDefaultRecipientForm());
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [savingRecipient, setSavingRecipient] = useState(false);

  const activeRecipients = recipients.filter((recipient) => recipient.is_active);
  const visibleRecipients = showInactive ? recipients : activeRecipients;

  const sendModeOptions: { value: MailSenderFormState["send_mode"]; label: string; disabled?: boolean }[] =
    settings?.send_mode === "live"
      ? [
          { value: "live", label: "Live (existing)", disabled: true },
          { value: "disabled", label: "Disabled" },
          { value: "test_only", label: "Test only" },
        ]
      : [
          { value: "disabled", label: "Disabled" },
          { value: "test_only", label: "Test only" },
        ];

  async function loadMailSender() {
    setLoading(true);

    try {
      const [settingsRes, recipientsRes] = await Promise.all([
        supabase
          .from("organization_mail_settings")
          .select(
            "id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode, locked_at, locked_by, connected_at, connected_by, created_at, updated_at",
          )
          .eq("tenant_id", tenantId)
          .eq("provider", "google_workspace")
          .maybeSingle(),
        supabase
          .from("organization_mail_test_recipients")
          .select("id, tenant_id, email, display_name, is_active, notes, created_by, created_at, updated_at")
          .eq("tenant_id", tenantId)
          .order("email", { ascending: true }),
      ]);

      setSettings((settingsRes.data ?? null) as OrganizationMailSettings | null);
      setRecipients((recipientsRes.data ?? []) as OrganizationMailTestRecipient[]);
      setSettingsForm(mapSettingsToForm((settingsRes.data ?? null) as OrganizationMailSettings | null));
      setSettingsError(null);
      setSettingsSuccess(null);
      setRecipientError(null);
      setEditingRecipient(null);
      setRecipientForm(buildDefaultRecipientForm());
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to load mail sender settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMailSender();
  }, [tenantId]);

  async function saveMailSenderSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      if (settings?.send_mode === "live" && settingsForm.send_mode !== "live") {
        // allowed; live is only preserved if already present and unchanged
      }

      const payload = {
        tenant_id: tenantId,
        provider: "google_workspace" as const,
        display_name: settingsForm.display_name.trim() || null,
        from_name: settingsForm.from_name.trim() || null,
        from_email: settingsForm.from_email.trim() || null,
        reply_to: settingsForm.reply_to.trim() || null,
        is_enabled: settingsForm.is_enabled,
        send_mode: settingsForm.send_mode,
        connection_status: settings?.connection_status ?? "manual",
        provider_account_email: settings?.provider_account_email ?? null,
        provider_account_name: settings?.provider_account_name ?? null,
        connected_at: settings?.connected_at ?? null,
        connected_by: settings?.connected_by ?? null,
        locked_at: settings?.locked_at ?? null,
        locked_by: settings?.locked_by ?? null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("organization_mail_settings")
        .upsert(payload, { onConflict: "tenant_id,provider" })
        .select(
          "id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode, locked_at, locked_by, connected_at, connected_by, created_at, updated_at",
        )
        .single();

      if (error || !data) {
        throw error ?? new Error("Failed to save mail sender settings.");
      }

      setSettings(data as OrganizationMailSettings);
      setSettingsForm(mapSettingsToForm(data as OrganizationMailSettings));
      setSettingsSuccess("Mail sender settings saved.");
      window.setTimeout(() => setSettingsSuccess(null), 3000);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to save mail sender settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function openRecipientModal(recipient?: OrganizationMailTestRecipient) {
    setEditingRecipient(recipient ?? null);
    setRecipientForm(
      recipient
        ? {
            display_name: recipient.display_name ?? "",
            email: recipient.email,
            notes: recipient.notes ?? "",
            is_active: Boolean(recipient.is_active),
          }
        : buildDefaultRecipientForm(),
    );
    setRecipientError(null);
    setShowRecipientModal(true);
  }

  async function saveRecipient() {
    setSavingRecipient(true);
    setRecipientError(null);

    try {
      const email = recipientForm.email.trim();
      if (!email) {
        throw new Error("Email is required.");
      }
      if (!isValidEmail(email)) {
        throw new Error("Enter a valid email address.");
      }

      const duplicate = recipients.find(
        (recipient) =>
          recipient.email.trim().toLowerCase() === email.toLowerCase() &&
          recipient.id !== editingRecipient?.id,
      );
      if (duplicate) {
        throw new Error("A recipient with that email already exists.");
      }

      const payload = {
        tenant_id: tenantId,
        display_name: recipientForm.display_name.trim() || null,
        email,
        notes: recipientForm.notes.trim() || null,
        is_active: recipientForm.is_active,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (editingRecipient) {
        result = await supabase
          .from("organization_mail_test_recipients")
          .update(payload)
          .eq("id", editingRecipient.id)
          .eq("tenant_id", tenantId)
          .select("id, tenant_id, email, display_name, is_active, notes, created_by, created_at, updated_at")
          .single();
      } else {
        result = await supabase
          .from("organization_mail_test_recipients")
          .insert({
            ...payload,
            created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
          })
          .select("id, tenant_id, email, display_name, is_active, notes, created_by, created_at, updated_at")
          .single();
      }

      if (result.error || !result.data) {
        throw result.error ?? new Error("Failed to save test recipient.");
      }

      await loadMailSender();
      setShowRecipientModal(false);
    } catch (error) {
      setRecipientError(error instanceof Error ? error.message : "Failed to save test recipient.");
    } finally {
      setSavingRecipient(false);
    }
  }

  async function toggleRecipientActive(recipient: OrganizationMailTestRecipient) {
    const nextIsActive = !recipient.is_active
    const confirmed = window.confirm(
      nextIsActive
        ? `Reactivate ${recipient.email}?`
        : `Deactivate ${recipient.email}?`,
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("organization_mail_test_recipients")
      .update({ is_active: nextIsActive, updated_at: new Date().toISOString() })
      .eq("id", recipient.id)
      .eq("tenant_id", tenantId);

    if (error) {
      setRecipientError(error.message);
      return;
    }

    await loadMailSender();
  }

  async function deleteRecipient(recipient: OrganizationMailTestRecipient) {
    const confirmed = window.confirm(
      `Permanently delete test recipient ${recipient.email}?`,
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("organization_mail_test_recipients")
      .delete()
      .eq("id", recipient.id)
      .eq("tenant_id", tenantId);

    if (error) {
      setRecipientError(error.message);
      return;
    }

    await loadMailSender();
  }

  if (loading) {
    return (
      <div className="section-card p-6">
        <div className="empty-state">Loading mail sender…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="section-card p-6" id="mail-sender">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Mail Sender</h2>
            <p className="text-xs text-gray-400 mt-1">
              Marketing mail settings and test recipients for this tenant.
            </p>
          </div>
          <a href="#mail-sender-settings" className="action-link">
            Manage Mail Sender
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="section-card p-4" style={{ marginBottom: 0, boxShadow: "none" }}>
            <div className="section-header">
              <span className="section-title">Google Workspace</span>
              <span className="section-count">{settings?.connection_status ?? "Not configured"}</span>
            </div>
            <div style={{ paddingTop: 4, display: "grid", gap: 6 }}>
              <div className="text-sm text-gray-700">
                Send mode: {settings?.send_mode ?? "disabled"}
              </div>
              <div className="text-sm text-gray-700">
                From email: {settings?.from_email ?? "—"}
              </div>
              <div className="text-sm text-gray-700">
                Reply-to: {settings?.reply_to ?? "—"}
              </div>
              <div className="text-sm text-gray-700">
                Test recipients: {activeRecipients.length}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Microsoft 365, Custom SMTP, and Amazon SES are coming soon.
              </div>
            </div>
          </div>

          <div className="section-card p-4" style={{ marginBottom: 0, boxShadow: "none" }}>
            <div className="section-header">
              <span className="section-title">Status</span>
            </div>
            <div style={{ paddingTop: 4 }}>
              <div className="text-sm text-gray-700">
                {settings?.connection_status ?? "Not configured"}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {settings?.send_mode ?? "disabled"} sending mode
              </div>
            </div>
          </div>

          <div className="section-card p-4" style={{ marginBottom: 0, boxShadow: "none" }}>
            <div className="section-header">
              <span className="section-title">Test Recipients</span>
            </div>
            <div style={{ paddingTop: 4 }}>
              <div className="text-sm text-gray-700">{activeRecipients.length} active</div>
              <div className="mt-2 text-xs text-gray-500">
                Recipients used for test sends after setup is enabled.
              </div>
            </div>
          </div>
        </div>

        {!settings && (
          <div className="empty-state mt-4" style={{ textAlign: "left" }}>
            Mail sender is not configured yet.
          </div>
        )}
      </div>

      <div className="section-card p-6" id="mail-sender-settings">
        <div className="section-header">
          <span className="section-title">Mail Sender Settings</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Provider</label>
            <input
              className="form-input"
              type="text"
              value="Google Workspace"
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="form-label">Connection Status</label>
            <input
              className="form-input"
              type="text"
              value={settings?.connection_status ?? "Not configured"}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="form-label">Provider Account Email</label>
            <input
              className="form-input"
              type="text"
              value={settings?.provider_account_email ?? ""}
              readOnly
              disabled
              placeholder="—"
            />
          </div>
          <div>
            <label className="form-label">Provider Account Name</label>
            <input
              className="form-input"
              type="text"
              value={settings?.provider_account_name ?? ""}
              readOnly
              disabled
              placeholder="—"
            />
          </div>
          <div>
            <label className="form-label">Connected At</label>
            <input
              className="form-input"
              type="text"
              value={formatDateTime(settings?.connected_at)}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="form-label">Connected By</label>
            <input
              className="form-input"
              type="text"
              value={settings?.connected_by ?? ""}
              readOnly
              disabled
              placeholder="—"
            />
          </div>
          <div>
            <label className="form-label">Locked At</label>
            <input
              className="form-input"
              type="text"
              value={formatDateTime(settings?.locked_at)}
              readOnly
              disabled
            />
          </div>
          <div>
            <label className="form-label">Locked By</label>
            <input
              className="form-input"
              type="text"
              value={settings?.locked_by ?? ""}
              readOnly
              disabled
              placeholder="—"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              type="text"
              value={settingsForm.display_name}
              onChange={(e) => setSettingsForm((prev) => ({ ...prev, display_name: e.target.value }))}
              placeholder="Serenius Mail"
            />
          </div>
          <div>
            <label className="form-label">From Name</label>
            <input
              className="form-input"
              type="text"
              value={settingsForm.from_name}
              onChange={(e) => setSettingsForm((prev) => ({ ...prev, from_name: e.target.value }))}
              placeholder="Serenius"
            />
          </div>
          <div>
            <label className="form-label">From Email</label>
            <input
              className="form-input"
              type="email"
              value={settingsForm.from_email}
              onChange={(e) => setSettingsForm((prev) => ({ ...prev, from_email: e.target.value }))}
              placeholder="hello@example.org"
            />
          </div>
          <div>
            <label className="form-label">Reply-To</label>
            <input
              className="form-input"
              type="email"
              value={settingsForm.reply_to}
              onChange={(e) => setSettingsForm((prev) => ({ ...prev, reply_to: e.target.value }))}
              placeholder="replies@example.org"
            />
          </div>
          <div>
            <label className="form-label">Send Mode</label>
            <select
              className="form-input"
              value={settingsForm.send_mode}
              onChange={(e) =>
                setSettingsForm((prev) => ({
                  ...prev,
                  send_mode: e.target.value as MailSenderFormState["send_mode"],
                }))
              }
            >
              {sendModeOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="form-helper">
              Live sending will be enabled after Google Workspace test sending and suppression checks are verified.
            </p>
            {settings?.send_mode === "live" && (
              <p className="form-helper" style={{ color: "#b45309" }}>
                Live sending is already configured for this tenant. It is shown here for reference only and cannot be newly selected in this slice.
              </p>
            )}
          </div>
          <div className="lg:col-span-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settingsForm.is_enabled}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    is_enabled: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-[color:var(--color-primary)] focus:ring-[color:var(--color-primary)]"
              />
              Enabled
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled
              title="Connect Google Workspace — Coming soon"
            >
              Connect Google Workspace — Coming soon
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="space-y-2">
            {settingsError && <p className="text-sm text-red-600">{settingsError}</p>}
            {settingsSuccess && <p className="text-sm text-green-600">{settingsSuccess}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSettingsForm(mapSettingsToForm(settings))}
              disabled={savingSettings}
            >
              Discard Changes
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveMailSenderSettings}
              disabled={savingSettings}
            >
              {savingSettings ? "Saving..." : "Save Mail Sender Settings"}
            </button>
          </div>
        </div>
      </div>

      <div className="section-card p-6" id="mail-test-recipients">
        <div className="section-header">
          <span className="section-title">Test Recipients</span>
          <span className="section-count">{activeRecipients.length}</span>
          <div className="section-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => openRecipientModal()}
            >
              + Add Recipient
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-[color:var(--color-primary)] focus:ring-[color:var(--color-primary)]"
            />
            Show inactive recipients
          </label>
          <span className="text-xs text-gray-400">
            Active recipients are used for test sending.
          </span>
        </div>

        {visibleRecipients.length === 0 ? (
          <div className="empty-state">
            No active test recipients configured yet.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecipients.map((recipient) => (
                  <tr key={recipient.id} style={!recipient.is_active ? { opacity: 0.72 } : undefined}>
                    <td className="actions-column">
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => openRecipientModal(recipient)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="action-link-danger"
                          onClick={() => toggleRecipientActive(recipient)}
                        >
                          {recipient.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        {!recipient.is_active && (
                          <button
                            type="button"
                            className="action-link-danger"
                            onClick={() => deleteRecipient(recipient)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{recipient.display_name || "—"}</td>
                    <td>{recipient.email}</td>
                    <td>{recipient.notes || "—"}</td>
                    <td>{recipient.is_active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recipientError && <p className="mt-4 text-sm text-red-600">{recipientError}</p>}
      </div>

      {showRecipientModal && (
        <SereniusModal
          title={editingRecipient ? "Edit Test Recipient" : "Add Test Recipient"}
          description="Test recipients are used for validation and manual test sends."
          onClose={() => setShowRecipientModal(false)}
          maxWidth={720}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowRecipientModal(false)} disabled={savingRecipient}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={saveRecipient} disabled={savingRecipient}>
                {savingRecipient ? "Saving..." : editingRecipient ? "Save Changes" : "Add Recipient"}
              </button>
            </>
          }
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="form-input"
                type="text"
                value={recipientForm.display_name}
                onChange={(e) => setRecipientForm((prev) => ({ ...prev, display_name: e.target.value }))}
                placeholder="Jane Doe"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={recipientForm.email}
                onChange={(e) => setRecipientForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="jane@example.org"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={4}
                value={recipientForm.notes}
                onChange={(e) => setRecipientForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal note"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={recipientForm.is_active}
                onChange={(e) => setRecipientForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[color:var(--color-primary)] focus:ring-[color:var(--color-primary)]"
              />
              Active
            </label>
            {recipientError && <p className="text-sm text-red-600">{recipientError}</p>}
          </div>
        </SereniusModal>
      )}
    </div>
  );
}
