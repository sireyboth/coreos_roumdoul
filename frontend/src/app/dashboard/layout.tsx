"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { Sidebar, SidebarContent } from "@/components/dashboard/sidebar";
import { findNavItem } from "@/components/dashboard/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { MeProvider, useMe } from "@/contexts/me-context";

function MobileHeader({ onToggle, open }: { onToggle: () => void; open: boolean }) {
  const { me } = useMe();

  return (
    <header className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:hidden">
      <p className="text-sm font-semibold">{me?.company?.name ?? "Business OS"}</p>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <ThemeToggle />
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          aria-label="Toggle menu"
          className="relative"
        >
          <Menu
            className={`size-4 transition-all duration-200 ${
              open ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <X
            className={`absolute size-4 transition-all duration-200 ${
              open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            }`}
          />
        </Button>
      </div>
    </header>
  );
}

function TopBar() {
  const { me } = useMe();
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const initials = me?.user.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="hidden h-16 shrink-0 items-center justify-between border-b border-border bg-card/70 px-6 backdrop-blur-md md:flex lg:px-8">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{me?.company?.name ?? "Business OS"}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-semibold">{item?.label ?? "Dashboard"}</span>
      </div>
      <div className="flex items-center gap-2">
        {me?.company?.status && (
          <span className="mr-2 hidden items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium capitalize text-success lg:inline-flex">
            <span className="size-1.5 rounded-full bg-success" />
            {me.company.status}
          </span>
        )}
        <NotificationBell />
        <ThemeToggle />
        <Link
          href="/dashboard/profile"
          aria-label="Profile"
          className="ml-1 flex size-9 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-fuchsia-500 text-xs font-semibold text-white shadow-md shadow-primary/25 transition-transform hover:scale-105"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}

function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  // Close automatically whenever the user navigates to a new page.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-in-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 left-0 w-64 bg-sidebar shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { loading } = useMe();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Loading your workspace…
      </div>
    );
  }

  // The instant-scan page is meant to be bookmarked as a home-screen
  // shortcut and open straight to the camera — no sidebar/header chrome.
  if (pathname === "/dashboard/scan") {
    return <div className="h-screen overflow-hidden bg-background">{children}</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileHeader onToggle={() => setMobileOpen((v) => !v)} open={mobileOpen} />
        <TopBar />
        <main className="relative flex-1 overflow-y-auto">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72"
            style={{
              backgroundImage:
                "radial-gradient(60% 100% at 15% 0%, color-mix(in oklch, var(--primary), transparent 90%), transparent 70%), radial-gradient(45% 80% at 90% 0%, color-mix(in oklch, oklch(0.7 0.15 200), transparent 92%), transparent 70%)",
            }}
          />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MeProvider>
      <DashboardShell>{children}</DashboardShell>
    </MeProvider>
  );
}
