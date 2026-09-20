import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Aeonik is a paid commercial font with no free/Google Fonts distribution.
// Plus Jakarta Sans is the closest free match to its geometric, rounded
// letterforms. Swap this for next/font/local pointing at real Aeonik files
// if a license is purchased later — nothing else needs to change.
const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Business OS",
  description: "Business Operating System for Cambodian businesses",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // Makes "Add to Home Screen" on iOS open without Safari's browser
    // chrome — the same fullscreen, app-like presentation Android gets
    // from the manifest above.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Business OS",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
