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
import { PageHeader } from "@/components/dashboard/page-header";
import { useMe } from "@/contexts/me-context";
import { api, ApiError, Branch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { notifyError, notifySuccess } from "@/lib/notify";
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
};

const EMPTY_FORM: BranchFormState = {
  name: "",
  code: "",
  address: "",
  latitude: "",
  longitude: "",
  is_active: true,
};

function BranchFormFields({
  form,
  onChange,
}: {
  form: BranchFormState;
  onChange: (form: BranchFormState) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function handleUseCurrentLocation() {
    setLocationError(null);
    setLocating(true);

    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
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
        setLocationError("Couldn't get your location — check browser permissions.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Code (optional)</Label>
        <Input id="code" value={form.code} onChange={(e) => onChange({ ...form, code: e.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address (optional)</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => onChange({ ...form, address: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Location</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation} disabled={locating} className="self-start">
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
              value={form.latitude}
              onChange={(e) => onChange({ ...form, latitude: e.target.value })}
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
              value={form.longitude}
              onChange={(e) => onChange({ ...form, longitude: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Required — this is what lets Attendance check whether a check-in is actually near this branch.
        </p>
        {locationError && <p className="text-xs text-destructive">{locationError}</p>}
      </div>
    </>
  );
}

export default function BranchesPage() {
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
    };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      await api.branches.create(toPayload(createForm));
      notifySuccess("Branch added");
      refresh();
      setCreateForm(EMPTY_FORM);
      setCreateOpen(false);
      load();
    } catch (err) {
      notifyError(err);
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(branch: Branch) {
    const ok = await confirm({
      title: `Delete "${branch.name}"?`,
      description:
        "Its check-in location and QR code are removed too. Past attendance keeps its history. If employees are still assigned here, move them first — or just deactivate the branch instead.",
      destructive: true,
    });
    if (!ok) return;

    try {
      await api.branches.remove(branch.id);
      notifySuccess(`"${branch.name}" deleted`);
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
      notifySuccess("Branch updated");
      setEditingBranch(null);
      load();
    } catch (err) {
      notifyError(err);
      setEditError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingEdit(false);
    }
  }

  const canManage = me?.permissions.includes("branches.manage") ?? false;

  const columns: DataTableColumn<Branch>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (branch) => <span className="font-medium">{branch.name}</span>,
      sortValue: (branch) => branch.name,
      searchValue: (branch) => `${branch.name} ${branch.address ?? ""}`,
    },
    {
      id: "code",
      header: "Code",
      cell: (branch) => <span className="text-muted-foreground">{branch.code ?? "—"}</span>,
      sortValue: (branch) => branch.code,
      searchValue: (branch) => branch.code,
    },
    {
      id: "location",
      header: "Location",
      cell: (branch) =>
        branch.latitude != null ? (
          <Badge variant="outline">
            <MapPin className="size-3" />
            GPS set
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (branch) => (
        <Badge variant={branch.is_active ? "success" : "secondary"}>{branch.is_active ? "Active" : "Inactive"}</Badge>
      ),
      sortValue: (branch) => (branch.is_active ? 1 : 0),
    },
  ];
  const atBranchLimit = me?.plan?.max_branches != null && (me.usage?.branches ?? 0) >= me.plan.max_branches;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex w-full flex-col gap-6">
        <PageHeader
          title="Branches"
          description="Physical or virtual locations your employees belong to."
          action={
            canManage && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger
                  render={
                    <Button disabled={atBranchLimit}>
                      <Plus className="size-4" />
                      Add branch
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a branch</DialogTitle>
                    <DialogDescription>
                      Adding a location makes it a real check-in point for Attendance.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="flex flex-col gap-4">
                    <BranchFormFields form={createForm} onChange={setCreateForm} />
                    {createError && <Alert variant="destructive">{createError}</Alert>}
                    <DialogFooter>
                      <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                      <Button type="submit" disabled={creating}>
                        {creating ? "Adding…" : "Add branch"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )
          }
        />

        <PlanLimitAlert resource="branches" />

        <DataTable
          data={branches}
          getRowId={(branch) => branch.id}
          columns={columns}
          searchPlaceholder="Search branches…"
          emptyState={{
            icon: Building2,
            title: "No branches yet",
            description: "Add your first branch to start organizing your team.",
          }}
          rowActions={
            canManage
              ? (branch) => (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setQrBranch(branch)}>
                      <QrCode className="size-3.5" />
                      QR code
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(branch)}>
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </>
                )
              : undefined
          }
        />

        <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit &quot;{editingBranch?.name}&quot;</DialogTitle>
              <DialogDescription>Updating coordinates keeps its check-in point in sync.</DialogDescription>
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
                Active
              </label>
              {editError && <Alert variant="destructive">{editError}</Alert>}
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving…" : "Save changes"}
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
