"use client";

import type { SortDirection, SortState } from "@/lib/ui/sort";

function getAriaSort(
  direction: SortDirection | null,
): "none" | "ascending" | "descending" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

interface SortableHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}

export default function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: SortableHeaderProps<K>) {
  const direction = sort?.key === sortKey ? sort.direction : null;
  const nextDirection = direction === "asc" ? "descending" : "ascending";
  const classes = [
    "sortable-heading",
    align === "right" ? "sortable-heading-right" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <th className={classes} aria-sort={getAriaSort(direction)}>
      <button
        type="button"
        className={`sortable-header ${
          direction ? `is-${direction}` : "is-unsorted"
        }`}
        onClick={() => onSort(sortKey)}
        title={`Sort ${label} ${nextDirection}`}
        aria-label={`Sort ${label} ${nextDirection}`}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true" />
      </button>
    </th>
  );
}
