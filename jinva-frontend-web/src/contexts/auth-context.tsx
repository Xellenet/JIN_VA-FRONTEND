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
    rating: artisanProfile?.averageRating,
    reviews: artisanProfile?.totalReviews,
  }
}

// ---------------------------------------------------------------------------
// sessionStorage cache — survives page refresh within the same tab
// ---------------------------------------------------------------------------
const CACHE_KEY = "jinva:user:v2"
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface CacheEntry {
  user: User
  cachedAt: number
}

function readCache(): User | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return entry.user
  } catch {
    return null
  }
}

function writeCache(user: User) {
  if (typeof window === "undefined") return
  try {
    const entry: CacheEntry = { user, cachedAt: Date.now() }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {}
}

function clearCache() {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(CACHE_KEY)
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
      // Serve from cache unless caller explicitly requests a fresh fetch
      if (!forceFresh) {
        const cached = readCache()
        if (cached) {
          setUser(cached)
          setIsLoading(false)
          return
        }
      }

      if (!getAccessToken()) {
        setIsLoading(false)
        return
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
