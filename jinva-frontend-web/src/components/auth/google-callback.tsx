"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { dashboardPathForFrontendRole } from "@/lib/auth"
import { AuthSplitLayout } from "./auth-split-layout"

// G4/G7: the backend redirects here with either no `error` param (success)
// or exactly one of these two codes (api-contract.md). Any other/unknown
// value is treated defensively the same as "oauth_failed".
const ERROR_COPY: Record<string, string> = {
  access_denied: "Sign-in with Google was cancelled.",
  oauth_failed: "Something went wrong signing you in with Google. Please try again.",
}

function ErrorState({ error }: { error: string }) {
  const toastedRef = useRef(false)
  const message = ERROR_COPY[error] ?? ERROR_COPY.oauth_failed

  useEffect(() => {
    if (toastedRef.current) return
    toastedRef.current = true
    toast.error(message)
  }, [message])

  return (
    <AuthSplitLayout>
      <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Sign-in interrupted</h1>
          <p className="text-muted-foreground leading-relaxed">{message}</p>
        </div>

        <Button
          onClick={() => (window.location.href = "/login")}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
        >
          Back to Sign In
        </Button>
      </div>
    </AuthSplitLayout>
  )
}

/**
 * The success/pending path — only mounted when there's no `error` param, so
 * it's the only place that touches `AuthProvider`/`fetchUser()`. Kept
 * separate from `ErrorState` so a denied/cancelled consent (where the
 * backend never set any session cookies to begin with) never triggers a
 * `GET /users/me` call at all: that call would 401, and lib/api.ts's
 * existing apiFetch already hard-redirects to plain `/login` on an
 * unrecoverable 401 — which would blow away this page's error message
 * before the user ever saw it if we let it run unconditionally.
 */
function PendingState() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (user) {
      router.replace(dashboardPathForFrontendRole(user.role))
      return
    }

    // AuthProvider's own fetchUser() failure path only auto-redirects to
    // /login for /dashboard/* paths — this route lives outside /dashboard,
    // so if we get here with isLoading=false and no user, the session
    // genuinely never got established. Send the user back to login instead
    // of leaving them stuck on the spinner below.
    router.replace("/login?error=oauth_failed")
  }, [isLoading, user, router])

  return (
    <AuthSplitLayout>
      <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Signing you in&hellip;</h1>
          <p className="text-muted-foreground">Please wait while we finish setting up your session.</p>
        </div>
      </div>
    </AuthSplitLayout>
  )
}

/**
 * G7: frontend landing route for the Google OAuth callback.
 *
 * By the time the browser lands here on success, the backend has already
 * set the httpOnly `refresh_token` and `jinva_session` cookies (G3/G4) —
 * this does NOT implement any custom session-establishing logic. It simply
 * lets the existing `AuthProvider` / `fetchUser()` flow run as it normally
 * would on any page load (GET /users/me -> 401 -> silent refresh, see
 * src/lib/api.ts), then redirects into the resolved user's dashboard using
 * the same role -> dashboard-home mapping the regular login form uses
 * (lib/auth.ts's dashboardPathForRole / dashboardPathForFrontendRole).
 *
 * AuthProvider is otherwise only mounted under src/app/dashboard/layout.tsx
 * — this route lives outside /dashboard, so it needs its own instance here
 * to get `fetchUser()` running at all.
 */
export function GoogleCallback() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  if (error) {
    return <ErrorState error={error} />
  }

  return (
    // forceFresh: this route exists only to bootstrap a brand-new session,
    // so the initial fetch must skip the sessionStorage cache entirely
    // rather than risk serving a previous person's cached user on a
    // shared/kiosk browser (security-report.md's shared-computer finding).
    <AuthProvider forceFresh>
      <PendingState />
    </AuthProvider>
  )
}
