"use client";

import { useMemo, useState } from "react";
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
import { EmployeeAvatar } from "@/components/dashboard/employees/employee-avatar";
import { hasLeft, labelIn, statusVariant } from "@/components/dashboard/employees/employee-form";
import { useApi } from "@/hooks/use-api";
import { api, Employee } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useLang, useT } from "@/lib/i18n";

type Target = { id: number; name: string };

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
  const t = useT();
  const lang = useLang();
  const targetId = target?.id;
  const [candidates, setCandidates] = useState<Employee[] | null>(null);
  const [mode, setMode] = useState<"list" | "add">("list");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: members, reload } = useApi(
    targetId === undefined
      ? null
      : () =>
          api.employees
            .list(kind === "department" ? { departmentId: targetId } : { teamId: targetId })
            .then((res) => res.data)
            .catch((): Employee[] => []),
    [kind, targetId],
    { keepPrevious: true },
  );

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
      setCandidates(res.data.filter((e) => !hasLeft(e.employment_status)));
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
    reload();
    onChanged();
  }

  async function handleAdd() {
    if (!target || picked.size === 0) return;
    setBusy(true);

    try {
      const ids = [...picked];
      const call = kind === "department" ? api.departments.addMembers : api.teams.addMembers;
      await call(target.id, ids);
      notifySuccess(t(ids.length === 1 ? "org.members.addedOne" : "org.members.addedOther", { n: ids.length, name: target.name }));
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
      notifySuccess(t("org.members.removed", { employee: employee.name, name: target.name }));
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

  const isDepartment = kind === "department";

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? t("org.members.addTitle", { name: target?.name ?? "" }) : target?.name}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? (hint ?? t(isDepartment ? "org.members.pickDepartment" : "org.members.pickTeam"))
              : members === null
                ? t("common.message.loading")
                : isDepartment
                  ? t(members.length === 1 ? "org.members.countDepartmentOne" : "org.members.countDepartmentOther", { n: members.length })
                  : t(members.length === 1 ? "org.members.countTeamOne" : "org.members.countTeamOther", { n: members.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("org.members.search")}
            aria-label={t("org.members.searchLabel")}
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
                  {members.length === 0
                    ? t(isDepartment ? "org.members.emptyDepartment" : "org.members.emptyTeam")
                    : t("org.members.noMatches")}
                </p>
              )}
              <ul className="divide-y divide-border">
                {shownMembers.map((employee) => (
                  <li key={employee.id} className="flex items-center gap-3 px-3 py-2.5">
                    <EmployeeAvatar name={employee.name} photoUrl={employee.photo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{employee.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[employee.job_title, employee.branch?.name].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    {employee.employment_status !== "active" && (
                      <Badge variant={statusVariant(employee.employment_status)}>
                        {labelIn(lang, "status", employee.employment_status)}
                      </Badge>
                    )}
                    {canManage && (
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => handleRemove(employee)}>
                        <UserMinus className="size-3.5" />
                        {t("org.members.remove")}
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
                    ? t(isDepartment ? "org.members.allInDepartment" : "org.members.allInTeam")
                    : t("org.members.noMatches")}
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
                        <EmployeeAvatar name={employee.name} photoUrl={employee.photo_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{employee.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[employee.job_title, employee.branch?.name].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        {place && <Badge variant="secondary">{t("org.members.movesFrom", { place })}</Badge>}
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
              <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.close")}</DialogClose>
              {canManage && (
                <Button onClick={startAdding} disabled={busy}>
                  <UserPlus className="size-4" />
                  {t("org.members.addPeople")}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setMode("list")} disabled={busy}>
                {t("common.action.back")}
              </Button>
              <Button onClick={handleAdd} disabled={busy || picked.size === 0}>
                {busy
                  ? t("common.message.adding")
                  : picked.size === 0
                    ? t("org.members.addPeople")
                    : picked.size === 1
                      ? t("org.members.addOne")
                      : t("org.members.addOther", { n: picked.size })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
