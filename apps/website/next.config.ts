import type { NextConfig } from "next";

/**
 * Old site used `page.html` URLs. Every old link (Discord posts, bookmarks,
 * search results) is permanently redirected to the new clean URL.
 */
const OLD_PAGES = [
  "home",
  "about-505th",
  "about-54th-air-wing",
  "about-alpha-company",
  "about-corpsman",
  "about-stalker",
  "media-gallery",
  "media-videos",
  "resources-aar",
  "resources-discord-rules",
  "resources-field-lexicon",
  "resources-handbook",
  "resources-hospital-corps-handbook",
  "resources-keybinds",
  "resources-roster",
  "login",
  "profile",
  "boot",
  "admin",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Shared workspace packages are TypeScript source.
  transpilePackages: ["@505th/db"],
  // The original Command Terminal page is read from disk by app/terminal/route.ts.
  outputFileTracingIncludes: { "/terminal": ["./legacy/terminal.html"] },
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/admin", destination: "/terminal", permanent: true },
      ...OLD_PAGES.map((p) => ({ source: `/${p}.html`, destination: `/${p}`, permanent: true })),
    ];
  },
};

export default nextConfig;
