import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Business OS",
    short_name: "Business OS",
    description: "Business Operating System for Cambodian businesses",
    // Opens straight to the instant QR scan page — this is the point of
    // teaching employees to "Add to Home Screen" for this shortcut.
    start_url: "/dashboard/scan",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
