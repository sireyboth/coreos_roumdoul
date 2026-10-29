// The same colors as src/global.css, as plain values — for places that can't use Tailwind
// classes (navigation bars, status bar, icons' `color` prop). Change a color in BOTH files.
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

export const THEME = {
  light: {
    background: 'hsl(240 20% 98%)',
    foreground: 'hsl(243 30% 14%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(243 30% 14%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(243 30% 14%)',
    primary: 'hsl(243 75% 59%)',
    primaryForeground: 'hsl(0 0% 100%)',
    secondary: 'hsl(240 16% 94%)',
    secondaryForeground: 'hsl(243 25% 24%)',
    muted: 'hsl(240 16% 94%)',
    mutedForeground: 'hsl(243 9% 42%)',
    accent: 'hsl(243 60% 95%)',
    accentForeground: 'hsl(243 75% 45%)',
    destructive: 'hsl(4 75% 45%)',
    border: 'hsl(243 18% 88%)',
    input: 'hsl(243 18% 88%)',
    ring: 'hsl(243 75% 59%)',
    radius: '0.875rem',
  },
  dark: {
    background: 'hsl(243 20% 8%)',
    foreground: 'hsl(243 20% 94%)',
    card: 'hsl(243 18% 12%)',
    cardForeground: 'hsl(243 20% 94%)',
    popover: 'hsl(243 18% 12%)',
    popoverForeground: 'hsl(243 20% 94%)',
    primary: 'hsl(244 100% 76%)',
    primaryForeground: 'hsl(243 30% 10%)',
    secondary: 'hsl(243 14% 18%)',
    secondaryForeground: 'hsl(243 20% 94%)',
    muted: 'hsl(243 14% 18%)',
    mutedForeground: 'hsl(243 10% 68%)',
    accent: 'hsl(243 30% 22%)',
    accentForeground: 'hsl(244 100% 84%)',
    destructive: 'hsl(4 85% 70%)',
    border: 'hsl(243 14% 24%)',
    input: 'hsl(243 14% 24%)',
    ring: 'hsl(244 100% 76%)',
    radius: '0.875rem',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
