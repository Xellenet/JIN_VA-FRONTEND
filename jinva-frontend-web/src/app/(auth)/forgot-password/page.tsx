import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forgot Password - JinVa",
  description: "Reset your JinVa account password",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
