"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Building2, MapPin, Plus, QrCode } from "lucide-react";
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
import { api, ApiError, Branch } from "@/lib/api";

function BranchQrDialog({
  branch,
  open,
  onOpenChange,
  onRegenerated,
}: {
  branch: Branch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegenerated: (branch: Branch) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = branch?.qr_token;

    (token
      ? QRCode.toDataURL(token, { width: 320, margin: 1 })
      : Promise.resolve(null)
    ).then((url) => {
      if (!cancelled) setImageUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [branch?.qr_token]);

  async function handleRegenerate() {
    if (!branch) return;
    if (!confirm("Regenerate this QR code? The old poster will stop working immediately.")) return;
    setRegenerating(true);
    try {
      const updated = await api.branches.regenerateQr(branch.id);
      onRegenerated(updated);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in QR code for &quot;{branch?.name}&quot;</DialogTitle>
          <DialogDescription>
            Print this and place it where employees check in. Scanning it checks them in at this branch —
            no GPS needed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`QR code for ${branch?.name}`} className="rounded-md border border-border" />
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? "Regenerating…" : "Regenerate code"}
          </Button>
          <DialogClose render={<Button type="button" />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  const { me } = useMe();
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
      setCreateForm(EMPTY_FORM);
      setCreateOpen(false);
      load();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
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
      setEditingBranch(null);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSavingEdit(false);
    }
  }

  const canManage = me?.permissions.includes("branches.manage") ?? false;

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader
          title="Branches"
          description="Physical or virtual locations your employees belong to."
          action={
            canManage && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger
                  render={
                    <Button>
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
                    {createError && <p className="text-sm text-destructive">{createError}</p>}
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

        {branches === null && <p className="text-sm text-muted-foreground">Loading…</p>}

        {branches?.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description="Add your first branch to start organizing your team."
          />
        )}

        {branches && branches.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell className="text-muted-foreground">{branch.code ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {branch.latitude != null ? (
                      <Badge variant="outline">
                        <MapPin className="size-3" />
                        GPS set
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={branch.is_active ? "default" : "secondary"}>
                      {branch.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setQrBranch(branch)}>
                          <QrCode className="size-3.5" />
                          QR code
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

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
              {editError && <p className="text-sm text-destructive">{editError}</p>}
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

      <BranchQrDialog
        branch={qrBranch}
        open={qrBranch !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQrBranch(null);
        }}
        onRegenerated={(updated) => {
          setQrBranch(updated);
          setBranches((current) => current?.map((b) => (b.id === updated.id ? updated : b)) ?? current);
        }}
      />
    </div>
  );
}
