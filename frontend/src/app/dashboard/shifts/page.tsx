"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Shifts became Work Schedules. This keeps old links and bookmarks working.
export default function ShiftsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/work-schedules");
  }, [router]);

  return null;
}
