"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cropToSquareJpeg } from "@/lib/image";

/**
 * Drag to reposition, slide to zoom, then crop to a square — shown between
 * picking a file and actually uploading it, so the person controls what
 * part of the photo is used instead of an automatic centre-crop deciding
 * for them (see toSquareJpeg in lib/image.ts, the old always-centred path).
 */
export function PhotoCropDialog({
  imageUrl,
  open,
  onOpenChange,
  onCropped,
}: {
  // An object URL for the freshly-picked file. Owned by the caller — this
  // dialog only reads it, it doesn't create or revoke it.
  imageUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCropped: (photo: Blob) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust photo</DialogTitle>
        </DialogHeader>
        {/* Keyed on the image itself, so a new photo always starts with
            fresh crop/zoom state — remounting is simpler and more direct
            than an effect that resets state after the fact. */}
        {imageUrl && <CropEditor key={imageUrl} imageUrl={imageUrl} onCropped={onCropped} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function CropEditor({
  imageUrl,
  onCropped,
  onOpenChange,
}: {
  imageUrl: string;
  onCropped: (photo: Blob) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setArea(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!area) return;
    setSaving(true);
    try {
      await onCropped(await cropToSquareJpeg(imageUrl, area));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Zoom"
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={saving} />}>Cancel</DialogClose>
        <Button type="button" onClick={handleConfirm} disabled={saving || !area}>
          {saving ? "Saving…" : "Use photo"}
        </Button>
      </DialogFooter>
    </>
  );
}
