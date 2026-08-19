"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"

const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  artisan: "/dashboard/artisan",
  user: "/dashboard/user",
}

/**
 * S2 defense-in-depth: client-side role check for a dashboard route.
 *
 * middleware.ts already redirects on role mismatch using the auth-hint
 * cookie (see lib/auth.ts), but that hint is a frontend-set, non-sensitive
 * value — not a real security boundary. This component re-checks the
 * actual authenticated user (fetched from the backend via /users/me) and
 * redirects before rendering any children if the role still doesn't match,
 * narrowing the window where the wrong dashboard shell could ever paint.
 *
 * Real authorization for the underlying data always happens server-side via
 * the bearer JWT + role guards on each API call, regardless of this check.
 */
export function RoleGuard({ allow, children }: { allow: UserRole; children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) return // AuthProvider already handles the unauthenticated redirect
    if (user.role !== allow) {
      router.replace(ROLE_HOME[user.role])
    }
  }, [isLoading, user, allow, router])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (user && user.role !== allow) {
    return null
  }

  return <>{children}</>
}
