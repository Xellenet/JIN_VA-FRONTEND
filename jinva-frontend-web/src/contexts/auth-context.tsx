"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
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
    role: mapBackendRole(data.role),
    avatar: data.profilePicture ?? undefined,
    rating: artisanProfile?.averageRating,
    reviews: artisanProfile?.totalReviews,
  }
}

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

  const fetchUser = useCallback(async () => {
    if (!getAccessToken()) {
      setIsLoading(false)
      return
    }
    try {
      const data = await apiFetch<BackendUser>("/users/me")

      let artisanProfile: BackendArtisanProfile | undefined
      if (data.role === "ARTISAN") {
        try {
          artisanProfile = await apiFetch<BackendArtisanProfile>("/users/me/artisan-profile")
        } catch {
          // profile may not exist yet
        }
      }

      setUser(buildUser(data, artisanProfile))
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {
      // ignore errors during logout
    }
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    clearAuthTokens()
    setUser(null)
    router.push("/login")
    router.refresh()
  }, [router])

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
