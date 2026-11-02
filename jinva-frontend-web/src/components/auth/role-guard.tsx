"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"
import { isArtisanPreviewPath } from "@/lib/auth"

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
  const pathname = usePathname()
  // P1: "Preview as a client" (see isArtisanPreviewPath).
  const allowed = !user || user.role === allow || isArtisanPreviewPath(user.role, pathname)

  useEffect(() => {
    if (isLoading) return
    if (!user) return // AuthProvider already handles the unauthenticated redirect
    if (!allowed) {
      router.replace(ROLE_HOME[user.role])
    }
  }, [isLoading, user, allowed, router])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
