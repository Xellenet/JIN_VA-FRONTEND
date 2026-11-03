import { Suspense } from "react"
import { VerifyEmailForm } from "@/components/auth/verify-email-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm the email for your JinVa account",
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  )
}
