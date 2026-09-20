"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  SearchX,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

/**
 * A reusable list view: search, filters, sortable columns and pagination on
 * a real table for desktop, and the same rows as stacked cards on mobile.
 * Everything runs client-side over the `data` you pass in.
 */

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Makes the column sortable by this value. */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Text this column contributes to the search box. */
  searchValue?: (row: T) => string | null | undefined;
  /** Used as the card heading on mobile. Defaults to the first column. */
  primary?: boolean;
  /** Left out of the mobile card. */
  hideOnMobile?: boolean;
  /** Extra classes for this column's header and cells on desktop. */
  className?: string;
};

type Option = { value: string; label: string };

export type DataTableFilter<T> =
  | {
      type: "select";
      id: string;
      label: string;
      options: Option[];
      getValue: (row: T) => string | null | undefined;
    }
  | {
      type: "date-range";
      id: string;
      label: string;
      /** Must return an ISO date (YYYY-MM-DD). */
      getValue: (row: T) => string | null | undefined;
    };

export type DataTableProps<T> = {
  /** `null` means "still loading". */
  data: T[] | null;
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string | number;
  searchPlaceholder?: string;
  filters?: DataTableFilter<T>[];
  /** Buttons for the last column on desktop / the bottom of each card on mobile. */
  rowActions?: (row: T) => React.ReactNode;
  actionsHeader?: string;
  onRowClick?: (row: T) => void;
  /** Shown when `data` is empty. */
  emptyState: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode };
  /** Extra controls placed next to the search box. */
  toolbar?: React.ReactNode;
  initialSort?: { columnId: string; direction: "asc" | "desc" };
  pageSizeOptions?: number[];
  defaultPageSize?: number;
};

type Sort = { columnId: string; direction: "asc" | "desc" } | null;

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search…",
  filters = [],
  rowActions,
  actionsHeader = "Actions",
  onRowClick,
  emptyState,
  toolbar,
  initialSort,
  pageSizeOptions = [10, 25, 50],
  defaultPageSize,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize ?? pageSizeOptions[0]);

  const hasActiveFilters = search.trim() !== "" || Object.values(filterValues).some((v) => v !== "");

  const rows = useMemo(() => {
    let result = data ?? [];

    const query = search.trim().toLowerCase();
    if (query) {
      result = result.filter((row) =>
        columns.some((column) => column.searchValue?.(row)?.toLowerCase().includes(query)),
      );
    }

    for (const filter of filters) {
      if (filter.type === "select") {
        const selected = filterValues[filter.id];
        if (selected) result = result.filter((row) => filter.getValue(row) === selected);
      } else {
        const from = filterValues[`${filter.id}.from`];
        const to = filterValues[`${filter.id}.to`];
        if (from) result = result.filter((row) => (filter.getValue(row) ?? "") >= from);
        if (to) result = result.filter((row) => (filter.getValue(row) ?? "9999-12-31") <= to);
      }
    }

    const sortColumn = sort ? columns.find((column) => column.id === sort.columnId) : undefined;
    if (sort && sortColumn?.sortValue) {
      const getSortValue = sortColumn.sortValue;
      result = [...result].sort((x, y) => {
        const a = getSortValue(x);
        const b = getSortValue(y);
        // Empty values always sort last, whichever direction is chosen.
        if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
        const order = compareValues(a, b);
        return sort.direction === "asc" ? order : -order;
      });
    }

    return result;
  }, [data, columns, filters, search, filterValues, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateFilter(key: string, value: string) {
    setFilterValues((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function clearAll() {
    setSearch("");
    setFilterValues({});
    setPage(1);
  }

  function toggleSort(columnId: string) {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: "asc" };
      if (current.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
    setPage(1);
  }

  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];
  const cardColumns = columns.filter((column) => column !== primaryColumn && !column.hideOnMobile);
  const showToolbar = Boolean(data && data.length > 0);

  if (data !== null && data.length === 0) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search"
              className="pl-8"
            />
          </div>

          {filters.map((filter) =>
            filter.type === "select" ? (
              <select
                key={filter.id}
                aria-label={filter.label}
                value={filterValues[filter.id] ?? ""}
                onChange={(e) => updateFilter(filter.id, e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{filter.label}: all</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div key={filter.id} className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{filter.label}</span>
                <Input
                  type="date"
                  aria-label={`${filter.label} from`}
                  value={filterValues[`${filter.id}.from`] ?? ""}
                  onChange={(e) => updateFilter(`${filter.id}.from`, e.target.value)}
                  className="w-auto"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  aria-label={`${filter.label} to`}
                  value={filterValues[`${filter.id}.to`] ?? ""}
                  onChange={(e) => updateFilter(`${filter.id}.to`, e.target.value)}
                  className="w-auto"
                />
              </div>
            ),
          )}

          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-3.5" />
              Clear
            </Button>
          )}

          {toolbar && <div className="ml-auto flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {data === null && (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {data !== null && rows.length === 0 && (
        <EmptyState
          icon={SearchX}
          title="No results"
          description="Nothing matches your search or filters."
          action={
            <Button type="button" variant="outline" size="sm" onClick={clearAll}>
              Clear search and filters
            </Button>
          }
        />
      )}

      {data !== null && rows.length > 0 && (
        <>
          {/* Desktop: a real table. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => {
                    const sorted = sort?.columnId === column.id ? sort.direction : null;

                    return (
                      <TableHead
                        key={column.id}
                        className={column.className}
                        aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
                      >
                        {column.sortValue ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column.id)}
                            className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                          >
                            {column.header}
                            {sorted === "asc" ? (
                              <ArrowUp className="size-3.5" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3.5" />
                            ) : (
                              <ChevronsUpDown className="size-3.5 opacity-40" />
                            )}
                          </button>
                        ) : (
                          column.header
                        )}
                      </TableHead>
                    );
                  })}
                  {rowActions && <TableHead className="text-right">{actionsHeader}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow
                    key={getRowId(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">{rowActions(row)}</div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: the same rows as cards. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {pageRows.map((row) => (
              <li
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "rounded-xl border border-border bg-card p-4 shadow-sm",
                  onRowClick && "cursor-pointer active:bg-muted/50",
                )}
              >
                <div className="min-w-0 text-sm font-semibold">{primaryColumn.cell(row)}</div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {cardColumns.map((column) => (
                    <div key={column.id} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{column.header}</dt>
                      <dd className="mt-0.5 break-words text-sm">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
                {rowActions && (
                  <div
                    className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {rowActions(row)}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length}
              {hasActiveFilters && data.length !== rows.length ? ` (filtered from ${data.length})` : ""}
            </p>
            <div className="flex items-center gap-2">
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={SELECT_CLASS}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-16 text-center tabular-nums">
                {currentPage} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next page"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
