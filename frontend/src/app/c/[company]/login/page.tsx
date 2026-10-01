import { LoginForm } from "@/components/login-form";

/**
 * An admin's shareable sign-in link — https://.../c/acme-x9k2/login — with the
 * company baked into the path instead of a `?company=` query string, so it
 * survives becoming a home-screen shortcut. The path alone doesn't make the
 * shortcut reopen here, though — the sibling layout.tsx points this whole
 * /c/[company]/ subtree at its own manifest (manifest/route.ts) with its own
 * start_url, instead of the app's global one, which is what actually
 * controls where an installed icon relaunches.
 */
export default async function CompanyLoginPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  return <LoginForm linkedCompany={decodeURIComponent(company).trim().toLowerCase()} />;
}
