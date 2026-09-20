"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Employee } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

type Target = { id: number; name: string };

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 text-xs font-semibold text-white">
      {initialsOf(name)}
    </div>
  );
}

/**
 * Who is in a department or team — with bulk add and remove. The two kinds
 * behave the same; only the API calls and the wording differ.
 */
export function MembersDialog({
  kind,
  target,
  canManage,
  hint,
  onOpenChange,
  onChanged,
}: {
  kind: "department" | "team";
  target: Target | null;
  canManage: boolean;
  // A line explaining what adding does (e.g. that people are moved).
  hint?: string;
  onOpenChange: (open: boolean) => void;
  // Called after people were added or removed, so the page can refresh its counts.
  onChanged: () => void;
}) {
  const targetId = target?.id;
  const [members, setMembers] = useState<Employee[] | null>(null);
  const [candidates, setCandidates] = useState<Employee[] | null>(null);
  const [mode, setMode] = useState<"list" | "add">("list");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (targetId === undefined) return;
    let cancelled = false;

    api.employees
      .list(kind === "department" ? { departmentId: targetId } : { teamId: targetId })
      .then((res) => !cancelled && setMembers(res.data))
      .catch(() => !cancelled && setMembers([]));

    return () => {
      cancelled = true;
    };
  }, [kind, targetId, reloads]);

  const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);
  const term = search.trim().toLowerCase();
  const matches = (e: Employee) =>
    !term || [e.name, e.employee_code, e.job_title].some((v) => v?.toLowerCase().includes(term));

  const shownMembers = (members ?? []).filter(matches);
  const available = (candidates ?? []).filter((e) => !memberIds.has(e.id) && matches(e));

  async function startAdding() {
    setMode("add");
    setPicked(new Set());
    setSearch("");

    if (candidates) return;
    try {
      const res = await api.employees.list();
      setCandidates(res.data.filter((e) => e.employment_status !== "terminated"));
    } catch (err) {
      notifyError(err);
      setMode("list");
    }
  }

  function toggle(id: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function refresh() {
    setReloads((n) => n + 1);
    onChanged();
  }

  async function handleAdd() {
    if (!target || picked.size === 0) return;
    setBusy(true);

    try {
      const ids = [...picked];
      const call = kind === "department" ? api.departments.addMembers : api.teams.addMembers;
      await call(target.id, ids);
      notifySuccess(`${ids.length} ${ids.length === 1 ? "employee" : "employees"} added to ${target.name}`);
      // The picked people are members now; the candidate list is stale.
      setCandidates(null);
      setMode("list");
      setSearch("");
      refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(employee: Employee) {
    if (!target) return;
    setBusy(true);

    try {
      const call = kind === "department" ? api.departments.removeMember : api.teams.removeMember;
      await call(target.id, employee.id);
      notifySuccess(`${employee.name} removed from ${target.name}`);
      setCandidates(null);
      refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(false);
    }
  }

  // Where an employee is now, so an admin can see who would be moved.
  function currentPlace(e: Employee): string | null {
    if (kind === "department") return e.department?.name ?? null;
    return e.team?.name ?? null;
  }

  const noun = kind === "department" ? "department" : "team";

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? `Add people to ${target?.name}` : target?.name}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? (hint ?? `Pick the employees to add to this ${noun}.`)
              : members === null
                ? "Loading…"
                : `${members.length} ${members.length === 1 ? "employee" : "employees"} in this ${noun}`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or job title…"
            aria-label="Search employees"
            className="pl-8"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border">
          {mode === "list" && (
            <>
              {members === null && (
                <div className="flex flex-col gap-3 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
              {members !== null && shownMembers.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {members.length === 0 ? `No one is in this ${noun} yet.` : "No one matches your search."}
                </p>
              )}
              <ul className="divide-y divide-border">
                {shownMembers.map((employee) => (
                  <li key={employee.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={employee.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{employee.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[employee.job_title, employee.branch?.name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    {employee.employment_status !== "active" && (
                      <Badge variant="warning" className="capitalize">
                        {employee.employment_status.replace("_", " ")}
                      </Badge>
                    )}
                    {canManage && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => handleRemove(employee)}>
                        <UserMinus className="size-3.5" />
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {mode === "add" && (
            <>
              {candidates === null && (
                <div className="flex flex-col gap-3 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
              {candidates !== null && available.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {candidates.filter((e) => !memberIds.has(e.id)).length === 0
                    ? `Everyone is already in this ${noun}.`
                    : "No one matches your search."}
                </p>
              )}
              <ul className="divide-y divide-border">
                {available.map((employee) => {
                  const place = currentPlace(employee);

                  return (
                    <li key={employee.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={picked.has(employee.id)}
                          onChange={() => toggle(employee.id)}
                          className="size-4 rounded border-input"
                        />
                        <Avatar name={employee.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{employee.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[employee.job_title, employee.branch?.name].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        {place && <Badge variant="secondary">Moves from {place}</Badge>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <DialogFooter>
          {mode === "list" ? (
            <>
              <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
              {canManage && (
                <Button onClick={startAdding} disabled={busy}>
                  <UserPlus className="size-4" />
                  Add people
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setMode("list")} disabled={busy}>
                Back
              </Button>
              <Button onClick={handleAdd} disabled={busy || picked.size === 0}>
                {busy ? "Adding…" : `Add ${picked.size || ""} ${picked.size === 1 ? "person" : "people"}`.replace("  ", " ")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
