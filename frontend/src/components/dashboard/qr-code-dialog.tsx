"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifyError, notifySuccess } from "@/lib/notify";

/**
 * Shows a printable check-in QR code for a branch or work location, with a
 * "regenerate" action that invalidates the old printed poster.
 */
export function QrCodeDialog({
  name,
  token,
  open,
  onOpenChange,
  onRegenerate,
}: {
  name: string | undefined;
  token: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Should call the API and hand the fresh record back to the caller.
  onRegenerate: () => Promise<void>;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;

    (token ? QRCode.toDataURL(token, { width: 320, margin: 1 }) : Promise.resolve(null)).then((url) => {
      if (!cancelled) setImageUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleRegenerate() {
    const ok = await confirm({
      title: "Generate a new QR code?",
      description: "The old poster will stop working immediately, so you'll need to print and replace it.",
      confirmLabel: "Generate new code",
      destructive: true,
    });
    if (!ok) return;

    setRegenerating(true);
    try {
      await onRegenerate();
      notifySuccess("New QR code generated", "The old poster no longer works.");
    } catch (err) {
      notifyError(err);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in QR code for &quot;{name}&quot;</DialogTitle>
          <DialogDescription>
            Print this and place it where employees check in. Scanning it checks them in here — no GPS needed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`QR code for ${name}`} className="rounded-md border border-border" />
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
