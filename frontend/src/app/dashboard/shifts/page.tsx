"use client";

import { useEffect, useState } from "react";
import { Plus, Timer } from "lucide-react";
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
import { api, ApiError, Shift } from "@/lib/api";

export default function ShiftsPage() {
  const { me } = useMe();
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.shifts.list().then((res) => setShifts(res.data)).catch(() => setShifts([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.shifts.create({
        name,
        start_time: startTime,
        end_time: endTime,
        break_minutes: Number(breakMinutes),
      });
      setName("");
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const canManage = me?.permissions.includes("shifts.manage") ?? false;

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader
          title="Shifts"
          description="Reusable start/end times and break rules employees get scheduled onto."
          action={
            canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button>
                      <Plus className="size-4" />
                      Add shift
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a shift</DialogTitle>
                    <DialogDescription>Define the hours and break for this shift.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="start_time">Start</Label>
                        <Input
                          id="start_time"
                          type="time"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="end_time">End</Label>
                        <Input
                          id="end_time"
                          type="time"
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="break_minutes">Break (minutes)</Label>
                      <Input
                        id="break_minutes"
                        type="number"
                        min={0}
                        max={240}
                        value={breakMinutes}
                        onChange={(e) => setBreakMinutes(e.target.value)}
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Adding…" : "Add shift"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        {shifts === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {shifts?.length === 0 && (
          <EmptyState
            icon={Timer}
            title="No shifts yet"
            description="Create a shift so you can start building the roster."
          />
        )}

        {shifts && shifts.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell className="font-medium">{shift.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {shift.break_minutes > 0 ? `${shift.break_minutes} min` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={shift.is_active ? "default" : "secondary"}>
                      {shift.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
