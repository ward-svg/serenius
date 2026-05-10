"use client";

import { useEffect, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { normalizePhone } from "@/lib/formatPhone";
import type { Partner } from "@/types/partners";

interface Props {
  orgId: string | null;
  onClose: () => void;
  onSuccess: (newPartner: Partner) => void;
}

interface ContactCard {
  id: string;
  included: boolean;
  name_first: string;
  name_last: string;
  relationship: string;
  email: string;
  phone: string;
}

type StaffUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const ENTITY_TYPES = ["Church", "Business", "Organization", "School"];

function parseContacts(
  nameFirst: string,
  nameLast: string,
  email: string,
  phone: string,
): ContactCard[] {
  const paired = nameFirst.match(/^(.+?)\s+(?:&|and)\s+(.+?)$/i);

  if (paired) {
    return [
      {
        id: "1",
        included: true,
        name_first: paired[1].trim(),
        name_last: nameLast,
        relationship: "Husband",
        email,
        phone,
      },
      {
        id: "2",
        included: true,
        name_first: paired[2].trim(),
        name_last: nameLast,
        relationship: "Wife",
        email: "",
        phone: "",
      },
    ];
  }

  return [
    {
      id: "1",
      included: true,
      name_first: nameFirst,
      name_last: nameLast,
      relationship: "Self",
      email,
      phone,
    },
  ];
}

export default function AddPartnerModal({ orgId, onClose, onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [partnerType, setPartnerType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [newPartner, setNewPartner] = useState<Partner | null>(null);
  const [contacts, setContacts] = useState<ContactCard[]>([]);
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [assignedTo, setAssignedTo] = useState("");

  const isEntityType = ENTITY_TYPES.includes(partnerType);
  const includedCount = contacts.filter((c) => c.included).length;

  useEffect(() => {
    let isMounted = true;

    if (!orgId) {
      setStaff([]);
      return () => {
        isMounted = false;
      };
    }

    supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .eq("tenant_id", orgId)
      .order("full_name")
      .then(({ data }) => {
        if (!isMounted) return;
        setStaff((data ?? []) as StaffUser[]);
      });

    return () => {
      isMounted = false;
    };
  }, [orgId, supabase]);

  function handlePhoneInput(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
  ) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);

    let formatted = digits;

    if (digits.length >= 7) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(
        3,
        6,
      )}-${digits.slice(6)}`;
    } else if (digits.length >= 4) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length >= 1) {
      formatted = `(${digits}`;
    }

    setter(formatted);
  }

  async function handleStep1Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formElement = e.currentTarget;

    setError(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const fd = new FormData(formElement);
    const str = (key: string) => ((fd.get(key) as string) ?? "").trim();
    const strOrNull = (key: string) => str(key) || null;

    const nameFirst = str("name_first");
    const nameLast = str("name_last");
    const entityName = strOrNull("entity_name");
    const email = str("primary_email");
    const phone = normalizePhone(primaryPhone);

    const displayName = isEntityType
      ? (entityName ?? `${nameFirst} ${nameLast}`.trim())
      : `${nameFirst}${nameLast ? ` ${nameLast}` : ""}`.trim();

    const { data: inserted, error: insertError } = await supabase
      .from("partners")
      .insert({
        display_name: displayName,
        correspondence_greeting: strOrNull("correspondence_greeting"),
        entity_name: entityName,
        partner_type: partnerType || null,
        partner_status: strOrNull("partner_status"),
        relationship_type: strOrNull("relationship_type"),
        primary_email: email || null,
        primary_phone: phone || null,
        primary_phone_type: strOrNull("primary_phone_type"),
        secondary_phone: normalizePhone(secondaryPhone) || null,
        secondary_phone_type: strOrNull("secondary_phone_type"),
        created_by: user?.id ?? null,
        assigned_to: assignedTo || null,
        address_street: strOrNull("street1"),
        address_street2: strOrNull("street2"),
        address_city: strOrNull("city"),
        address_state: strOrNull("state"),
        address_zip: strOrNull("zip"),
        tenant_id: orgId,
      })
      .select("*")
      .single();

    setSaving(false);

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Failed to save partner.");
      return;
    }

    setPartnerId(inserted.id as string);
    setNewPartner(inserted as Partner);
    setContacts(parseContacts(nameFirst, nameLast, email, phone));
    setStep(2);
  }

  async function handleStep2Submit() {
    if (!partnerId || !newPartner) return;

    setSaving(true);
    setError(null);

    const rows = contacts
      .filter((c) => c.included)
      .map((c) => ({
        tenant_id: orgId,
        partner_id: partnerId,
        first_name: c.name_first || null,
        last_name: c.name_last || null,
        primary_email: c.email || null,
        primary_phone: normalizePhone(c.phone) || null,
        relationship: c.relationship || null,
      }));

    const { error: contactError } = await supabase
      .from("partner_contacts")
      .insert(rows);

    setSaving(false);

    if (contactError) {
      setError(contactError.message);
      return;
    }

    onSuccess(newPartner);
    onClose();
  }

  function updateContact(
    id: string,
    field: keyof ContactCard,
    value: string | boolean,
  ) {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  return (
    <SereniusModal
      title={step === 1 ? "Add New Partner" : "Add Contacts"}
      description={
        step === 1
          ? "Create a partner record and optional primary contact."
          : "Step 2 of 2 — review and confirm contacts."
      }
      onClose={onClose}
      footerLeft={
        step === 2 ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (newPartner) {
                onSuccess(newPartner);
                onClose();
              }
            }}
          >
            Skip — I'll add contacts later
          </button>
        ) : null
      }
      footer={
        step === 1 ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>

            <button
              type="submit"
              form="add-partner-modal-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save & Continue →"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleStep2Submit}
            disabled={saving || includedCount === 0}
          >
            {saving
              ? "Saving..."
              : `Create ${includedCount} Contact${
                  includedCount !== 1 ? "s" : ""
                } & Finish`}
          </button>
        )
      }
    >
      {step === 1 && (
        <form id="add-partner-modal-form" onSubmit={handleStep1Submit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Partner Type *</label>
                  <select
                    name="partner_type"
                    required
                    className="form-input"
                    value={partnerType}
                    onChange={(e) => setPartnerType(e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option>Family</option>
                    <option>Church</option>
                    <option>Business</option>
                    <option>Organization</option>
                    <option>School</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Partner Status *</label>
                  <select name="partner_status" required className="form-input">
                    <option value="">Select...</option>
                    <option>Active</option>
                    <option>Past</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Relationship Type *</label>
                  <select
                    name="relationship_type"
                    required
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    <option>Donor</option>
                    <option>Prospect</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned To</label>
                  <select
                    name="assigned_to"
                    className="form-input"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {staff.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name?.trim() || user.email?.trim() || "Unnamed User"}
                      </option>
                    ))}
                  </select>
                </div>

                {isEntityType && (
                  <div className="form-group">
                    <label className="form-label">Entity Name *</label>
                    <input
                      name="entity_name"
                      type="text"
                      placeholder="Organization name"
                      className="form-input"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="form-section-title">
                {isEntityType ? "Primary Contact Person" : "Primary Contact"}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input
                    name="name_first"
                    type="text"
                    placeholder="First"
                    className="form-input"
                  />
                  {!isEntityType && (
                    <span className="form-hint">
                      Tip: "Matt and Amber" creates 2 contacts
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input
                    name="name_last"
                    type="text"
                    placeholder="Last"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Correspondence Greeting</label>
                  <input
                    name="correspondence_greeting"
                    type="text"
                    placeholder="e.g. Matt and Amber"
                    className="form-input"
                  />
                  <span className="form-hint">
                    Used in letters and email salutations
                  </span>
                </div>
              </div>

              <div className="form-section-title">Contact Info</div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Primary Email</label>
                  <input
                    name="primary_email"
                    type="email"
                    placeholder="email@example.com"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Primary Phone</label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "3fr 2fr",
                      gap: 8,
                    }}
                  >
                    <input
                      name="primary_phone"
                      type="tel"
                      placeholder="(___) ___-____"
                      className="form-input"
                      value={primaryPhone}
                      onChange={(e) => handlePhoneInput(e, setPrimaryPhone)}
                    />

                    <select name="primary_phone_type" className="form-input">
                      <option value="">Select type...</option>
                      <option>Mobile</option>
                      <option>Home</option>
                      <option>Work</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Secondary Phone</label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "3fr 2fr",
                      gap: 8,
                    }}
                  >
                    <input
                      name="secondary_phone"
                      type="tel"
                      placeholder="(___) ___-____"
                      className="form-input"
                      value={secondaryPhone}
                      onChange={(e) => handlePhoneInput(e, setSecondaryPhone)}
                    />

                    <select name="secondary_phone_type" className="form-input">
                      <option value="">Select type...</option>
                      <option>Mobile</option>
                      <option>Home</option>
                      <option>Work</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section-title">Address</div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Street Address</label>
                  <input
                    name="street1"
                    type="text"
                    placeholder="123 Main St"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Street Address 2</label>
                  <input
                    name="street2"
                    type="text"
                    placeholder="Apt, Suite, etc."
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input name="city" type="text" className="form-input" />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <input name="state" type="text" className="form-input" />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Zip Code</label>
                  <input name="zip" type="text" className="form-input" />
                </div>
              </div>

              {error && <ErrorBanner message={error} />}
            </form>
        )}

        {step === 2 && (
          <>
              <p
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  marginBottom: 20,
                }}
              >
                {contacts.length === 1
                  ? "We generated 1 contact from the partner record. Review and edit before saving."
                  : `We generated ${contacts.length} contacts from the partner record. Review and edit before saving.`}
              </p>

              {contacts.map((contact, idx) => (
                <ContactCardItem
                  key={contact.id}
                  contact={contact}
                  index={idx}
                  onUpdate={(field, value) =>
                    updateContact(contact.id, field, value)
                  }
                />
              ))}

              {error && <ErrorBanner message={error} />}
          </>
        )}
    </SereniusModal>
  );
}

function ContactCardItem({
  contact,
  index,
  onUpdate,
}: {
  contact: ContactCard;
  index: number;
  onUpdate: (field: keyof ContactCard, value: string | boolean) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #e0e0db",
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
        opacity: contact.included ? 1 : 0.55,
        transition: "opacity 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "9px 14px",
          background: "#fafaf8",
          borderBottom: contact.included ? "1px solid #f0f0eb" : "none",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#6b7280",
          }}
        >
          Contact {index + 1}
        </span>

        <button
          type="button"
          onClick={() => onUpdate("included", !contact.included)}
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 500,
            padding: "2px 10px",
            borderRadius: 10,
            border: "1px solid",
            cursor: "pointer",
            background: contact.included ? "#ebfbee" : "#f8f9fa",
            color: contact.included ? "#2f9e44" : "#868e96",
            borderColor: contact.included ? "#b2f2bb" : "#dee2e6",
          }}
        >
          {contact.included ? "Included" : "Excluded"}
        </button>
      </div>

      {contact.included && (
        <div style={{ padding: 14 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                className="form-input"
                value={contact.name_first}
                onChange={(e) => onUpdate("name_first", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-input"
                value={contact.name_last}
                onChange={(e) => onUpdate("name_last", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <select
                className="form-input"
                value={contact.relationship}
                onChange={(e) => onUpdate("relationship", e.target.value)}
              >
                <option value="">Select...</option>
                <option>Self</option>
                <option>Husband</option>
                <option>Wife</option>
                <option>Partner</option>
                <option>Son</option>
                <option>Daughter</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={contact.email}
                onChange={(e) => onUpdate("email", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                value={contact.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);

                  let fmt = digits;

                  if (digits.length >= 7) {
                    fmt = `(${digits.slice(0, 3)}) ${digits.slice(
                      3,
                      6,
                    )}-${digits.slice(6)}`;
                  } else if (digits.length >= 4) {
                    fmt = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                  } else if (digits.length >= 1) {
                    fmt = `(${digits}`;
                  }

                  onUpdate("phone", fmt);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: "#fff5f5",
        border: "1px solid #ffa8a8",
        borderRadius: 6,
        fontSize: 13,
        color: "#c92a2a",
      }}
    >
      {message}
    </div>
  );
}
