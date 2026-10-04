"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DataTableColumn } from "@/components/ui/data-table";

/**
 * The company's own order for a list — like product positions in a shop:
 * the lowest number is listed first everywhere, anything left empty comes
 * after everything numbered, and ties go by name. The server does the
 * ordering; these are the shared form field and table column for it.
 */

/** The form value ("" or digits) as the API wants it. */
export function toSortOrder(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

/** The API value as a form value. */
export function fromSortOrder(value: number | null | undefined): string {
  return value != null ? String(value) : "";
}

export function DisplayOrderField({
  id,
  value,
  onChange,
  example = "the most important one",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** What "1" would be, e.g. "head office". */
  example?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Display order (optional)</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={99999}
        step={1}
        placeholder="e.g. 1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">Lowest shows first in every list (e.g. 1 = {example}). Empty = after numbered ones.</p>
    </div>
  );
}

/**
 * An "Order" column for a table: shows the number, sorts lowest / highest first. Wide screens only.
 * By default it reads the row's own sort_order; pass `getOrder` for rows that belong to an employee
 * (attendance days, requests…), e.g. `(day) => day.employee?.sort_order`.
 */
export function displayOrderColumn<T>(getOrder: (row: T) => number | null | undefined = (row) => (row as { sort_order?: number | null }).sort_order): DataTableColumn<T> {
  return {
    id: "order",
    header: "Order",
    cell: (row) => <span className="tabular-nums text-muted-foreground">{getOrder(row) ?? "—"}</span>,
    sortValue: getOrder,
    sortLabels: ["Lowest first", "Highest first"],
    hideOnMobile: true,
    className: "hidden xl:table-cell w-20",
  };
}
