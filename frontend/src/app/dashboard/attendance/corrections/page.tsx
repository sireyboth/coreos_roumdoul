import { redirect } from "next/navigation";

// Correction requests are now a tab on the Attendance page; old links and bookmarks land there.
export default function AttendanceCorrectionsRedirect() {
  redirect("/dashboard/attendance?tab=corrections");
}
