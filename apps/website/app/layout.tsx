import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// No global CSS: each page imports its own stylesheet (styles/tw/<page>.css),
// exactly like the live site where every page links its own CSS.

export const metadata: Metadata = {
  title: { default: "505th Expeditionary Force", template: "%s" },
  description: "505th Expeditionary Force — a UNSC/Halo Arma 3 military simulation unit.",
  icons: {
    icon: [
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/images/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Same Google Fonts as the live site. Kept as <link> so existing CSS font-family names match exactly. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
