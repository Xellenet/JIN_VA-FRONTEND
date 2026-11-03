import type { Metadata } from "next"
import type { ReactNode } from "react"

// This page's browser title (client pages can't export metadata).
export const metadata: Metadata = { title: { absolute: "Set up your business · JinVa" } }

export default function SetupLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
