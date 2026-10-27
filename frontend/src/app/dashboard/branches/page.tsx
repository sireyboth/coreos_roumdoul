"use client";

import { useEffect, useState } from "react";
import { Building2, MapPin, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ExcelActions } from "@/components/dashboard/excel-actions";
import { DisplayOrderField, displayOrderColumn, fromSortOrder, toSortOrder } from "@/components/dashboard/display-order";
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { exportBranches, branchImport } from "@/lib/excel-specs/organization";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useT } from "@/lib/i18n";
import { PlanLimitAlert } from "@/components/dashboard/plan-limit-alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { QrCodeDialog } from "@/components/dashboard/qr-code-dialog";

type BranchFormState = {
  name: string;
  code: string;
  address: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
  require_location: boolean;
  sort_order: string;
};

const EMPTY_FORM: BranchFormState = {
  name: "",
  code: "",
  address: "",
  latitude: "",
  longitude: "",
  is_active: true,
  require_location: false,
  sort_order: "",
};

function BranchFormFields({
  form,
  onChange,
}: {
  form: BranchFormState;
  onChange: (form: BranchFormState) => void;
}) {
  const t = useT();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function handleUseCurrentLocation() {
    setLocationError(null);
    setLocating(true);

    if (!navigator.geolocation) {
      setLocationError(t("org.shared.noGeolocation"));
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...form,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        });
        setLocating(false);
      },
      () => {
        setLocationError(t("org.shared.locationDenied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("common.field.name")}</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t("org.shared.code")}</Label>
        <Input id="code" value={form.code} onChange={(e) => onChange({ ...form, code: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">{t("org.shared.address")}</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => onChange({ ...form, address: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("org.shared.location")}</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation} disabled={locating} className="self-start">
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
              value={form.latitude}
              onChange={(e) => onChange({ ...form, latitude: e.target.value })}
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
              value={form.longitude}
              onChange={(e) => onChange({ ...form, longitude: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("org.branchesPage.locationHint")}
        </p>
        {locationError && <p className="text-xs text-destructive">{locationError}</p>}
      </div>
      <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <input
          type="checkbox"
          checked={form.require_location}
          onChange={(e) => onChange({ ...form, require_location: e.target.checked })}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          <span className="font-medium">{t("org.shared.requireLocation")}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("org.branchesPage.requireLocationHint")}
          </span>
        </span>
      </label>
      <DisplayOrderField id="branch-order" value={form.sort_order} onChange={(value) => onChange({ ...form, sort_order: value })} example={t("org.branchesPage.orderExample")} />
    </>
  );
}

export default function BranchesPage() {
  const t = useT();
  const { me, refresh } = useMe();
  const confirm = useConfirm();
  const [branches, setBranches] = useState<Branch[] | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<BranchFormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState<BranchFormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [qrBranch, setQrBranch] = useState<Branch | null>(null);

  function load() {
    api.branches.list().then((res) => setBranches(res.data)).catch(() => setBranches([]));
  }

  useEffect(() => {
    load();
  }, []);

  function toPayload(form: BranchFormState) {
    return {
      name: form.name,
      code: form.code || null,
      address: form.address || null,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      is_active: form.is_active,
      require_location: form.require_location,
      sort_order: toSortOrder(form.sort_order),
    };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      await api.branches.create(toPayload(createForm));
      notifySuccess(t("org.branchesPage.added"));
      refresh();
      setCreateForm(EMPTY_FORM);
      setCreateOpen(false);
      load();
    } catch (err) {
      notifyError(err);
      setCreateError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(branch: Branch) {
    const ok = await confirm({
      title: t("org.shared.deleteTitle", { name: branch.name }),
      description: t("org.branchesPage.deleteDescription"),
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.branches.remove(branch.id);
      notifySuccess(t("org.shared.deleted", { name: branch.name }));
      refresh();
    } catch (err) {
      notifyError(err);
    }
    load();
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch);
    setEditForm({
      name: branch.name,
      code: branch.code ?? "",
      address: branch.address ?? "",
      latitude: branch.latitude != null ? String(branch.latitude) : "",
      longitude: branch.longitude != null ? String(branch.longitude) : "",
      is_active: branch.is_active,
      require_location: Boolean(branch.require_location),
      sort_order: fromSortOrder(branch.sort_order),
    });
    setEditError(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBranch) return;
    setEditError(null);
    setSavingEdit(true);

    try {
      await api.branches.update(editingBranch.id, toPayload(editForm));
      notifySuccess(t("org.branchesPage.updated"));
      setEditingBranch(null);
      load();
    } catch (err) {
      notifyError(err);
      setEditError(err instanceof ApiError ? err.message : t("common.message.somethingWrong"));
    } finally {
      setSavingEdit(false);
    }
  }

  const canManage = me?.permissions.includes("branches.manage") ?? false;

  const columns: DataTableColumn<Branch>[] = [
    {
      id: "name",
      header: t("common.field.name"),
      primary: true,
      cell: (branch) => <span className="font-medium">{branch.name}</span>,
      sortValue: (branch) => branch.name,
      searchValue: (branch) => `${branch.name} ${branch.address ?? ""}`,
    },
    displayOrderColumn<Branch>(),
    {
      id: "code",
      header: t("org.shared.colCode"),
      cell: (branch) => <span className="text-muted-foreground">{branch.code ?? "—"}</span>,
      sortValue: (branch) => branch.code,
      searchValue: (branch) => branch.code,
    },
    {
      id: "location",
      header: t("org.shared.location"),
      cell: (branch) =>
        branch.latitude != null ? (
          <Badge variant="outline">
            <MapPin className="size-3" />
            {t("org.branchesPage.gpsSet")}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "verify",
      header: t("org.branchesPage.colQrCheckIn"),
      cell: (branch) =>
        branch.require_location ? (
          <Badge variant="success">{t("org.branchesPage.locationRequired")}</Badge>
        ) : (
          <Badge variant="warning">{t("org.branchesPage.qrOnly")}</Badge>
        ),
      sortValue: (branch) => (branch.require_location ? 1 : 0),
      sortLabels: [t("org.branchesPage.qrOnlyFirst"), t("org.branchesPage.locationRequiredFirst")],
    },
    {
      id: "status",
      header: t("common.field.status"),
      cell: (branch) => (
        <Badge variant={branch.is_active ? "success" : "secondary"}>{branch.is_active ? t("common.status.active") : t("common.status.inactive")}</Badge>
      ),
      sortValue: (branch) => (branch.is_active ? 1 : 0),
      sortLabels: [t("org.shared.inactiveFirst"), t("org.shared.activeFirst")],
    },
  ];
  const atBranchLimit = me?.plan?.max_branches != null && (me.usage?.branches ?? 0) >= me.plan.max_branches;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title={t("org.branchesPage.title")}
          description={t("org.branchesPage.description")}
          action={
            <div className="flex flex-wrap gap-2">
              <ExcelActions onExport={exportBranches} importSpec={canManage ? branchImport : undefined} onImported={load} />
              {canManage && (
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger
                    render={
                      <Button disabled={atBranchLimit}>
                        <Plus className="size-4" />
                        {t("org.branchesPage.add")}
                      </Button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("org.branchesPage.addTitle")}</DialogTitle>
                      <DialogDescription>
                        {t("org.branchesPage.addDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="flex flex-col gap-4">
                      <BranchFormFields form={createForm} onChange={setCreateForm} />
                      {createError && <Alert variant="destructive">{createError}</Alert>}
                      <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
                        <Button type="submit" disabled={creating}>
                          {creating ? t("org.shared.adding") : t("org.branchesPage.add")}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />

        <PlanLimitAlert resource="branches" />

        <DataTable
          data={branches}
          getRowId={(branch) => branch.id}
          columns={columns}
          searchPlaceholder={t("org.branchesPage.search")}
          emptyState={{
            icon: Building2,
            title: t("org.branchesPage.emptyTitle"),
            description: t("org.branchesPage.emptyDescription"),
          }}
          rowActions={
            canManage
              ? (branch) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setQrBranch(branch)}>
                      <QrCode className="size-3.5" />
                      {t("org.shared.qrCode")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                      <Pencil className="size-3.5" />
                      {t("common.action.edit")}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(branch)}>
                      <Trash2 className="size-3.5" />
                      {t("common.action.delete")}
                    </Button>
                  </>
                )
              : undefined
          }
        />

        <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("org.shared.editTitle", { name: editingBranch?.name ?? "" })}</DialogTitle>
              <DialogDescription>{t("org.branchesPage.editDescription")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <BranchFormFields form={editForm} onChange={setEditForm} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="size-4 rounded border-input"
                />
                {t("common.status.active")}
              </label>
              {editError && <Alert variant="destructive">{editError}</Alert>}
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>{t("common.action.cancel")}</DialogClose>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? t("org.shared.saving") : t("org.shared.saveChanges")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <QrCodeDialog
        name={qrBranch?.name}
        token={qrBranch?.qr_token}
        open={qrBranch !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQrBranch(null);
        }}
        onRegenerate={async () => {
          if (!qrBranch) return;
          const updated = await api.branches.regenerateQr(qrBranch.id);
          setQrBranch(updated);
          setBranches((current) => current?.map((b) => (b.id === updated.id ? updated : b)) ?? current);
        }}
      />
    </div>
  );
}
