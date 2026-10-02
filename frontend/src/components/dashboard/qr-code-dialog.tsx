"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, RefreshCw } from "lucide-react";
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

  async function handleDownload() {
    if (!token) return;
    try {
      // Bigger than the on-screen image, so a printed poster stays sharp.
      const url = await QRCode.toDataURL(token, { width: 1024, margin: 2 });
      const link = document.createElement("a");
      link.href = url;
      link.download = `qr-${(name ?? "check-in").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "check-in"}.png`;
      link.click();
    } catch (err) {
      notifyError(err);
    }
  }

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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="leading-snug wrap-break-word">Check-in QR code for &quot;{name}&quot;</DialogTitle>
          <DialogDescription>
            Print this and place it where employees check in. Scanning it checks them in here — no GPS needed.
          </DialogDescription>
        </DialogHeader>
        {/* Always on white, so it scans in dark mode too. Shrinks to fit narrow phones. */}
        <div className="mx-auto aspect-square w-full max-w-72 rounded-lg border border-border bg-white p-3">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={`QR code for ${name}`} className="size-full" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-neutral-500">Loading…</div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className={regenerating ? "size-4 animate-spin" : "size-4"} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose render={<Button type="button" variant="outline" className="w-full sm:w-auto" />}>Done</DialogClose>
            <Button type="button" className="w-full sm:w-auto" onClick={handleDownload} disabled={!imageUrl}>
              <Download className="size-4" />
              Download QR
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
