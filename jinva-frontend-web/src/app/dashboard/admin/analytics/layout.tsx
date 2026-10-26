import type { Metadata } from "next"
import type { ReactNode } from "react"

// QA UI-13: this page's browser title (client pages can't export metadata).
export const metadata: Metadata = { title: { absolute: "Platform Analytics · JinVa" } }

export default function PlatformAnalyticsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
