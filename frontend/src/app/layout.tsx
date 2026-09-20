import type { Metadata } from "next";
import { Geist_Mono, Inter, Noto_Sans_Khmer } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Inter for English text and numbers (built for data-heavy screens, with
// digits that line up in columns), Noto Sans Khmer for Khmer text — the
// browser picks per character, so mixed English/Khmer lines stay consistent.
const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const khmer = Noto_Sans_Khmer({
  variable: "--font-khmer",
  subsets: ["khmer"],
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
      className={`${sans.variable} ${khmer.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
