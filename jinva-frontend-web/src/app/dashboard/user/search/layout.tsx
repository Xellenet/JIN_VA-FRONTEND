import type { Metadata } from "next"
import type { ReactNode } from "react"

// QA UI-13: this page's browser title (client pages can't export metadata).
export const metadata: Metadata = { title: { absolute: "Find Artisans · JinVa" } }

export default function FindArtisansLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
