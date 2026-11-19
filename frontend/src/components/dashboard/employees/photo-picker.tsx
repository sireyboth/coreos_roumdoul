"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoCropDialog } from "@/components/dashboard/employees/photo-crop-dialog";
import { PhotoViewerDialog } from "@/components/dashboard/employees/photo-viewer-dialog";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The big profile photo with Upload / Change / Remove. It only resizes the
 * chosen file and hands the result up — the parent decides what to do with
 * it (upload straight away when editing, keep it until Save when creating).
 */
export function PhotoPicker({
  name,
  src,
  canEdit,
  busy,
  onPick,
  onRemove,
}: {
  name: string;
  // Fully resolved image URL (a signed link or a local preview), or null.
  src: string | null;
  canEdit: boolean;
  busy?: boolean;
  onPick: (photo: Blob) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // The freshly-picked file, as an object URL, while the crop dialog is
  // open — cleared (and revoked) once the dialog closes either way.
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  // Full-size view of the current photo (tap the photo to open).
  const [viewing, setViewing] = useState(false);

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("employees.photo.notImage"));
      return;
    }

    setError(null);
    setPickedUrl(URL.createObjectURL(file));
  }

  function closeCropDialog(open: boolean) {
    if (!open && pickedUrl) {
      URL.revokeObjectURL(pickedUrl);
      setPickedUrl(null);
    }
  }

  async function handleCropped(photo: Blob) {
    try {
      await onPick(photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("employees.photo.unusable"));
    }
  }

  // Only a photo that actually loaded can be opened full-size.
  const showsPhoto = src !== null && failed !== src;
  const tile = cn(
    "relative flex size-36 items-center justify-center overflow-hidden rounded-3xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-4xl font-semibold text-white shadow-lg shadow-primary/20",
    busy && "opacity-60",
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {showsPhoto ? (
        <button
          type="button"
          onClick={() => setViewing(true)}
          aria-label={t("employees.photo.view")}
          title={t("employees.photo.view")}
          className={cn(tile, "cursor-zoom-in transition-transform hover:scale-[1.02] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={name || t("employees.photo.alt")} onError={() => setFailed(src)} className="size-full object-cover" />
        </button>
      ) : (
        <div className={tile}>{initials || <Camera className="size-8" />}</div>
      )}

      {canEdit && (
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="sr-only" />
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              <Camera className="size-3.5" />
              {src ? t("employees.photo.change") : t("employees.photo.upload")}
            </Button>
            {src && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onRemove()}>
                <Trash2 className="size-3.5" />
                {t("common.action.remove")}
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">{t("employees.photo.formats")}</p>
        </>
      )}
      {error && <p className="text-center text-xs text-destructive">{error}</p>}

      <PhotoCropDialog imageUrl={pickedUrl} open={pickedUrl !== null} onOpenChange={closeCropDialog} onCropped={handleCropped} />
      {showsPhoto && (
        <PhotoViewerDialog
          open={viewing}
          onOpenChange={setViewing}
          name={name}
          src={src}
          busy={busy}
          onChange={canEdit ? () => input.current?.click() : undefined}
          onRemove={canEdit ? onRemove : undefined}
        />
      )}
    </div>
  );
}
