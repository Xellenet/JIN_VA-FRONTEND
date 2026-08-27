import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"

/**
 * LP11 — the old description ("Application for managing hard skills and
 * services") was what a search engine or a chat-app link preview showed for
 * every route in the app. Replaced with PRD §1's first sentence. The `template`
 * gives every page that sets its own `title` the "… · JinVa" suffix for free.
 */
export const metadata: Metadata = {
  title: {
    default: "JinVa — Find verified artisans",
    template: "%s · JinVa",
  },
  description:
    "JinVa connects clients with skilled, verified artisans across all trade categories — electrical, plumbing, carpentry, painting, cleaning, landscaping, beauty and more.",
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
