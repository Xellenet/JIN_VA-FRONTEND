import { CompleteSignupForm } from "@/components/auth/complete-signup-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Complete your account",
  description: "Finish creating your JinVa account",
}

export default function CompleteSignupPage() {
  return <CompleteSignupForm />
}
