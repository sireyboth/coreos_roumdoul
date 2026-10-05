import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` only: lets a phone open the dev server through a Cloudflare
  // tunnel (needed to test push on mobile). Without it the page loads but
  // its scripts are blocked, so nothing on it works.
  allowedDevOrigins: ["*.trycloudflare.com"],
  async headers() {
    return [
      {
        // The push service worker: always fetch the latest, never a cached copy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
