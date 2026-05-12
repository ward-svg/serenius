export type SortDirection = "asc" | "desc";

export interface SortState<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export type SortValue = string | number | Date | boolean | null | undefined;

export function nextSortState<K extends string>(
  current: SortState<K> | null,
  key: K,
): SortState<K> {
  return {
    key,
    direction: current?.key === key && current.direction === "asc" ? "desc" : "asc",
  };
}

export function normalizePhoneSortValue(value: string | null | undefined): string | null {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");

  return digits || value;
}

export function parseDateSortValue(value: string | null | undefined): number | null {
  if (!value) return null;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

function isEmptySortValue(value: SortValue): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function toComparableNumber(value: SortValue): number | null {
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

export function compareSortValues(
  a: SortValue,
  b: SortValue,
  direction: SortDirection,
): number {
  const aEmpty = isEmptySortValue(a);
  const bEmpty = isEmptySortValue(b);

  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aNumber = toComparableNumber(a);
  const bNumber = toComparableNumber(b);
  const result =
    aNumber != null && bNumber != null
      ? aNumber - bNumber
      : String(a).localeCompare(String(b), "en", {
          numeric: true,
          sensitivity: "base",
        });

  return direction === "asc" ? result : -result;
}

export function sortByValue<T, K extends string>(
  items: T[],
  sort: SortState<K> | null,
  getValue: (item: T, key: K) => SortValue,
): T[] {
  if (!sort) return items;

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const result = compareSortValues(
        getValue(a.item, sort.key),
        getValue(b.item, sort.key),
        sort.direction,
      );

      return result || a.index - b.index;
    })
    .map(({ item }) => item);
}
