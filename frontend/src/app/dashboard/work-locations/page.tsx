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
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { DisplayOrderField, displayOrderColumn, fromSortOrder, toSortOrder } from "@/components/dashboard/display-order";
import { PageHeader } from "@/components/dashboard/page-header";
import { QrCodeDialog } from "@/components/dashboard/qr-code-dialog";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, WorkLocation } from "@/lib/api";
import { exportWorkLocations, workLocationImport } from "@/lib/excel-specs/organization";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";

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

  const t = useT();
  const [name, setName] = useState(location?.name ?? "");
  const [address, setAddress] = useState(location?.address ?? "");
  const [latitude, setLatitude] = useState(location?.latitude != null ? String(location.latitude) : "");
  const [longitude, setLongitude] = useState(location?.longitude != null ? String(location.longitude) : "");
  const [radius, setRadius] = useState(String(location?.radius_meters ?? 100));
  const [active, setActive] = useState(location?.is_active ?? true);
  const [requireLocation, setRequireLocation] = useState(location?.require_location ?? false);
  const [sortOrder, setSortOrder] = useState(fromSortOrder(location?.sort_order));
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleUseCurrentLocation() {
    setError(null);

    if (!navigator.geolocation) {
      setError(t("org.shared.noGeolocation"));
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
        setError(t("org.shared.locationDenied"));
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
          ? { radius_meters: Number(radius), is_active: active, sort_order: toSortOrder(sortOrder) }
          : {
              name,
              address: address || null,
              latitude: latitude === "" ? null : Number(latitude),
              longitude: longitude === "" ? null : Number(longitude),
              radius_meters: Number(radius),
              require_location: requireLocation,
              is_active: active,
              sort_order: toSortOrder(sortOrder),
            };
        await api.workLocations.update(location.id, payload);
        notifySuccess(t("org.workLocationsPage.updated"));
      } else {
        await api.workLocations.create({
          name,
          address: address || null,
          latitude: latitude === "" ? null : Number(latitude),
          longitude: longitude === "" ? null : Number(longitude),
          radius_meters: Number(radius),
          require_location: requireLocation,
          sort_order: toSortOrder(sortOrder),
        });
        notifySuccess(t("org.workLocationsPage.added"));
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      notifyError(err);
      setError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location ? t("org.shared.editTitle", { name: location.name }) : t("org.workLocationsPage.addTitle")}</DialogTitle>
          <DialogDescription>
            {managedByBranch
              ? t("org.workLocationsPage.branchDescription")
              : t("org.workLocationsPage.formDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!managedByBranch && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("common.field.name")}</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="address">{t("org.shared.address")}</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t("org.shared.location")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="self-start"
                >
                  <MapPin className="size-3.5" />
                  {locating ? t("org.shared.locating") : t("org.shared.useMyLocation")}
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="latitude" className="text-xs text-muted-foreground">
                      {t("org.shared.latitude")}
                    </Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      required
                      placeholder={t("org.shared.latitudeExample")}
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="longitude" className="text-xs text-muted-foreground">
                      {t("org.shared.longitude")}
                    </Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      required
                      placeholder={t("org.shared.longitudeExample")}
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="radius">{t("org.workLocationsPage.radius")}</Label>
            <Input
              id="radius"
              type="number"
              min={10}
              max={5000}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {managedByBranch ? t("org.workLocationsPage.radiusHint") : t("org.workLocationsPage.radiusHintRequire")}
            </p>
          </div>
          {!managedByBranch && (
            <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={requireLocation}
                disabled={latitude === "" || longitude === ""}
                onChange={(e) => setRequireLocation(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                <span className="font-medium">{t("org.shared.requireLocation")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {latitude === "" || longitude === ""
                    ? t("org.workLocationsPage.requireLocationNeedsCoords")
                    : t("org.workLocationsPage.requireLocationHint")}
                </span>
              </span>
            </label>
          )}
          {managedByBranch && (
            <p className="text-xs text-muted-foreground">
              {t("org.workLocationsPage.branchSetsLocation")}
            </p>
          )}
          {location && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded border-input"
              />
              {t("common.status.active")}
            </label>
          )}
          <DisplayOrderField id="location-order" value={sortOrder} onChange={setSortOrder} example={t("org.workLocationsPage.orderExample")} />
          {error && <Alert variant="destructive">{error}</Alert>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? t("org.shared.saving") : location ? t("org.shared.saveChanges") : t("org.workLocationsPage.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkLocationsPage() {
  const t = useT();
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
      title: t("org.shared.deleteTitle", { name: location.name }),
      description: t("org.workLocationsPage.deleteDescription"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.workLocations.remove(location.id);
      notifySuccess(t("org.shared.deleted", { name: location.name }));
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  const canManage = me?.permissions.includes("work_locations.manage") ?? false;

  const columns: DataTableColumn<WorkLocation>[] = [
    {
      id: "name",
      header: t("common.field.name"),
      primary: true,
      cell: (location) => <span className="font-medium">{location.name}</span>,
      sortValue: (location) => location.name,
      searchValue: (location) => `${location.name} ${location.address ?? ""}`,
    },
    displayOrderColumn<WorkLocation>(),
    {
      id: "branch",
      header: t("common.field.branch"),
      cell: (location) =>
        location.branch ? (
          <span>{location.branch.name}</span>
        ) : (
          <Badge variant="outline">{t("org.shared.companyWide")}</Badge>
        ),
      sortValue: (location) => location.branch?.name ?? "",
      searchValue: (location) => location.branch?.name,
    },
    {
      id: "address",
      header: t("org.shared.colAddress"),
      hideOnMobile: true,
      cell: (location) => <span className="text-muted-foreground">{location.address ?? "—"}</span>,
      sortValue: (location) => location.address,
    },
    {
      id: "radius",
      header: t("org.workLocationsPage.colRadius"),
      cell: (location) => <span className="text-muted-foreground">{t("org.workLocationsPage.radiusValue", { n: location.radius_meters })}</span>,
      sortValue: (location) => location.radius_meters,
    },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (location) => (
        <Badge variant={location.is_active ? "success" : "secondary"}>{location.is_active ? t("common.status.active") : t("common.status.inactive")}</Badge>
      ),
      sortValue: (location) => (location.is_active ? 1 : 0),
      sortLabels: [t("org.shared.inactiveFirst"), t("org.shared.activeFirst")],
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("org.workLocationsPage.title")}
          description={t("org.workLocationsPage.description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportWorkLocations} importSpec={canManage ? workLocationImport : undefined} onImported={load} />
              {canManage && (
                <Button onClick={() => openForm(null)}>
                  <Plus className="size-4" />
                  {t("org.workLocationsPage.add")}
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={locations}
          getRowId={(location) => location.id}
          columns={columns}
          searchPlaceholder={t("org.workLocationsPage.search")}
          emptyState={{
            icon: MapPin,
            title: t("org.workLocationsPage.emptyTitle"),
            description: t("org.workLocationsPage.emptyDescription"),
          }}
          rowActions={
            canManage
              ? (location) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setQrLocation(location)}>
                      <QrCode className="size-3.5" />
                      {t("org.shared.qrCode")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openForm(location)}>
                      <Pencil className="size-3.5" />
                      {t("common.action.edit")}
                    </Button>
                    {location.branch_id == null && (
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(location)}>
                        <Trash2 className="size-3.5" />
                        {t("common.action.delete")}
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
