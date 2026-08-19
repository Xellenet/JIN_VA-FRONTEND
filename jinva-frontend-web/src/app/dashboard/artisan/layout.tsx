import type { ReactNode } from "react"
import { RoleGuard } from "@/components/auth/role-guard"

export default function ArtisanDashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RoleGuard allow="artisan">{children}</RoleGuard>
}
