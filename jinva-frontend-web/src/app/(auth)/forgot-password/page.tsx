import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Get a code to set a new JinVa password",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
