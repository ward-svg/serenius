"use client";

import { useMemo, useState } from "react";
import SortableHeader from "@/components/ui/SortableHeader";
import {
  nextSortState,
  parseDateSortValue,
  sortByValue,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import type { EmailTemplate } from "../types";
import { TEMPLATE_STATUS_LABELS, TEMPLATE_TYPE_LABELS } from "../constants";
import TemplateModal from "./TemplateModal";

interface Props {
  tenantId: string;
  templates: EmailTemplate[];
  canManage: boolean;
  onTemplatesChange: (templates: EmailTemplate[]) => void;
}

type TemplateSortKey = "name" | "templateType" | "status" | "isDefault" | "updatedAt";

function getSortValue(template: EmailTemplate, key: TemplateSortKey): SortValue {
  switch (key) {
    case "name":
      return template.name;
    case "templateType":
      return TEMPLATE_TYPE_LABELS[template.template_type] ?? template.template_type;
    case "status":
      return TEMPLATE_STATUS_LABELS[template.status] ?? template.status;
    case "isDefault":
      return template.is_default ? 0 : 1;
    case "updatedAt":
      return parseDateSortValue(template.updated_at);
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export default function TemplatesTab({ tenantId, templates, canManage, onTemplatesChange }: Props) {
  const [sort, setSort] = useState<SortState<TemplateSortKey> | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("create");
  const [showModal, setShowModal] = useState(false);

  const sorted = useMemo(() => sortByValue(templates, sort, getSortValue), [templates, sort]);

  function openNew() {
    setSelectedTemplate(null);
    setModalMode("create");
    setShowModal(true);
  }

  function openTemplate(template: EmailTemplate) {
    setSelectedTemplate(template);
    setModalMode("view");
    setShowModal(true);
  }

  function handleSaved(saved: EmailTemplate) {
    onTemplatesChange(
      templates.some((t) => t.id === saved.id)
        ? templates.map((t) => (t.id === saved.id ? saved : t))
        : [saved, ...templates],
    );
    setSelectedTemplate(saved);
    setModalMode("view");
  }

  function handleDefaultCleared(savedId: string) {
    onTemplatesChange(templates.map((t) => (t.id === savedId ? t : { ...t, is_default: false })));
  }

  function handleClose() {
    setSelectedTemplate(null);
    setShowModal(false);
  }

  return (
    <>
      <div className="section-card">
        <div className="section-header">
          <span className="section-title">Templates</span>
          <span className="section-count">{templates.length}</span>
          {canManage ? (
            <div className="section-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={openNew}>
                New Template
              </button>
            </div>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <div className="empty-state">No templates created yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortableHeader
                    label="Name"
                    sortKey="name"
                    sort={sort}
                    onSort={(key) => setSort((s) => nextSortState(s, key))}
                  />
                  <SortableHeader
                    label="Type"
                    sortKey="templateType"
                    sort={sort}
                    onSort={(key) => setSort((s) => nextSortState(s, key))}
                  />
                  <th>Mode</th>
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    sort={sort}
                    onSort={(key) => setSort((s) => nextSortState(s, key))}
                  />
                  <SortableHeader
                    label="Default"
                    sortKey="isDefault"
                    sort={sort}
                    onSort={(key) => setSort((s) => nextSortState(s, key))}
                  />
                  <SortableHeader
                    label="Updated"
                    sortKey="updatedAt"
                    sort={sort}
                    onSort={(key) => setSort((s) => nextSortState(s, key))}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((template) => (
                  <tr key={template.id}>
                    <td className="actions-column">
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => openTemplate(template)}
                      >
                        View/Edit
                      </button>
                    </td>
                    <td>{template.name}</td>
                    <td>{TEMPLATE_TYPE_LABELS[template.template_type] ?? template.template_type}</td>
                    <td>{template.email_style === "Rich Text" ? "Serenius Builder" : "Raw HTML"}</td>
                    <td>{TEMPLATE_STATUS_LABELS[template.status] ?? template.status}</td>
                    <td>{template.is_default ? "Yes" : "—"}</td>
                    <td>{formatDate(template.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        <TemplateModal
          tenantId={tenantId}
          template={selectedTemplate}
          mode={modalMode}
          canManage={canManage}
          onClose={handleClose}
          onSaved={handleSaved}
          onModeChange={setModalMode}
          onDefaultCleared={handleDefaultCleared}
        />
      ) : null}
    </>
  );
}
