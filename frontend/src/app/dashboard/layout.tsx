"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoaderCard, LogoSpinner } from "@/components/ui/loader-card";
import { PageLoadGate } from "@/components/ui/page-load-gate";
import { AccountBanner } from "@/components/dashboard/layout/account-banner";
import { AiAssistant, AssistantLauncher } from "@/components/dashboard/layout/ai-assistant";
import { BirthdayCelebration } from "@/components/dashboard/employees/birthday-celebration";
import { HomeButton } from "@/components/dashboard/layout/home-button";
import { MobileTabBar } from "@/components/dashboard/layout/mobile-tab-bar";
import { NotificationBell } from "@/components/dashboard/layout/notification-bell";
import { PushPrompt } from "@/components/dashboard/layout/push-prompt";
import { Sidebar, SidebarContent } from "@/components/dashboard/layout/sidebar";
import { findNavItem } from "@/components/dashboard/layout/nav";
import { GlassBackdrop, headerButtons, useGlass } from "@/components/glass";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { companyStatusLabel } from "@/components/dashboard/layout/account-banner";
import { pageLabel, useLang, useT } from "@/lib/i18n";
import { MeProvider, useMe } from "@/contexts/me-context";
import { markAppSessionStarted } from "@/lib/app-launch";
import { cn } from "@/lib/utils";

/**
 * The phone header: a glass bar stuck to the top of the scrolling area, so
 * the page slides under it. Clears the notch / punch-hole camera
 * (safe-area-inset-top). Every button in it is a 48px plain icon (headerButtons).
 */
function MobileHeader({ onToggle, open }: { onToggle: () => void; open: boolean }) {
  const { me } = useMe();
  const pathname = usePathname();
  const t = useT();

  return (
    <header
      className={cn(
        "glass-surface sticky top-0 z-30 flex items-center justify-between gap-2 pt-[max(0.25rem,env(safe-area-inset-top))] pr-[max(0.25rem,env(safe-area-inset-right))] pb-1 pl-[max(1rem,env(safe-area-inset-left))] text-ink md:hidden",
        headerButtons,
      )}
    >
      {pathname === "/dashboard/home" ? (
        <p className="truncate text-[15px] font-semibold">{me?.company?.name ?? "Business OS"}</p>
      ) : (
        // Every other page gets an obvious way back to the phone home screen.
        <HomeButton />
      )}
      <div className="flex shrink-0 items-center">
        <AssistantLauncher />
        <NotificationBell />
        <ThemeToggle />
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          aria-label={t("app.shell.toggleMenu")}
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
  const lang = useLang();
  const t = useT();
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
        <span className="font-semibold">{pageLabel(lang, item?.href ?? "/dashboard", item?.label ?? "Dashboard")}</span>
      </div>
      <div className="flex items-center gap-2">
        {me?.company?.status && (
          <span className="mr-2 hidden items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium capitalize text-success lg:inline-flex">
            <span className="size-1.5 rounded-full bg-success" />
            {companyStatusLabel(lang, me.company.status)}
          </span>
        )}
        <LanguageToggle />
        <NotificationBell />
        <ThemeToggle />
        <Link
          href="/dashboard/profile"
          aria-label={t("app.shell.profile")}
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
  const t = useT();
  const isGlass = useGlass();
  // Any page but scan means the app is up; the scan page itself decides
  // whether it was opened by an older home-screen icon (lib/app-launch.ts).
  useEffect(() => {
    if (pathname !== "/dashboard/scan") markAppSessionStarted();
  }, [pathname]);

  if (loading) {
    // Opening on the glass home screen: draw the same backdrop and the same
    // centred card the page's own loader uses (PageLoadGate), so the handover
    // from this screen to the page is seamless.
    if (isGlass) {
      return (
        <div role="status" aria-live="polite" className="flex h-dvh items-center justify-center p-6">
          <GlassBackdrop />
          <LoaderCard label={t("common.message.loading")} glass />
        </div>
      );
    }

    return (
      // First load: the big logo loader in the middle of the screen.
      <div role="status" aria-live="polite" className="flex h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <LogoSpinner className="size-28 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-90 duration-500" />
        <p className="text-sm font-medium text-muted-foreground motion-safe:animate-pulse">{t("app.shell.loadingWorkspace")}</p>
      </div>
    );
  }

  // The instant-scan page is full-screen camera — no sidebar/header/tab bar.
  if (pathname === "/dashboard/scan") {
    return (
      <div className="h-screen overflow-hidden bg-background">
        {children}
        <PushPrompt />
      </div>
    );
  }

  return (
    // On the glass home screen the shell goes see-through so the backdrop shows.
    <div className={cn("flex h-screen overflow-hidden", !isGlass && "bg-background")}>
      {isGlass && <GlassBackdrop />}
      <div className="hidden h-full md:block">
        <Sidebar />
      </div>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="relative flex-1 overflow-y-auto">
          <MobileHeader onToggle={() => setMobileOpen((v) => !v)} open={mobileOpen} />
          <div
            hidden={isGlass}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-72"
            style={{
              backgroundImage:
                "radial-gradient(60% 100% at 15% 0%, color-mix(in oklch, var(--primary), transparent 90%), transparent 70%), radial-gradient(45% 80% at 90% 0%, color-mix(in oklch, oklch(0.7 0.15 200), transparent 92%), transparent 70%)",
            }}
          />
          {/* Bottom padding on phones keeps the last content clear of the floating tab bar. */}
          <div className="relative pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="px-4 pt-4 empty:hidden sm:px-6 lg:px-8">
              <AccountBanner />
            </div>
            <PageLoadGate>
              {/* Page entrance: re-keyed on the path, so each new page fades and rises into place
                  (opacity/transform only). Query changes like ?tab= don't replay it, and the home
                  screen staggers its own blocks instead. Sits inside the gate so the gate's
                  fixed loader isn't caught by the transform. */}
              <div key={pathname} className={cn(!isGlass && "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300 ease-out")}>
                {children}
              </div>
            </PageLoadGate>
          </div>
        </main>
      </div>
      <PushPrompt />
      <BirthdayCelebration />
      <AiAssistant />
      <MobileTabBar />
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
