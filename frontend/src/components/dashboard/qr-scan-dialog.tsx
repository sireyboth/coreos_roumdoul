"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQrScanner } from "@/hooks/use-qr-scanner";

export function QrScanDialog({
  open,
  onOpenChange,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (token: string) => void;
}) {
  const { videoRef, canvasRef, error } = useQrScanner(open, onScan);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan the branch&apos;s QR code</DialogTitle>
          <DialogDescription>Point your camera at the code posted at your branch.</DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-md border border-border bg-black">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
