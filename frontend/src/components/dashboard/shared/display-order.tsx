"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DataTableColumn } from "@/components/ui/data-table";
import { translateNow, useT } from "@/lib/i18n";

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
  example,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** What "1" would be, e.g. "head office" — already translated. */
  example?: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("common.order.label")}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={99999}
        step={1}
        placeholder={t("common.order.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{t("common.order.hint", { example: example ?? t("common.order.example") })}</p>
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
    // Built on every render, so the language chosen right now is the one shown.
    header: translateNow("common.order.column"),
    cell: (row) => <span className="tabular-nums text-muted-foreground">{getOrder(row) ?? "—"}</span>,
    sortValue: getOrder,
    sortLabels: [translateNow("common.order.lowestFirst"), translateNow("common.order.highestFirst")],
    hideOnMobile: true,
    className: "hidden xl:table-cell w-20",
  };
}
