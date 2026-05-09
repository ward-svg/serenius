"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Partner } from "@/modules/partners/types";

export type EngagementSignals = {
  emailInteractions: number;
  totalEmailOpens: number;
  highEmailActivityCount: number;
  latestEmailActivityAt: string | null;
  latestGiftAt: string | null;
  latestCommunicationAt: string | null;
  openFollowUpsCount: number;
  inKindGiftCount: number;
};

interface Props {
  partner: Partner;
  activePledgeCount: number;
}

interface SignalsProps extends Props {
  signals?: EngagementSignals | null;
  loading?: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function parseDate(value: string | null): number {
  if (!value) return 0;

  const parsed = new Date(value);
  const time = parsed.getTime();

  return Number.isNaN(time) ? 0 : time;
}

function withinDays(dateStr: string | null, days: number): boolean {
  const time = parseDate(dateStr);
  if (!time) return false;

  const now = Date.now();
  const maxAge = days * 24 * 60 * 60 * 1000;

  return now - time <= maxAge;
}

function highestDate(...values: Array<string | null>): string | null {
  return values.reduce((currentBest, nextValue) => {
    if (!nextValue) return currentBest;
    if (!currentBest) return nextValue;

    return parseDate(nextValue) > parseDate(currentBest)
      ? nextValue
      : currentBest;
  }, null as string | null);
}

function getLabel(score: number, hasData: boolean): string {
  if (!hasData && score === 0) return "No Engagement Data";
  if (score >= 75) return "Highly Engaged";
  if (score >= 40) return "Engaged";
  if (score >= 1) return "Low Engagement";
  return "No Engagement Data";
}

function computeScore(signals: EngagementSignals, activePledgeCount: number) {
  let nextScore = 0;

  // V1 provisional relationship score: lightweight signal, not a financial rank.
  if (signals.totalEmailOpens > 0) nextScore += 15;
  if (signals.highEmailActivityCount > 0) nextScore += 15;
  if (activePledgeCount > 0) nextScore += 25;
  if (withinDays(signals.latestGiftAt, 180)) nextScore += 20;
  if (withinDays(signals.latestCommunicationAt, 180)) nextScore += 15;
  if (signals.inKindGiftCount > 0) nextScore += 5;
  if (signals.openFollowUpsCount > 0) nextScore += 5;

  return Math.min(100, nextScore);
}

function buildSignals(signals: EngagementSignals, activePledgeCount: number) {
  const score = computeScore(signals, activePledgeCount);
  const hasData =
    signals.emailInteractions > 0 ||
    signals.totalEmailOpens > 0 ||
    signals.highEmailActivityCount > 0 ||
    activePledgeCount > 0 ||
    signals.latestGiftAt !== null ||
    signals.latestCommunicationAt !== null ||
    signals.inKindGiftCount > 0 ||
    signals.openFollowUpsCount > 0;

  const label = getLabel(score, hasData);
  const lastActivityAt = highestDate(
    signals.latestEmailActivityAt,
    signals.latestGiftAt,
    signals.latestCommunicationAt,
  );

  const chips = [
    signals.totalEmailOpens > 0 ? "Email Engaged" : null,
    signals.highEmailActivityCount > 0 ? "High Email Activity" : null,
    activePledgeCount > 0 ? "Active Pledge" : null,
    withinDays(signals.latestGiftAt, 180) ? "Recent Gift" : null,
    withinDays(signals.latestCommunicationAt, 180) ? "Personal Contact" : null,
    signals.inKindGiftCount > 0 ? "In-Kind Giving" : null,
    signals.openFollowUpsCount > 0 ? "Follow-Up Open" : null,
  ].filter((chip): chip is string => Boolean(chip));

  return { score, label, lastActivityAt, chips };
}

function usePartnerEngagementSignals({ partner }: Pick<Props, "partner">) {
  const [signals, setSignals] = useState<EngagementSignals>({
    emailInteractions: 0,
    totalEmailOpens: 0,
    highEmailActivityCount: 0,
    latestEmailActivityAt: null,
    latestGiftAt: null,
    latestCommunicationAt: null,
    openFollowUpsCount: 0,
    inKindGiftCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadEngagement() {
      const supabase = createSupabaseBrowserClient();

      const [
        { data: emailOpenData },
        { data: giftData },
        { data: communicationData },
        { data: inKindData },
      ] = await Promise.all([
        supabase
          .from("partner_email_opens")
          .select("open_count, first_opened, last_opened")
          .eq("tenant_id", partner.tenant_id)
          .eq("partner_id", partner.id),
        supabase
          .from("financial_gifts")
          .select("date_given")
          .eq("tenant_id", partner.tenant_id)
          .eq("partner_id", partner.id),
        supabase
          .from("partner_communications")
          .select("communication_date, followup_needed, followup_complete")
          .eq("tenant_id", partner.tenant_id)
          .eq("partner_id", partner.id),
        supabase
          .from("partner_in_kind_gifts")
          .select("date_given")
          .eq("tenant_id", partner.tenant_id)
          .eq("partner_id", partner.id),
      ]);

      if (!isMounted) return;

      const emailInteractions = emailOpenData ?? [];
      const totalEmailOpens = emailInteractions.reduce(
        (sum, interaction) => sum + (interaction.open_count ?? 0),
        0,
      );
      const highEmailActivityCount = emailInteractions.filter(
        (interaction) => (interaction.open_count ?? 0) >= 5,
      ).length;
      const latestEmailActivityAt = highestDate(
        ...emailInteractions.map((interaction) => interaction.last_opened),
        ...emailInteractions.map((interaction) => interaction.first_opened),
      );

      const latestGiftAt = highestDate(
        ...(giftData ?? []).map((gift) => gift.date_given),
      );

      const latestCommunicationAt = highestDate(
        ...(communicationData ?? []).map((communication) =>
          communication.communication_date,
        ),
      );

      const openFollowUpsCount = (communicationData ?? []).filter(
        (communication) =>
          communication.followup_needed && !communication.followup_complete,
      ).length;

      const inKindGiftCount = (inKindData ?? []).length;

      setSignals({
        emailInteractions: emailInteractions.length,
        totalEmailOpens,
        highEmailActivityCount,
        latestEmailActivityAt,
        latestGiftAt,
        latestCommunicationAt,
        openFollowUpsCount,
        inKindGiftCount,
      });
      setLoading(false);
    }

    void loadEngagement();

    return () => {
      isMounted = false;
    };
  }, [partner.id, partner.tenant_id]);

  return { signals, loading };
}

export default function PartnerEngagementCard({
  partner,
  activePledgeCount,
}: Props) {
  const { signals, loading } = usePartnerEngagementSignals({ partner });
  const derived = useMemo(
    () => buildSignals(signals, activePledgeCount),
    [activePledgeCount, signals],
  );

  return (
    <div className="stat-card">
      <div className="stat-label">Engagement</div>
      <div
        className="stat-value"
        style={{
          fontSize: 22,
          color: derived.score > 0 ? "var(--color-primary)" : "var(--color-text-secondary)",
        }}
      >
        {loading ? "—" : derived.score}
      </div>
      <div className="stat-sub">
        {loading ? "Loading engagement snapshot..." : derived.label}
      </div>
      <div className="stat-sub" style={{ marginTop: 8 }}>
        Last activity: {loading ? "—" : formatDate(derived.lastActivityAt)}
      </div>
    </div>
  );
}

export function PartnerEngagementSignals({
  partner,
  activePledgeCount,
}: Props) {
  const { signals, loading } = usePartnerEngagementSignals({ partner });
  const derived = useMemo(
    () => buildSignals(signals, activePledgeCount),
    [activePledgeCount, signals],
  );

  if (loading || derived.chips.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      {derived.chips.map((chip) => (
        <span
          key={chip}
          className="badge"
          style={{
            background: "var(--color-background-secondary)",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border-secondary)",
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}
