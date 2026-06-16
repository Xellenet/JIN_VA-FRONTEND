import type { ReactNode } from "react"
import { AuthProvider } from "@/contexts/auth-context"

export default function DashboardRouteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthProvider>{children}</AuthProvider>
}
