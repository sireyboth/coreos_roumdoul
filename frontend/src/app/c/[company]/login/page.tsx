import { LoginForm } from "@/components/login-form";

/**
 * An admin's shareable sign-in link — https://.../c/acme-x9k2/login — with the
 * company baked into the path instead of a `?company=` query string. That
 * matters specifically for "Add to Home Screen": this app is a PWA
 * (src/app/manifest.ts) with a fixed start_url, so once a page is installed
 * as a home-screen icon, later taps launch at that start_url and drop
 * whatever query string the page had when it was added. A path segment is
 * part of the address itself, so it survives being turned into a shortcut.
 */
export default async function CompanyLoginPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  return <LoginForm linkedCompany={decodeURIComponent(company).trim().toLowerCase()} />;
}
