"use client";

import { useEffect, useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import SortableHeader from "@/components/ui/SortableHeader";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  nextSortState,
  sortByValue,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import type {
  OrganizationMailConnection,
  OrganizationMailSettings,
  OrganizationMailTestRecipient,
  SetupIntegrationNotice,
} from "./types";

interface MailSenderSectionProps {
  tenantId: string;
  tenantSlug: string;
  mailIntegrationNotice?: SetupIntegrationNotice | null;
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

type RecipientSortKey = "name" | "email" | "notes";

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

function humanizeMailStatus(value: string | null | undefined): string {
  if (!value) return "—";
  switch (value) {
    case "test_only":
      return "Test only";
    case "disabled":
      return "Disabled";
    case "live":
      return "Live";
    case "connected":
      return "Connected";
    case "manual":
      return "Manual";
    case "error":
      return "Error";
    default:
      return value
        .split(/[_-]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function getTestSendDisableReason(options: {
  hasMailCredentials: boolean;
  connectionStatus: string | null | undefined;
  isEnabled: boolean | null | undefined;
  sendMode: MailSenderFormState["send_mode"] | null | undefined;
  activeRecipientCount: number;
}): string {
  const reasons: string[] = [];

  if (!options.hasMailCredentials) {
    reasons.push("Connect Google Workspace.");
  }
  if (options.connectionStatus !== "connected") {
    reasons.push("Connect Google Workspace.");
  }
  if (options.isEnabled !== true) {
    reasons.push("Enable the sender.");
  }
  if (options.sendMode !== "test_only") {
    if (options.sendMode === "live") {
      reasons.push("Set Send Mode to Test only.");
    } else {
      reasons.push("Set Send Mode to Test only.");
    }
  }
  if (options.activeRecipientCount <= 0) {
    reasons.push("Add at least one active test recipient.");
  }

  const uniqueReasons = Array.from(new Set(reasons));
  if (uniqueReasons.length === 1 && uniqueReasons[0] === "Set Send Mode to Test only.") {
    return "Set Send Mode to Test only to enable test sending.";
  }
  if (uniqueReasons.length === 0) {
    return "Ready to send to configured test recipients.";
  }
  return uniqueReasons.join(" ");
}

function getTestSendReadyText(activeRecipientCount: number): string {
  return `Ready to send to ${activeRecipientCount} active test recipient${
    activeRecipientCount === 1 ? "" : "s"
  }.`;
}

function getRecipientSortValue(
  recipient: OrganizationMailTestRecipient,
  key: RecipientSortKey,
): SortValue {
  switch (key) {
    case "name":
      return recipient.display_name;
    case "email":
      return recipient.email;
    case "notes":
      return recipient.notes;
  }
}

export default function MailSenderSection({
  tenantId,
  tenantSlug,
  mailIntegrationNotice,
}: MailSenderSectionProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationMailSettings | null>(null);
  const [mailConnection, setMailConnection] = useState<OrganizationMailConnection | null>(null);
  const [recipients, setRecipients] = useState<OrganizationMailTestRecipient[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [settingsForm, setSettingsForm] = useState<MailSenderFormState>(buildDefaultMailSenderForm());
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [connectingMail, setConnectingMail] = useState(false);
  const [disconnectingMail, setDisconnectingMail] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testSendError, setTestSendError] = useState<string | null>(null);
  const [testSendSuccess, setTestSendSuccess] = useState<string | null>(null);
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<OrganizationMailTestRecipient | null>(null);
  const [recipientForm, setRecipientForm] = useState<RecipientFormState>(buildDefaultRecipientForm());
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [recipientSort, setRecipientSort] = useState<SortState<RecipientSortKey> | null>(null);

  const activeRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.is_active),
    [recipients],
  );
  const visibleRecipients = useMemo(() => {
    const filteredRecipients = showInactive ? recipients : activeRecipients;
    return sortByValue(filteredRecipients, recipientSort, getRecipientSortValue);
  }, [activeRecipients, recipientSort, recipients, showInactive]);
  const hasMailCredentials =
    mailConnection?.credentialsConnected === true ||
    Boolean(settings?.provider_account_email)
  const canConnectMail = !connectingMail;
  const canDisconnectMail =
    hasMailCredentials ||
    settings?.connection_status === "connected"
  const canSendTestEmail =
    hasMailCredentials &&
    settings?.connection_status === "connected" &&
    settings?.is_enabled === true &&
    settings?.send_mode === "test_only" &&
    activeRecipients.length > 0;
  const sendTestHelpText = getTestSendDisableReason({
    hasMailCredentials,
    connectionStatus: settings?.connection_status,
    isEnabled: settings?.is_enabled,
    sendMode: settings?.send_mode,
    activeRecipientCount: activeRecipients.length,
  });

  const sendModeOptions: { value: MailSenderFormState["send_mode"]; label: string }[] = [
    { value: "disabled", label: "Disabled" },
    { value: "test_only", label: "Test only" },
    { value: "live", label: "Live" },
  ];

  async function loadMailSender() {
    setLoading(true);

    try {
      const [settingsRes, recipientsRes, statusRes] = await Promise.all([
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
        fetch(`/api/mail/google/status?tenantId=${encodeURIComponent(tenantId)}`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      const statusJson = statusRes.ok
        ? ((await statusRes.json().catch(() => null)) as
          | { connection?: OrganizationMailConnection | null }
          | null)
        : null

      setSettings((settingsRes.data ?? null) as OrganizationMailSettings | null);
      setRecipients((recipientsRes.data ?? []) as OrganizationMailTestRecipient[]);
      setMailConnection(statusJson?.connection ?? null);
      setSettingsForm(mapSettingsToForm((settingsRes.data ?? null) as OrganizationMailSettings | null));
      setSettingsError(null);
      setSettingsSuccess(null);
      setTestSendError(null);
      setTestSendSuccess(null);
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

  function connectGoogleWorkspace() {
    if (!canConnectMail) return

    setConnectingMail(true)
    const url = `/api/mail/google/connect?tenantId=${encodeURIComponent(tenantId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`
    window.location.assign(url)
  }

  async function disconnectGoogleWorkspace() {
    if (!canDisconnectMail) return

    const confirmed = window.confirm('Disconnect Google Workspace from this tenant?')
    if (!confirmed) return

    setDisconnectingMail(true)
    setSettingsError(null)

    try {
      const response = await fetch(
        `/api/mail/google/disconnect?tenantId=${encodeURIComponent(tenantId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        },
      )

      const payload = await response.json().catch(() => null) as
        | { ok?: boolean; error?: string }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Failed to disconnect Google Workspace.')
      }

      await loadMailSender()
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Failed to disconnect Google Workspace.')
    } finally {
      setDisconnectingMail(false)
    }
  }

  async function sendTestEmail() {
    if (!canSendTestEmail) return

    setSendingTestEmail(true)
    setTestSendError(null)
    setTestSendSuccess(null)

    try {
      const response = await fetch(
        `/api/mail/google/test-send?tenantId=${encodeURIComponent(tenantId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        },
      )

      const payload = await response.json().catch(() => null) as
        | {
            ok?: boolean
            error?: string
            recipients_attempted?: number
            recipients_sent?: number
            failed_recipients?: Array<{ email: string; error: string }>
          }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Failed to send test email.')
      }

      const failedCount = payload.failed_recipients?.length ?? 0
      const sentCount = payload.recipients_sent ?? 0
      setTestSendSuccess(
        failedCount > 0
          ? `Sent ${sentCount} test email${sentCount === 1 ? '' : 's'}. ${failedCount} recipient${failedCount === 1 ? '' : 's'} failed.`
          : `Sent ${sentCount} test email${sentCount === 1 ? '' : 's'} to configured test recipients.`,
      )
      await loadMailSender()
      window.setTimeout(() => setTestSendSuccess(null), 5000)
    } catch (error) {
      setTestSendError(error instanceof Error ? error.message : 'Failed to send test email.')
    } finally {
      setSendingTestEmail(false)
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
      {mailIntegrationNotice && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            mailIntegrationNotice.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {mailIntegrationNotice.message}
        </div>
      )}

      <div className="section-card p-6" id="mail-sender">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Mail Sender</h2>
            <p className="text-xs text-gray-400 mt-1">
              Marketing mail settings and test recipients for this tenant.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              Google Workspace
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              {humanizeMailStatus(settings?.connection_status ?? "disabled")}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              style={
                settings?.send_mode === "live"
                  ? { background: "#dcfce7", color: "#15803d" }
                  : settings?.send_mode === "test_only"
                    ? { background: "#fef3c7", color: "#92400e" }
                    : { background: "#f3f4f6", color: "#6b7280" }
              }
            >
              Send mode: {humanizeMailStatus(settings?.send_mode ?? "disabled")}
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              Active test recipients: {activeRecipients.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="md:col-span-2 xl:col-span-3">
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
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="form-helper text-xs text-gray-500">
                  {settingsForm.send_mode === "disabled"
                    ? "No emails will be sent."
                    : settingsForm.send_mode === "test_only"
                      ? "Only configured test recipients can receive emails."
                      : "Live campaign sending is enabled. Campaigns still require readiness checks before sending."}
                </p>
              </div>
              <div className="flex items-center">
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
              </div>
            </div>
          </div>

          <div className="section-card p-4" style={{ marginBottom: 0, boxShadow: "none" }}>
            <div className="section-header">
              <span className="section-title">Connection</span>
              <span className="section-count">{humanizeMailStatus(settings?.connection_status ?? "disabled")}</span>
            </div>
            <div className="space-y-2 pt-1">
              <div className="text-sm text-gray-700">
                <span className="font-medium">Provider:</span> Google Workspace
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Status:</span> {humanizeMailStatus(settings?.connection_status ?? "disabled")}
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Account:</span>{" "}
                {mailConnection?.external_account_name ||
                  settings?.provider_account_name ||
                  mailConnection?.external_account_email ||
                  settings?.provider_account_email ||
                  "—"}
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-medium">Connected:</span> {formatDateTime(settings?.connected_at)}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={connectGoogleWorkspace}
                  disabled={!canConnectMail}
                  title="Connect Google Workspace for this tenant."
                >
                  {settings?.connection_status === "connected"
                    ? "Reconnect Google Workspace"
                    : "Connect Google Workspace"}
                </button>
                {canDisconnectMail && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={disconnectGoogleWorkspace}
                    disabled={disconnectingMail}
                  >
                    {disconnectingMail ? "Disconnecting…" : "Disconnect"}
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500 leading-5">
                {settings?.connection_status === "connected"
                  ? "Google Workspace is connected."
                  : "Connect Google Workspace before using test sends."}
              </div>
            </div>
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
              Reset Changes
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

        <div className="border-t border-gray-100 pt-4 mt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">Test Send</div>
              <p className="text-xs text-gray-500 mt-1">
                Test sends only go to the active test recipients configured below. Partner/contact campaign sending is not enabled yet.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={sendTestEmail}
                disabled={!canSendTestEmail || sendingTestEmail}
                title={
                  !hasMailCredentials
                    ? "Connect Google Workspace before sending a test email."
                    : settings?.connection_status !== "connected"
                      ? "Google Workspace must be connected before sending a test email."
                      : settings?.is_enabled !== true
                        ? "Enable the mail sender before sending a test email."
                        : settings?.send_mode !== "test_only"
                          ? "Set Send Mode to Test only before sending a test email."
                          : activeRecipients.length === 0
                            ? "Add at least one active test recipient before sending a test email."
                            : undefined
                }
              >
                {sendingTestEmail ? "Sending…" : "Send Test Email"}
              </button>
              <span className="text-xs text-gray-500 max-w-md">
                {canSendTestEmail
                  ? getTestSendReadyText(activeRecipients.length)
                  : sendTestHelpText}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card p-6" id="mail-test-recipients">
        <div className="section-header">
          <span className="section-title">Test Recipients</span>
          <span className="section-count">{activeRecipients.length}</span>
          <div className="section-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openRecipientModal()}>
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
          <span className="text-xs text-gray-400">Active recipients are used for test sending.</span>
        </div>

        {visibleRecipients.length === 0 ? (
          <div className="empty-state">No active test recipients configured yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortableHeader
                    label="Name"
                    sortKey="name"
                    sort={recipientSort}
                    onSort={(key) => setRecipientSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Email"
                    sortKey="email"
                    sort={recipientSort}
                    onSort={(key) => setRecipientSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Notes"
                    sortKey="notes"
                    sort={recipientSort}
                    onSort={(key) => setRecipientSort((current) => nextSortState(current, key))}
                  />
                  <th>ACTIVE</th>
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
                          onClick={() => deleteRecipient(recipient)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                    <td>{recipient.display_name || "—"}</td>
                    <td>{recipient.email}</td>
                    <td>{recipient.notes || "—"}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(recipient.is_active)}
                        onChange={() => toggleRecipientActive(recipient)}
                        className="h-4 w-4 rounded border-gray-300 text-[color:var(--color-primary)] focus:ring-[color:var(--color-primary)]"
                        aria-label={recipient.is_active ? `Deactivate ${recipient.email}` : `Activate ${recipient.email}`}
                      />
                    </td>
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
