import type { PartnerTab } from "./types";

export const PARTNER_TABS: {
  key: PartnerTab;
  label: string;
}[] = [
  {
    key: "active",
    label: "Active Partners",
  },
  {
    key: "prospects",
    label: "Prospects",
  },
  {
    key: "staff",
    label: "Staff / Volunteers",
  },
  {
    key: "past",
    label: "Past Relationships",
  },
];

export const PLEDGE_TYPES = [
  "Rescue Care",
  "House Sponsor",
  "General Fund",
  "Pathways Sponsorship",
];

export const PLEDGE_STATUSES = [
  "Active",
  "Completed",
  "Canceled",
  "Increased",
  "On Hold",
];

export const PLEDGE_FREQUENCIES = ["Monthly", "Quarterly", "Annually"];

export const GIFT_PROCESSING_SOURCES = [
  "Check",
  "Stripe - Website",
  "Authorize - Website",
  "Paypal",
  "Venmo",
  "Gift In-Kind/New",
  "Wire Transfer",
  "Zelle",
];
export const GIFT_TOWARDS_OPTIONS = [
  "Rescue Care",
  "House Sponsor",
  "General Fund",
  "Pathways Sponsorship",
  "Child Sponsorship",
  "Special Project",
  "Mission Trip",
  "One-Time Gift",
  "Other",
];
