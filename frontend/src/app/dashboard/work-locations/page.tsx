"use client";

import { useEffect, useState } from "react";
import { MapPin, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { QrCodeDialog } from "@/components/dashboard/qr-code-dialog";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, WorkLocation } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";

function WorkLocationFormDialog({
  location,
  open,
  onOpenChange,
  onSaved,
}: {
  location: WorkLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  // A branch's own check-in point is managed through the branch: only how
  // strict the geofence is and whether it's active can change here.
  const managedByBranch = location?.branch_id != null;

  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [latitude, setLatitude] = useState(location?.latitude != null ? String(location.latitude) : "");
  const [longitude, setLongitude] = useState(location?.longitude != null ? String(location.longitude) : "");
  const [radius, setRadius] = useState(String(location?.radius_meters ?? 100));
  const [active, setActive] = useState(location?.is_active ?? true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleUseCurrentLocation() {
    setError(null);

    if (!navigator.geolocation) {
      setError("Your browser doesn't support location.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(7));
        setLongitude(position.coords.longitude.toFixed(7));
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — check browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (location) {
        const payload = managedByBranch
          ? { radius_meters: Number(radius), is_active: active }
          : {
              name,
              address: address || null,
              latitude: latitude === "" ? null : Number(latitude),
              longitude: longitude === "" ? null : Number(longitude),
              radius_meters: Number(radius),
              is_active: active,
            };
        await api.workLocations.update(location.id, payload);
        notifySuccess("Work location updated");
      } else {
        await api.workLocations.create({
          name,
          address: address || null,
          latitude: latitude === "" ? null : Number(latitude),
          longitude: longitude === "" ? null : Number(longitude),
          radius_meters: Number(radius),
        });
        notifySuccess("Work location added");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location ? `Edit "${location.name}"` : "Add a work location"}</DialogTitle>
          <DialogDescription>
            {managedByBranch
              ? "This is a branch's check-in point. Change its name, address or coordinates from the Branches page."
              : "A check-in point that isn't tied to a branch — e.g. a client site or a company-wide office."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!managedByBranch && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="address">Address (optional)</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Location</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="self-start"
                >
                  <MapPin className="size-3.5" />
                  {locating ? "Locating…" : "Use my current location"}
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                      Latitude
                    </Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 11.5564"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                      Longitude
                    </Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      required
                      placeholder="e.g. 104.9282"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
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
            <p className="text-xs text-muted-foreground">
              How close someone must be for a GPS check-in to count. QR check-ins ignore this.
            </p>
          </div>
          {location && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Active
            </label>
          )}
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : location ? "Save changes" : "Add location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkLocationsPage() {
  const { me } = useMe();
  const confirm = useConfirm();
  const [locations, setLocations] = useState<WorkLocation[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkLocation | null>(null);
  // Bumped on every open so the form always starts from fresh values.
  const [formKey, setFormKey] = useState(0);
  const [qrLocation, setQrLocation] = useState<WorkLocation | null>(null);

  function load() {
    api.workLocations.list().then((res) => setLocations(res.data)).catch(() => setLocations([]));
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(location: WorkLocation | null) {
    setEditing(location);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function handleDelete(location: WorkLocation) {
    const ok = await confirm({
      title: `Delete "${location.name}"?`,
      description:
        "Past attendance keeps its record of this location. If upcoming schedules use it, you'll need to change those first — or just deactivate it instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.workLocations.remove(location.id);
      notifySuccess(`"${location.name}" deleted`);
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("work_locations.manage") ?? false;

  const columns: DataTableColumn<WorkLocation>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (location) => <span className="font-medium">{location.name}</span>,
      sortValue: (location) => location.name,
      searchValue: (location) => `${location.name} ${location.address ?? ""}`,
    },
    {
      id: "branch",
      header: "Branch",
      cell: (location) =>
        location.branch ? (
          <span>{location.branch.name}</span>
        ) : (
          <Badge variant="outline">Company-wide</Badge>
        ),
      sortValue: (location) => location.branch?.name ?? "",
      searchValue: (location) => location.branch?.name,
    },
    {
      id: "address",
      header: "Address",
      hideOnMobile: true,
      cell: (location) => <span className="text-muted-foreground">{location.address ?? "—"}</span>,
      sortValue: (location) => location.address,
    },
    {
      id: "radius",
      header: "Radius",
      cell: (location) => <span className="text-muted-foreground">{location.radius_meters}m</span>,
      sortValue: (location) => location.radius_meters,
    },
    {
      id: "status",
      header: "Status",
      cell: (location) => (
        <Badge variant={location.is_active ? "success" : "secondary"}>{location.is_active ? "Active" : "Inactive"}</Badge>
      ),
      sortValue: (location) => (location.is_active ? 1 : 0),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Work Locations"
          description="Physical check-in points. Each branch has one automatically; add extra ones for client sites or company-wide offices."
          action={
            canManage && (
              <Button onClick={() => openForm(null)}>
                <Plus className="size-4" />
                Add location
              </Button>
            )
          }
        />

        <DataTable
          data={locations}
          getRowId={(location) => location.id}
          columns={columns}
          searchPlaceholder="Search locations…"
          emptyState={{
            icon: MapPin,
            title: "No work locations yet",
            description: "Add a location so employees have somewhere to check in from.",
          }}
          rowActions={
            canManage
              ? (location) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setQrLocation(location)}>
                      <QrCode className="size-3.5" />
                      QR code
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openForm(location)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    {location.branch_id == null && (
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(location)}>
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    )}
                  </>
                )
              : undefined
          }
        />
      </div>

      <WorkLocationFormDialog
        key={formKey}
        location={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={load}
      />

      <QrCodeDialog
        name={qrLocation?.name}
        token={qrLocation?.qr_token}
        open={qrLocation !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQrLocation(null);
        }}
        onRegenerate={async () => {
          if (!qrLocation) return;
          const updated = await api.workLocations.regenerateQr(qrLocation.id);
          setQrLocation(updated);
          setLocations((current) => current?.map((l) => (l.id === updated.id ? updated : l)) ?? current);
        }}
      />
    </div>
  );
}
