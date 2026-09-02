import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * REQUIRED ENVIRONMENT VARIABLE — `NEXT_PUBLIC_SITE_URL`
 *
 * The public origin this app is served from, including the scheme and with no
 * trailing slash (e.g. `https://jinva.com`). It must be set in every deployed
 * environment. Documented here at the point of use, the same way the backend's
 * S3 provider documents its own `AWS_S3_*` variables.
 *
 * Why it matters: OpenGraph and Twitter image URLs have to be absolute for a
 * crawler or chat app to fetch them. Next.js resolves the relative
 * `/opengraph-image` route produced by `src/app/opengraph-image.tsx` against
 * `metadataBase`, and when `metadataBase` is unset it silently falls back to
 * `http://localhost:<whichever port ran the build>` (and warns once per page at
 * build time). Every link preview in production then points at the machine that
 * built the bundle, so the card never renders for anybody else.
 *
 * The fallback below exists only so local development keeps working before the
 * variable is set anywhere. It is not a production default — 4200 is this
 * repo's `next dev` port.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:4200"

/**
 * LP11 — the old description ("Application for managing hard skills and
 * services") was what a search engine or a chat-app link preview showed for
 * every route in the app. Replaced with PRD §1's first sentence. The `template`
 * gives every page that sets its own `title` the "… · JinVa" suffix for free.
 *
 * `openGraph` and `twitter` live HERE, at the root, and deliberately nowhere
 * else. Next.js does not deep-merge either field across segments: a child that
 * declares `openGraph` REPLACES the parent's resolved object, image and all.
 * `app/opengraph-image.tsx` is a root-segment file convention, so any page
 * declaring its own `openGraph` without an `images` key drops the card image —
 * which is exactly how `/` ended up as the only page in the app with no
 * `og:image`. Keeping both fields root-only means every route inherits the
 * generated card, and `og:title`/`og:description` fall back to each page's own
 * `title`/`description`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "JinVa — Find verified artisans",
    template: "%s · JinVa",
  },
  description:
    "JinVa connects clients with skilled, verified artisans across all trade categories — electrical, plumbing, carpentry, painting, cleaning, landscaping, beauty and more.",
  openGraph: {
    type: "website",
    siteName: "JinVa",
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
