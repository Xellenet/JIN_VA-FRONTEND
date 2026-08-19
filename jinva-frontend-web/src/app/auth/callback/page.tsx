import { Suspense } from "react"
import { GoogleCallback } from "@/components/auth/google-callback"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Signing in - JinVa",
  description: "Completing your JinVa sign-in",
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <GoogleCallback />
    </Suspense>
  )
}
