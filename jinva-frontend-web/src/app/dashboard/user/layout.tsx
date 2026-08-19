import type { ReactNode } from "react"
import { RoleGuard } from "@/components/auth/role-guard"

export default function UserDashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard allow="user">{children}</RoleGuard>
}
