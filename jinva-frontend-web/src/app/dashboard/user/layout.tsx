import type { Metadata } from "next"
import type { ReactNode } from "react"
import { RoleGuard } from "@/components/auth/role-guard"

// QA UI-13: the overview's browser title; each page under it sets its own.
export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · JinVa" } }

export default function UserDashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard allow="user">{children}</RoleGuard>
}
