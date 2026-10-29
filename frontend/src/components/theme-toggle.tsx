"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useT();

  // Avoids a hydration mismatch: the server can't know the viewer's theme.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- runs once after mount, by design
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="outline" size="icon" disabled className="size-9" />;
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={t("app.shell.toggleTheme")}
    >
      <Sun className="size-4 scale-100 dark:scale-0" />
      <Moon className="absolute size-4 scale-0 dark:scale-100" />
    </Button>
  );
}
