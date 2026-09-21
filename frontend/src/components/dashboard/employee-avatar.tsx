"use client";

import { useState } from "react";
import { photoSrc } from "@/lib/api";
import { cn } from "@/lib/utils";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** The employee's photo, or their initials on a coloured tile when there is none (or it can't load). */
export function EmployeeAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const src = photoSrc(photoUrl);
  // Remember which link failed: a signed link can expire while the page is open.
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 text-xs font-semibold text-white",
        className,
      )}
    >
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(src)} className="size-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
