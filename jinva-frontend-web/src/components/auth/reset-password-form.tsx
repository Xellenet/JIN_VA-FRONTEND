"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { AUTH_INPUT_CLASS, FormAnnouncer, FormField } from "@/components/forms/form-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { AuthSplitLayout } from "./auth-split-layout"
import {
  PASSWORD_HINT,
  PASSWORD_MESSAGES,
  validateNewPassword,
  validatePasswordConfirmation,
} from "./signup-fields"

/*
 * google-signup-prefill V1–V8 (design-spec §1, §6.3): the same new-password
 * rules and copy as /signup, inline under each field. A missing or bad reset
 * token is not about a field, so it stays a toast.
 */
type Field = "password" | "confirmPassword"

const FIELDS: readonly Field[] = ["password", "confirmPassword"]

const LABELS: Record<Field, string> = {
  password: "New password",
  confirmPassword: "Confirm password",
}

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })

  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const validateField = (field: Field, mode: ValidationMode): string | null => {
    const submit = mode === "submit"
    return field === "password"
      ? validateNewPassword(formData.password, submit)
      : validatePasswordConfirmation(formData.confirmPassword, formData.password, submit)
  }

  const v = useFormValidation<Field>({ fields: FIELDS, values: formData, validate: validateField, labels: LABELS })

  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing reset token")

    }
  }, [token, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!v.validateAll()) return

    if (!token) {
      toast.error("Invalid or missing reset token")
      return
    }

    setIsLoading(true)

    try {
      // Backend contract (S6): token travels as a ?token= query param, and the
      // body must include both newPassword and confirmNewPassword.
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newPassword: formData.password,
            confirmNewPassword: formData.confirmPassword,
          }),
        },
      )

      const data = await response.json()

      if (!response.ok) {
        // V5: a 400 about the passwords lands on its field in the form's own
        // words (V6). "Invalid or expired token" is not a field error: toast.
        const message = Array.isArray(data?.message) ? data.message.join(" ") : String(data?.message ?? "")
        if (response.status === 400 && /do not match/i.test(message)) {
          v.setServerError("confirmPassword", PASSWORD_MESSAGES.mismatch)
          return
        }
        if (response.status === 400 && /password/i.test(message) && !/token/i.test(message)) {
          v.setServerError("password", PASSWORD_MESSAGES.rule)
          return
        }
        throw new Error(message || "Failed to reset password")
      }

      setIsSuccess(true)
      toast.success("Your password has been reset successfully.")

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset password")
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Password Reset!</h1>
            <p className="text-muted-foreground leading-relaxed">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
          </div>

          <Button
            onClick={() => (window.location.href = "/login")}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
          >
            Continue to Sign In
          </Button>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-8 bg-background rounded-lg p-8 shadow-sm">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-muted-foreground leading-relaxed">Enter your new password below to reset your account.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading} className="space-y-6">
          <FormAnnouncer message={v.announcement} />

          <FormField id="password" label="New password" hint={PASSWORD_HINT} error={v.errors.password}>
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onBlur={() => v.handleBlur("password")}
                  className={`${AUTH_INPUT_CLASS} h-12 pr-10`}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}
          </FormField>

          <FormField id="confirmPassword" label="Confirm password" error={v.errors.confirmPassword}>
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  onBlur={() => v.handleBlur("confirmPassword")}
                  className={`${AUTH_INPUT_CLASS} h-12 pr-10`}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            )}
          </FormField>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            disabled={isLoading || !token}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  )
}
