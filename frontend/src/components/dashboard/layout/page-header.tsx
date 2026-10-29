"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "@/components/dashboard/nav";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const item = findNavItem(usePathname());
  const Icon = item?.icon;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-md shadow-primary/20",
              item.tone,
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
