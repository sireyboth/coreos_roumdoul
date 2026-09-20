"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
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
import { api, ApiError, WorkLocation } from "@/lib/api";

export default function WorkLocationsPage() {
  const { me } = useMe();
  const [locations, setLocations] = useState<WorkLocation[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.workLocations.list().then((res) => setLocations(res.data)).catch(() => setLocations([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await api.workLocations.create({ name, address: address || null, radius_meters: Number(radius) });
      setName("");
      setAddress("");
      setRadius("100");
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const canManage = me?.permissions.includes("work_locations.manage") ?? false;

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader
          title="Work Locations"
          description="Where employees can check in from, with a geofence radius for future GPS verification."
          action={
            canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger
                  render={
                    <Button>
                      <Plus className="size-4" />
                      Add location
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a work location</DialogTitle>
                    <DialogDescription>The radius controls how close a check-in must be.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="address">Address (optional)</Label>
                      <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="radius">Radius (meters)</Label>
                      <Input
                        id="radius"
                        type="number"
                        min={10}
                        max={5000}
                        value={radius}
                        onChange={(e) => setRadius(e.target.value)}
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={saving}>
                        {saving ? "Adding…" : "Add location"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        {locations === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {locations?.length === 0 && (
          <EmptyState
            icon={MapPin}
            title="No work locations yet"
            description="Add a location so employees have somewhere to check in from."
          />
        )}

        {locations && locations.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Radius</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell className="text-muted-foreground">{location.address ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{location.radius_meters}m</TableCell>
                  <TableCell>
                    <Badge variant={location.is_active ? "default" : "secondary"}>
                      {location.is_active ? "Active" : "Inactive"}
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
