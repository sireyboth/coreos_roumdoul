"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlarmClock, CalendarHeart, ChevronDown, Inbox, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/dashboard/page-header";
import { LateEarlyRequestDialog } from "@/components/dashboard/requests/late-early-request-dialog";
import { LeaveRequestDialog } from "@/components/dashboard/requests/leave-request-dialog";
import { DELETE_REQUESTS_WARNING, RequestDetailDialog } from "@/components/dashboard/requests/request-detail-dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useMe } from "@/contexts/me-context";
import { api, type EmployeeRequest, type LeaveBalance } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { REQUEST_STATUS, requestAmount, requestDates } from "@/lib/requests";
import { cn } from "@/lib/utils";

type Scope = "mine" | "approvals" | "all";

const MANAGE = "requests.manage";

/** What's left of each leave that keeps a balance, for this year. */
function Balances({ balances }: { balances: LeaveBalance[] | null }) {
  if (!balances || balances.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {balances.map((b) => (
        <Card key={b.leave_type.id} className="py-4">
          <CardContent className="flex flex-col gap-1 px-4">
            <p className="truncate text-xs font-medium text-muted-foreground">{b.leave_type.name}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {b.available}
              <span className="ml-1 text-sm font-normal text-muted-foreground">left</span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {b.used} used{b.pending > 0 ? ` · ${b.pending} waiting` : ""} · {b.earned < b.full_year ? `${b.earned} of ${b.full_year} earned` : `${b.full_year} a year`}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RequestsPage() {
  const { me } = useMe();
  const params = useSearchParams();
  const canManage = me?.permissions.includes(MANAGE) ?? false;
  const selfEmployeeId = me?.employee?.id ?? null;

  const [scope, setScope] = useState<Scope>(() => (params.get("scope") as Scope) || (selfEmployeeId ? "mine" : "approvals"));
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState<{ key: string; data: EmployeeRequest[] } | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [people, setPeople] = useState<{ id: number; name: string }[] | undefined>(undefined);
  // Which form is open: leave, or late arrival / early leave.
  const [asking, setAsking] = useState<"leave" | "late_early" | null>(null);
  const [open, setOpen] = useState<EmployeeRequest | null>(null);

  const key = `${scope}|${reloads}`;
  const rows = result?.key === key ? result.data : null;

  useEffect(() => {
    let cancelled = false;
    api.requests
      .list({ scope })
      .then((data) => !cancelled && setResult({ key, data }))
      .catch((err) => {
        if (cancelled) return;
        notifyError(err);
        setResult({ key, data: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [scope, key]);

  useEffect(() => {
    api.requests.waitingCount().then((r) => setWaiting(r.count)).catch(() => setWaiting(0));
    if (selfEmployeeId) api.leave.balances().then((r) => setBalances(r.balances)).catch(() => setBalances([]));
  }, [reloads, selfEmployeeId]);

  // Approvers can ask for leave on someone's behalf.
  useEffect(() => {
    if (canManage) api.employees.all().then((list) => setPeople(list.map((e) => ({ id: e.id, name: e.name })))).catch(() => setPeople(undefined));
  }, [canManage]);

  // A notification links here with ?id=… — open that request.
  useEffect(() => {
    const id = Number(params.get("id"));
    if (id) api.requests.get(id).then(setOpen).catch(notifyError);
  }, [params]);

  const changed = useCallback((updated: EmployeeRequest) => {
    setResult((r) => (r ? { ...r, data: r.data.map((x) => (x.id === updated.id ? updated : x)) } : r));
    setReloads((n) => n + 1);
  }, []);

  const confirm = useConfirm();

  async function deleteRequests(selected: EmployeeRequest[], clearSelection: () => void) {
    const ok = await confirm({
      title: selected.length === 1 ? `Delete this ${selected[0].label.toLowerCase()}?` : `Delete ${selected.length} requests?`,
      description: DELETE_REQUESTS_WARNING,
      destructive: true,
    });
    if (!ok) return;

    try {
      const { deleted } = await api.requests.deleteMany(selected.map((r) => r.id));
      notifySuccess(`${deleted} ${deleted === 1 ? "request" : "requests"} deleted`);
      clearSelection();
    } catch (err) {
      notifyError(err);
    }
    setReloads((n) => n + 1);
  }

  // After sending one: show it in a list that has it.
  function created() {
    if (scope === "mine" || scope === "all") setReloads((n) => n + 1);
    else switchScope(selfEmployeeId ? "mine" : "all");
  }

  function switchScope(next: Scope) {
    setScope(next);
    const url = new URL(window.location.href);
    url.searchParams.set("scope", next);
    url.searchParams.delete("id");
    window.history.replaceState(null, "", url);
  }

  const tabs: { id: Scope; label: string; count?: number }[] = [
    ...(selfEmployeeId ? [{ id: "mine" as const, label: "My requests" }] : []),
    // Line managers see this tab once something waits on them; approvers always.
    ...(canManage || waiting > 0 || scope === "approvals" ? [{ id: "approvals" as const, label: "Waiting for me", count: waiting }] : []),
    ...(canManage ? [{ id: "all" as const, label: "All requests" }] : []),
  ];

  const columns: DataTableColumn<EmployeeRequest>[] = [
    ...(scope !== "mine"
      ? [
          {
            id: "employee",
            header: "Employee",
            primary: true,
            cell: (r: EmployeeRequest) => (
              <div className="flex flex-col">
                <span className="font-medium">{r.employee.name}</span>
                {r.employee.branch && <span className="text-xs text-muted-foreground">{r.employee.branch}</span>}
              </div>
            ),
            sortValue: (r: EmployeeRequest) => r.employee.name,
            searchValue: (r: EmployeeRequest) => r.employee.name,
          },
        ]
      : []),
    {
      id: "type",
      header: "Request",
      primary: scope === "mine",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.label}</span>
          {r.leave_type?.name_km && <span className="text-xs text-muted-foreground">{r.leave_type.name_km}</span>}
        </div>
      ),
      sortValue: (r) => r.label,
      searchValue: (r) => [r.label, r.reason].filter(Boolean).join(" "),
    },
    {
      id: "dates",
      header: "Dates",
      cell: (r) => (
        <div className="flex flex-col">
          <span>{requestDates(r)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{requestAmount(r)}</span>
        </div>
      ),
      sortValue: (r) => r.start_date,
      sortLabels: ["Earliest first", "Latest first"],
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
          <span className="text-xs text-muted-foreground">
            {r.status === "pending"
              ? r.waiting_on
                ? `With ${r.waiting_on.name}`
                : "With an approver"
              : r.status === "cancelled"
                ? r.cancelled_by && `by ${r.cancelled_by.name}`
                : r.decided_by && `by ${r.decided_by.name}`}
          </span>
          {/* The remark the employee reads. */}
          {(r.status === "cancelled" ? r.cancel_reason : r.decision_notes) && (
            <span className="max-w-56 text-xs italic text-muted-foreground">“{r.status === "cancelled" ? r.cancel_reason : r.decision_notes}”</span>
          )}
        </div>
      ),
      sortValue: (r) => r.status,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Leave & requests"
        description="Ask for time off, or to arrive late or leave early — and follow what happens to it."
        action={
          (selfEmployeeId || canManage) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button />}>
                <Plus className="size-4" />
                New request
                <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setAsking("leave")}>
                  <CalendarHeart className="size-4" />
                  Leave
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAsking("late_early")}>
                  <AlarmClock className="size-4" />
                  Late arrival / Early leave
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      {scope === "mine" && <Balances balances={balances} />}

      {tabs.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={scope === tab.id}
              onClick={() => switchScope(tab.id)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                scope === tab.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count ? <span className="rounded-full bg-warning/20 px-1.5 text-xs text-warning tabular-nums">{tab.count}</span> : null}
            </button>
          ))}
        </div>
      )}

      <DataTable
        data={rows}
        getRowId={(r) => r.id}
        columns={columns}
        onRowClick={setOpen}
        filters={[
          {
            type: "select",
            id: "status",
            label: "Status",
            options: Object.entries(REQUEST_STATUS).map(([value, s]) => ({ value, label: s.label })),
            getValue: (r) => r.status,
          },
          { type: "date-range", id: "dates", label: "Dates", getValue: (r) => r.start_date },
        ]}
        searchPlaceholder={scope === "mine" ? "Search requests…" : "Search employee or request…"}
        emptyState={{
          icon: scope === "approvals" ? Inbox : CalendarHeart,
          title: scope === "approvals" ? "Nothing waiting for you" : scope === "mine" ? "No requests yet" : "No requests",
          description:
            scope === "approvals"
              ? "Leave and late / early requests from your team show up here for you to approve."
              : scope === "mine"
                ? "Tap “New request” to ask for leave, or to arrive late or leave early."
                : "Requests from the branches you cover show up here.",
        }}
        bulkActions={
          canManage
            ? (selected, clearSelection) => {
                const deletable = selected.filter((r) => r.can.delete);
                return deletable.length > 0 ? (
                  <Button variant="destructive" size="sm" onClick={() => deleteRequests(deletable, clearSelection)}>
                    <Trash2 className="size-3.5" />
                    Delete {deletable.length}
                  </Button>
                ) : null;
              }
            : undefined
        }
        rowActions={(r) =>
          r.can.decide ? (
            <Button size="sm" onClick={() => setOpen(r)}>
              Review
            </Button>
          ) : null
        }
      />

      <LeaveRequestDialog
        open={asking === "leave"}
        onOpenChange={(o) => setAsking(o ? "leave" : null)}
        onCreated={created}
        selfEmployeeId={selfEmployeeId}
        people={people}
      />
      <LateEarlyRequestDialog
        open={asking === "late_early"}
        onOpenChange={(o) => setAsking(o ? "late_early" : null)}
        onCreated={created}
        selfEmployeeId={selfEmployeeId}
        people={people}
      />
      <RequestDetailDialog
        request={open}
        onOpenChange={(o) => !o && setOpen(null)}
        onChanged={changed}
        onDeleted={() => setReloads((n) => n + 1)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <RequestsPage />
    </Suspense>
  );
}
