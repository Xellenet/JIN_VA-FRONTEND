import { LoginForm } from "@/components/auth/login-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign In - JinVa",
  description: "Sign in to your JinVa account",
}

export default function LoginPage() {
  return <LoginForm />
}
