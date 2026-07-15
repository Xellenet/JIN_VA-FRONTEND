"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { clearAuthTokens, getAccessToken, mapBackendRole } from "@/lib/auth"
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Prevents React Strict Mode from firing two concurrent fetches on mount
  const fetchingRef = useRef(false)

  const fetchUser = useCallback(async (forceFresh = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      // No token → user is not authenticated; clear any stale cache and bail
      if (!getAccessToken()) {
        clearCache()
        setIsLoading(false)
        return
      }

      // Serve from cache unless caller explicitly requests a fresh fetch
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
      setUser(null)
      clearCache()
    } finally {
      fetchingRef.current = false
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
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
