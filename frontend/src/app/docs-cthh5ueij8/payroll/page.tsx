import type { Metadata } from "next";
import { PayrollDocs } from "@/components/docs/payroll-docs";

// The tab title stays English: metadata is rendered on the server, which can't see the device's language.
// The page itself is a client component (components/docs/payroll-docs.tsx) so its text follows that language.
export const metadata: Metadata = {
  title: "Payroll — Business OS Docs",
  robots: { index: false, follow: false },
};

export default function PayrollDocsPage() {
  return <PayrollDocs />;
}
