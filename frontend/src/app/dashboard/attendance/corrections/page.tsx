"use client";

import { useEffect, useState } from "react";
import { FileEdit, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, AttendanceCorrection } from "@/lib/api";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function AttendanceCorrectionsPage() {
  const { me } = useMe();
  const [corrections, setCorrections] = useState<AttendanceCorrection[] | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.attendanceCorrections.list().then((res) => setCorrections(res.data)).catch(() => setCorrections([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.attendanceCorrections.create({
        date,
        reason,
        requested_check_in: checkIn || undefined,
        requested_check_out: checkOut || undefined,
      });
      setDate("");
      setReason("");
      setCheckIn("");
      setCheckOut("");
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(correction: AttendanceCorrection) {
    await api.attendanceCorrections.approve(correction.id);
    load();
  }

  async function handleReject(correction: AttendanceCorrection) {
    await api.attendanceCorrections.reject(correction.id);
    load();
  }

  const canManage = me?.permissions.includes("attendance.manage") ?? false;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Correction requests"
          description="Fix a missed check-in or check-out."
          action={
            me?.employee && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button>
                      <Plus className="size-4" />
                      Request correction
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request a correction</DialogTitle>
                    <DialogDescription>Your manager will need to approve this.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="check_in">Check-in time</Label>
                        <Input
                          id="check_in"
                          type="datetime-local"
                          value={checkIn}
                          onChange={(e) => setCheckIn(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="check_out">Check-out time</Label>
                        <Input
                          id="check_out"
                          type="datetime-local"
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="reason">Reason</Label>
                      <Input id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Submitting…" : "Submit request"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        {corrections === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {corrections?.length === 0 && (
          <EmptyState icon={FileEdit} title="No correction requests" description="Nothing to review right now." />
        )}

        {corrections && corrections.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && <TableHead>Employee</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Requested check-in</TableHead>
                <TableHead>Requested check-out</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {corrections.map((correction) => (
                <TableRow key={correction.id}>
                  {canManage && <TableCell className="font-medium">{correction.employee.name}</TableCell>}
                  <TableCell>{correction.date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(correction.requested_check_in)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(correction.requested_check_out)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{correction.reason}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        correction.status === "approved"
                          ? "success"
                          : correction.status === "rejected"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {correction.status}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {correction.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleApprove(correction)}>
                            Approve
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleReject(correction)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
