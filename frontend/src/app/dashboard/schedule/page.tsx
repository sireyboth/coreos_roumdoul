import { redirect } from "next/navigation";

// The roster now lives on the Employees page (Roster tab). This keeps old
// links and bookmarks working. Redirected on the server, so the Employees
// page loads with ?tab=roster already in the address and opens that tab.
export default function ScheduleRedirect() {
  redirect("/dashboard/employees?tab=roster");
}
