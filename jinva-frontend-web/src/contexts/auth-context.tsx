"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { clearAuthTokens, mapBackendRole } from "@/lib/auth"
import { unregisterPushToken } from "@/lib/push-notifications"
import type { User } from "@/lib/types"

interface BackendUser {
  id: string
  email: string
  username: string
  firstname: string
  lastname: string
  phoneNumber?: string
  addresses?: Array<{ id: number; street: string; city: string; country: string; zipCode: string }>
  nationalId?: string
  gender: string
  role: "CUSTOMER" | "ARTISAN" | "ADMIN"
  profilePicture?: string
  accountVerified: boolean
}

interface BackendArtisanProfile {
  averageRating?: number
  totalReviews?: number
  experienceYears?: number
  businessName?: string
  bio?: string
  hourlyRate?: number
}

function buildUser(data: BackendUser, artisanProfile?: BackendArtisanProfile): User {
  return {
    id: data.id,
    name: `${data.firstname} ${data.lastname}`.trim(),
    email: data.email,
    phone: data.phoneNumber,
    address: data.addresses?.[0],
    nationalId: data.nationalId,
    role: mapBackendRole(data.role),
    avatar: data.profilePicture ?? `https://api.navii.dev/avatar/${encodeURIComponent(data.email)}?size=128&packs=command-center&style=neutral&mood=serious&tileBg=auto`,
    rating: artisanProfile?.averageRating != null ? Number(artisanProfile.averageRating) : undefined,
    reviews: artisanProfile?.totalReviews != null ? Number(artisanProfile.totalReviews) : undefined,
  }
}

// ---------------------------------------------------------------------------
// sessionStorage cache — survives page refreshes within the same tab.
// No TTL: data lives for the full browser session and is only invalidated
// on logout or an explicit refreshUser() call.
// ---------------------------------------------------------------------------
const CACHE_KEY = "jinva:user:v3"

function readCache(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function writeCache(user: User) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(user))
  } catch {}
}

function clearCache() {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(CACHE_KEY)
    sessionStorage.removeItem("jinva:user:v2") // clean up old key
  } catch {}
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface AuthContextValue {
  user: User | null
  isLoading: boolean
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  logout: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({
  children,
  forceFresh = false,
}: {
  children: ReactNode
  // When true, skip the sessionStorage cache on the initial mount fetch and
  // go straight to GET /users/me. Intended for routes that exist only to
  // bootstrap a brand-new session (e.g. /auth/callback) where serving a
  // stale cached user — possibly left behind by a previous person on a
  // shared/kiosk browser — is never desirable. See security-report.md's
  // "shared-computer risk" finding.
  forceFresh?: boolean
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Prevents React Strict Mode from firing two concurrent fetches on mount
  const fetchingRef = useRef(false)

  const fetchUser = useCallback(async (forceFresh = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // Serve from cache unless caller explicitly requests a fresh fetch.
      // NOTE: an absent in-memory access token (the normal state on every
      // full page reload / new tab, since S1 holds it in memory only) is
      // NOT treated as "logged out" here — we deliberately fall through to
      // the apiFetch call below instead of short-circuiting, so a 401 there
      // drives lib/api.ts's existing tryRefresh() path and silently
      // exchanges the still-valid httpOnly refresh cookie for a new access
      // token (requirements.md S1 AC #3). Only a failed fetch/refresh (the
      // catch block below) means there's genuinely no valid session.
      if (!forceFresh) {
        const cached = readCache()
        if (cached) {
          setUser(cached)
          setIsLoading(false)
          return
        }
      }

      const data = await apiFetch<BackendUser>("/users/me")

      let artisanProfile: BackendArtisanProfile | undefined
      if (data.role === "ARTISAN") {
        try {
          artisanProfile = await apiFetch<BackendArtisanProfile>("/users/me/artisan-profile")
        } catch {
          // profile may not exist yet — not fatal
        }
      }

      const built = buildUser(data, artisanProfile)
      setUser(built)
      writeCache(built)
    } catch {
      // Either there was no session to begin with, or the silent refresh
      // above also failed (expired/absent/revoked httpOnly refresh cookie)
      // — only now do we treat the user as logged out and bounce them back
      // to /login instead of leaving a half-rendered dashboard shell.
      setUser(null)
      clearAuthTokens()
      clearCache()
      const currentPath = typeof window !== "undefined" ? window.location.pathname : ""
      if (currentPath.startsWith("/dashboard")) {
        router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`)
      }
    } finally {
      fetchingRef.current = false
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchUser(forceFresh)
  }, [fetchUser, forceFresh])

  const logout = useCallback(async () => {
    // PN1: drop this device's push token BEFORE the session goes away, so the
    // POST still authenticates. Without this, a shared or public browser keeps
    // receiving the previous account's pushes after they log out. Never blocks
    // logout — unregisterPushToken swallows its own failures.
    await unregisterPushToken()
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {}
    clearAuthTokens()
    clearCache()
    setUser(null)
    router.push("/login")
    router.refresh()
  }, [router])

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refreshUser: () => fetchUser(true) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
