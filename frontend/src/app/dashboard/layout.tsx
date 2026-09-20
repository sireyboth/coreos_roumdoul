"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { Sidebar, SidebarContent } from "@/components/dashboard/sidebar";
import { MeProvider, useMe } from "@/contexts/me-context";

function MobileHeader({ onToggle, open }: { onToggle: () => void; open: boolean }) {
  const { me } = useMe();

  return (
    <header className="flex items-center justify-between border-b border-border bg-background p-4 md:hidden">
      <p className="text-sm font-semibold">{me?.company?.name ?? "Business OS"}</p>
      <div className="flex items-center gap-2">
        <NotificationBell />
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
        className={`absolute inset-y-0 left-0 w-64 bg-sidebar shadow-lg transition-transform duration-300 ease-in-out ${
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
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileHeader onToggle={() => setMobileOpen((v) => !v)} open={mobileOpen} />
        <main className="flex-1 overflow-y-auto">{children}</main>
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
