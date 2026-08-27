import { Suspense } from "react"
import { SignupForm } from "@/components/auth/signup-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Account - JinVa",
  description: "Create your JinVa account",
}

export default function SignupPage() {
  // The form reads `?role=` (LP13), and `useSearchParams()` needs a Suspense
  // boundary on a statically-rendered route. Same shape as /login,
  // /reset-password, /verify-email and /auth/callback already use.
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
