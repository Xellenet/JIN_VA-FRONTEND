import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

const ACCESS_TOKEN_COOKIE = "jinva_access_token"

export default async function DashboardRouteLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value

  if (!accessToken) {
    redirect("/login")
  }

  return children
}
