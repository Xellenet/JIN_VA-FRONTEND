import { SignupForm } from "@/components/auth/signup-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Create Account - JinVa",
  description: "Create your JinVa account",
}

export default function SignupPage() {
  return <SignupForm />
}
