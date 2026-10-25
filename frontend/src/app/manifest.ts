import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Business OS",
    short_name: "Business OS",
    description: "Business Operating System for Cambodian businesses",
    // Opens on the phone Home page; its Scan button is one tap away.
    // Previously the icon opened the camera straight away:
    // start_url: "/dashboard/scan",
    start_url: "/dashboard/home",
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
