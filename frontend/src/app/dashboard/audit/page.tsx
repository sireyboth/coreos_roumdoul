"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Globe, Monitor, RotateCw, ScrollText, Search, Smartphone, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useApi } from "@/hooks/use-api";
import { api, type AuditEntry, type AuditFilters, type AuditModule, type AuditOptions } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { dateLocale, useLang, useT, type Lang, type TKey } from "@/lib/i18n";
import { access as accessEn } from "@/lib/i18n/en/access";

type T = (key: TKey, vars?: Record<string, string | number>) => string;

const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const moduleLabel = (t: T, module: AuditModule) => t(`access.auditPage.module.${module}`);

const PAGE_SIZE = 50;

// ───────────────────────── Reading an entry ─────────────────────────

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").replace(/\bid\b/gi, "ID").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Entity = keyof typeof accessEn.auditPage.entity;
type EventAction = keyof typeof accessEn.auditPage.eventAction;
const isEntity = (value: string): value is Entity => Object.hasOwn(accessEn.auditPage.entity, value);
const isEventAction = (value: string): value is EventAction => Object.hasOwn(accessEn.auditPage.eventAction, value);

/** "employee.updated" → "Employee updated", "attendance.day_deleted" → "Attendance day deleted". Unknown codes are made readable as is. */
function eventTitle(t: T, event: string): string {
  const [entity, action = ""] = event.split(".");
  if (isEntity(entity) && isEventAction(action)) {
    return t(`access.auditPage.eventAction.${action}`, { entity: t(`access.auditPage.entity.${entity}`) });
  }
  return `${humanize(entity)} ${humanize(action).toLowerCase()}`.trim();
}

type Tone = "success" | "info" | "destructive" | "warning" | "secondary";

function eventTone(event: string): Tone {
  const action = event.split(".")[1] ?? "";
  if (/deleted|removed|rejected|deactivated|cancel/.test(action)) return "destructive";
  if (/created|approved|reactivated|invited|started/.test(action)) return "success";
  if (/reopened|unlock|ended/.test(action)) return "warning";
  if (/updated|changed/.test(action)) return "info";
  return "secondary";
}

function formatWhen(iso: string, lang: Lang) {
  const date = new Date(iso);
  const locale = dateLocale(lang) ?? "en-GB";
  return {
    date: date.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

/** A short device name from the browser's user agent, e.g. "Chrome on Windows". */
function deviceOf(t: T, userAgent: string | null): { label: string; mobile: boolean } | null {
  if (!userAgent) return null;
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null;
  const label = browser && os ? t("access.auditPage.deviceOn", { browser, os }) : browser || os || t("access.auditPage.otherDevice");
  return { label, mobile: /Mobile|iPhone|Android/.test(userAgent) };
}

function formatValue(t: T, lang: Lang, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t("access.auditPage.yes") : t("access.auditPage.no");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const { date, time } = formatWhen(value, lang);
    return `${date} ${time}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Field-by-field: what it was and what it became. A create has no "before", a delete no "after". */
function changesOf(entry: AuditEntry): { field: string; before: unknown; after: unknown }[] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const fields = [...new Set([...Object.keys(after), ...Object.keys(before)])].filter((f) => !["created_at", "updated_at", "company_id"].includes(f));
  return fields.map((field) => ({ field, before: before[field], after: after[field] }));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// ───────────────────────── Pieces ─────────────────────────

function Actor({ entry }: { entry: AuditEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          entry.actor.type === "user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {entry.actor.type === "user" ? initials(entry.actor.name) : entry.actor.type === "support" ? "PS" : "SY"}
      </div>
      <span className="truncate font-medium">{entry.actor.name}</span>
    </div>
  );
}

function Where({ entry }: { entry: AuditEntry }) {
  const t = useT();
  const device = deviceOf(t, entry.user_agent);
  const DeviceIcon = device?.mobile ? Smartphone : Monitor;
  return (
    <div className="flex flex-col text-xs text-muted-foreground">
      {device && (
        <span className="inline-flex items-center gap-1.5">
          <DeviceIcon className="size-3.5" />
          {device.label}
        </span>
      )}
      {entry.ip_address && <span className="tabular-nums">{entry.ip_address}</span>}
      {!device && !entry.ip_address && "—"}
    </div>
  );
}

function DetailDialog({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const when = formatWhen(entry.created_at, lang);
  const device = deviceOf(t, entry.user_agent);
  const changes = changesOf(entry);
  const isCreate = !entry.before && !!entry.after;
  const isDelete = !!entry.before && !entry.after;

  const facts: [string, React.ReactNode][] = [
    [t("access.auditPage.when"), `${when.date}, ${when.time}`],
    [t("access.auditPage.who"), entry.actor.name],
    [t("access.auditPage.record"), entry.subject ? `${entry.subject.label ?? `#${entry.subject.id}`} (${entry.subject.type})` : "—"],
    [t("common.field.branch"), entry.branch?.name ?? t("access.auditPage.companyWide")],
    [t("access.auditPage.area"), entry.module ? moduleLabel(t, entry.module) : "—"],
    [t("access.auditPage.device"), device?.label ?? "—"],
    [t("access.auditPage.ipAddress"), entry.ip_address ?? "—"],
    [t("common.field.from"), entry.method && entry.path ? <code key="from" className="font-mono text-xs">{`${entry.method} ${entry.path}`}</code> : t("access.auditPage.automatic")],
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{eventTitle(t, entry.event)}</DialogTitle>
            <Badge variant={eventTone(entry.event)}>{entry.event}</Badge>
          </div>
          <DialogDescription>
            {entry.actor.name} · {t("access.auditPage.whenAt", { date: when.date, time: when.time })}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="wrap-break-word">{value}</dd>
            </div>
          ))}
        </dl>

        {entry.reason && (
          <div className="rounded-lg border border-border p-3 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("common.field.reason")}</span>
            <p className="mt-1">{entry.reason}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{isCreate ? t("access.auditPage.savedValues") : isDelete ? t("access.auditPage.valuesBeforeDelete") : t("access.auditPage.changes")}</h3>
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("access.auditPage.noDetails")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">{t("access.auditPage.field")}</TableHead>
                    {!isCreate && <TableHead>{t("access.auditPage.before")}</TableHead>}
                    {!isCreate && !isDelete && <TableHead className="w-6" />}
                    {!isDelete && <TableHead>{t("access.auditPage.after")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changes.map((c) => (
                    <TableRow key={c.field}>
                      <TableCell className="align-top font-medium">{humanize(c.field)}</TableCell>
                      {!isCreate && <TableCell className={cn("align-top break-all whitespace-normal", !isDelete && "text-muted-foreground line-through decoration-destructive/40")}>{formatValue(t, lang, c.before)}</TableCell>}
                      {!isCreate && !isDelete && (
                        <TableCell className="align-top text-muted-foreground">
                          <ArrowRight className="size-3.5" />
                        </TableCell>
                      )}
                      {!isDelete && <TableCell className="align-top break-all whitespace-normal">{formatValue(t, lang, c.after)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Page ─────────────────────────

type Filters = Required<Pick<AuditFilters, "from" | "to" | "user_id" | "branch_id" | "module" | "action">>;

const NO_FILTERS: Filters = { from: "", to: "", user_id: "", branch_id: "", module: "", action: "" };

export default function AuditLogPage() {
  const t = useT();
  const lang = useLang();
  const [options, setOptions] = useState<AuditOptions | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => {
    api.audit.options().then(setOptions).catch(notifyError);
  }, [reloads]);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error } = useApi(
    () =>
      api.audit
        .list({ ...filters, search, page, per_page: PAGE_SIZE })
        .then((res) => ({ rows: res.data, total: res.total, lastPage: res.last_page ?? 1 })),
    [filters, search, page, reloads],
    { notify: true },
  );
  const result = data ?? (error ? { rows: [] as AuditEntry[], total: 0, lastPage: 1 } : null);

  function setFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  const filtered = Object.values(filters).some(Boolean) || search !== "";
  const first = result && result.total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = result ? Math.min(page * PAGE_SIZE, result.total) : 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("access.auditPage.title")}
        description={t("access.auditPage.description")}
        action={
          <Button variant="outline" onClick={() => setReloads((n) => n + 1)}>
            <RotateCw className="size-4" />
            {t("access.auditPage.refresh")}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("access.auditPage.search")}
            className="h-9 pl-9"
            aria-label={t("access.auditPage.searchLabel")}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-from">{t("common.field.from")}</Label>
            <Input id="audit-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter("from", e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-to">{t("common.field.to")}</Label>
            <Input id="audit-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter("to", e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-user">{t("access.auditPage.who")}</Label>
            <SearchableSelect
              id="audit-user"
              options={(options?.users ?? []).map((u) => ({ value: String(u.id), label: u.name }))}
              value={filters.user_id}
              onChange={(v) => setFilter("user_id", v)}
              placeholder={t("access.auditPage.anyone")}
              className="h-9 w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-branch">{t("common.field.branch")}</Label>
            <select id="audit-branch" className={SELECT_CLASS} value={filters.branch_id} onChange={(e) => setFilter("branch_id", e.target.value)}>
              <option value="">{t("access.auditPage.allBranches")}</option>
              {options?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-module">{t("access.auditPage.area")}</Label>
            <select id="audit-module" className={SELECT_CLASS} value={filters.module} onChange={(e) => setFilter("module", e.target.value)}>
              <option value="">{t("access.auditPage.allAreas")}</option>
              {options?.modules.map((m) => (
                <option key={m} value={m}>
                  {moduleLabel(t, m)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-action">{t("access.auditPage.action")}</Label>
            <select id="audit-action" className={SELECT_CLASS} value={filters.action} onChange={(e) => setFilter("action", e.target.value)}>
              <option value="">{t("access.auditPage.anyAction")}</option>
              <option value="created">{t("access.auditPage.created")}</option>
              <option value="updated">{t("access.auditPage.updated")}</option>
              <option value="deleted">{t("access.auditPage.deleted")}</option>
            </select>
          </div>
        </div>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => {
              setFilters(NO_FILTERS);
              setSearchInput("");
              setPage(1);
            }}
          >
            <X className="size-3.5" />
            {t("access.auditPage.clearFilters")}
          </Button>
        )}
      </div>

      {result === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : result.rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? t("access.auditPage.noMatches") : t("access.auditPage.empty")}
          description={filtered ? t("access.auditPage.noMatchesHint") : t("access.auditPage.emptyHint")}
        />
      ) : (
        <>
          {/* Desktop: a table. */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="w-36">{t("access.auditPage.when")}</TableHead>
                  <TableHead>{t("access.auditPage.who")}</TableHead>
                  <TableHead>{t("access.auditPage.what")}</TableHead>
                  <TableHead>{t("access.auditPage.record")}</TableHead>
                  <TableHead>{t("common.field.branch")}</TableHead>
                  <TableHead>{t("access.auditPage.where")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((entry) => {
                  const when = formatWhen(entry.created_at, lang);
                  return (
                    <TableRow key={entry.id} className="cursor-pointer" onClick={() => setSelected(entry)}>
                      <TableCell className="align-top">
                        <div className="flex flex-col tabular-nums">
                          <span className="font-medium">{when.date}</span>
                          <span className="text-xs text-muted-foreground">{when.time}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-48 align-top">
                        <Actor entry={entry} />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={eventTone(entry.event)}>{eventTitle(t, entry.event)}</Badge>
                          {entry.reason && <span className="max-w-64 truncate text-xs text-muted-foreground">{entry.reason}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-56 align-top">
                        {entry.subject ? (
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate">{entry.subject.label ?? `#${entry.subject.id}`}</span>
                            <span className="text-xs text-muted-foreground">{entry.subject.type}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {entry.branch ? entry.branch.name : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Globe className="size-3.5" />{t("access.auditPage.companyWide")}</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        <Where entry={entry} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: one card per change. */}
          <div className="flex flex-col gap-2 md:hidden">
            {result.rows.map((entry) => {
              const when = formatWhen(entry.created_at, lang);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelected(entry)}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-accent/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant={eventTone(entry.event)}>{eventTitle(t, entry.event)}</Badge>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {when.date} {when.time.slice(0, 5)}
                    </span>
                  </div>
                  {entry.subject && <span className="font-medium">{entry.subject.label ?? `${entry.subject.type} #${entry.subject.id}`}</span>}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t("access.auditPage.by", { name: entry.actor.name })}</span>
                    <span>{entry.branch?.name ?? t("access.auditPage.companyWide")}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {t("common.table.showing", { from: first.toLocaleString(), to: last.toLocaleString(), total: result.total.toLocaleString() })}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
                {t("access.auditPage.newer")}
              </Button>
              <span className="text-muted-foreground tabular-nums">
                {t("access.auditPage.pageOf", { page, pages: result.lastPage })}
              </span>
              <Button variant="outline" size="sm" disabled={page >= result.lastPage} onClick={() => setPage((p) => p + 1)}>
                {t("access.auditPage.older")}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {selected && <DetailDialog entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
