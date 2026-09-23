"use client";

import { useEffect, useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveBlob } from "@/lib/download";

/**
 * Shows a generated PDF (an ID card) in-place, in the browser's own PDF
 * viewer embedded via <iframe> — no separate tab. "Download" inside here
 * uses the same blob, so the file only has to be generated once per open.
 */
export function CardPreviewDialog({
  blob,
  filename,
  open,
  onOpenChange,
}: {
  blob: Blob | null;
  filename: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Derived straight from `blob`, not stored in state — the effect below
  // only handles revoking it (a cleanup concern, not a render concern).
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ID card preview</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] overflow-hidden rounded-lg border border-border bg-muted">
          {url && <iframe src={url} title="ID card preview" className="h-full w-full" />}
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          <Button type="button" onClick={() => blob && saveBlob(blob, filename)} disabled={!blob}>
            <Download className="size-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
