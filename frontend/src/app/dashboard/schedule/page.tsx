"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The roster now lives on the Employees page (Roster tab). This keeps old
// links and bookmarks working.
export default function ScheduleRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/employees?tab=roster");
  }, [router]);

  return null;
}
