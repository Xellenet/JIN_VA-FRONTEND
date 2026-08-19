import type { ReactNode } from "react"
import { RoleGuard } from "@/components/auth/role-guard"

export default function AdminDashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard allow="admin">{children}</RoleGuard>
}
