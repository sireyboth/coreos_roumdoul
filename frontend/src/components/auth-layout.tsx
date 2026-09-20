import { Boxes } from "lucide-react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--primary), transparent 88%), transparent 45%), radial-gradient(circle at 80% 0%, color-mix(in oklch, var(--primary), transparent 92%), transparent 40%)",
        }}
      />
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Boxes className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Business OS</span>
        </div>
        {children}
      </div>
    </div>
  );
}
