"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red — use for anything that deletes or can't be undone. */
  destructive?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * An in-app replacement for the browser's window.confirm():
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete this?", destructive: true }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (result: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  function settle(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  const options = pending?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              {options?.destructive && (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-4.5" />
                </div>
              )}
              <div className="min-w-0">
                <DialogTitle>{options?.title}</DialogTitle>
                {options?.description && <DialogDescription className="mt-1.5">{options.description}</DialogDescription>}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button type="button" variant={options?.destructive ? "destructive" : "default"} onClick={() => settle(true)} autoFocus>
              {options?.confirmLabel ?? (options?.destructive ? "Delete" : "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used within a ConfirmProvider");
  return confirm;
}
