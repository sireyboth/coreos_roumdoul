"use client";

import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";

/**
 * A profile photo shown full-size — opened by tapping the small photo on
 * My profile or the employee page. Change / Remove appear only when the
 * caller passes them (your own photo, or HR with permission); everyone else
 * just looks.
 *
 * It never uploads itself: "Change" closes the viewer and hands back to the
 * caller, which opens its own file picker → crop dialog as before.
 */
export function PhotoViewerDialog({
  open,
  onOpenChange,
  name,
  subtitle,
  src,
  busy,
  onChange,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** A short line under the name, e.g. the employee code. */
  subtitle?: string | null;
  /** Fully resolved image URL (signed link or local preview). */
  src: string;
  busy?: boolean;
  onChange?: () => void;
  onRemove?: () => void | Promise<void>;
}) {
  const t = useT();
  const hasActions = Boolean(onChange || onRemove);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
          {/* Screen readers need a description; it stays visible only when there is one to show. */}
          <DialogDescription className={subtitle ? undefined : "sr-only"}>{subtitle || t("employees.photo.alt")}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={name || t("employees.photo.alt")} className="mx-auto max-h-[70vh] w-full object-contain" />
        </div>

        {hasActions && (
          <DialogFooter>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                className="text-destructive hover:text-destructive sm:mr-auto"
                onClick={async () => {
                  await onRemove();
                  onOpenChange(false);
                }}
              >
                <Trash2 className="size-4" />
                {t("common.action.remove")}
              </Button>
            )}
            {onChange && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  onOpenChange(false);
                  onChange();
                }}
              >
                <Camera className="size-4" />
                {t("employees.photo.change")}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
