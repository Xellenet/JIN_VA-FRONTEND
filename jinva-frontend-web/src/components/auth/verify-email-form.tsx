"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"
import { AUTH_INPUT_CLASS, FormAnnouncer, FormField } from "@/components/forms/form-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { AuthSplitLayout } from "./auth-split-layout"
import { EMAIL_MESSAGES, PENDING_VERIFY_EMAIL_KEY, validateEmail } from "./signup-fields"

/*
 * google-signup-prefill V1–V8 (design-spec §1, §6.3): the resend prompt's
 * email is checked inline, like login's, instead of with a toast. The prompt
 * is only shown when the link carried no `?email=`.
 */
type Field = "email"

const FIELDS: readonly Field[] = ["email"]
const LABELS: Record<Field, string> = { email: "Your email address" }
const EMAIL_INPUT_ID = "resend-email"

type VerificationState = "loading" | "success" | "error" | "no-token"

export function VerifyEmailForm() {
  const [state, setState] = useState<VerificationState>("loading")
  const [isResending, setIsResending] = useState(false)
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  // F1: the backend's resend-verification endpoint requires an email to
  // identify the account. Sign-up leaves it in sessionStorage (QA SEC-16:
  // never in the URL); an older link may still carry `?email=`. Otherwise
  // ask the user for it.
  const linkEmail = searchParams.get("email")
  const [email, setEmail] = useState(linkEmail ?? "")
  const [askForEmail, setAskForEmail] = useState(!linkEmail)
  useEffect(() => {
    if (linkEmail) return
    try {
      const pending = sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY)
      if (pending) {
        setEmail(pending)
        setAskForEmail(false)
      }
    } catch {
      // Storage blocked: keep asking.
    }
  }, [linkEmail])

  const validateField = (_field: Field, mode: ValidationMode) =>
    askForEmail ? validateEmail(email, mode === "submit") : null
  const v = useFormValidation<Field>({
    fields: FIELDS,
    values: { email },
    validate: validateField,
    labels: LABELS,
    focusTarget: () => document.getElementById(EMAIL_INPUT_ID),
  })

  useEffect(() => {
    if (!token) {
      setState("no-token")
      return
    }

    verifyEmail(token)
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: verificationToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Verification failed")
      }

      setState("success")
      toast.success("Your email has been verified successfully.")
    } catch (error) {
      setState("error")
      toast.error(error instanceof Error ? error.message : "Verification failed")   
    }
  }

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.validateAll()) return

    setIsResending(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // V5: a 400 can only be about the email. On the field when the user
        // typed it; otherwise the link's own email was bad, which is a toast.
        if (response.status === 400 && askForEmail) {
          v.setServerError("email", EMAIL_MESSAGES.invalid)
          return
        }
        throw new Error(data.message || "Failed to resend email")
      }

      toast.success("If that email is registered and unverified, a new verification link has been sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend email")
    } finally {
      setIsResending(false)
    }
  }

  // The resend action is a real form, so Enter in the email field submits it
  // and the V treatment applies (noValidate, inline error, one live region).
  const resendForm = (
    <form onSubmit={handleResendEmail} noValidate aria-busy={isResending} className="space-y-4">
      <FormAnnouncer message={v.announcement} />
      {askForEmail && (
        <FormField id={EMAIL_INPUT_ID} label="Your email address" error={v.errors.email} className="text-left">
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              enterKeyHint="send"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => v.handleBlur("email")}
              className={AUTH_INPUT_CLASS}
              required
              disabled={isResending}
            />
          )}
        </FormField>
      )}
      <Button
        type="submit"
        disabled={isResending}
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
      >
        {isResending ? "Sending..." : "Resend Verification Email"}
      </Button>
    </form>
  )

  if (state === "loading") {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Verifying your email...</h1>
            <p className="text-muted-foreground">Please wait while we verify your email address.</p>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  if (state === "success") {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Email Verified!</h1>
            <p className="text-muted-foreground leading-relaxed">
              Your email has been successfully verified. You can now sign in to your account.
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

  if (state === "error") {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Verification Failed</h1>
            <p className="text-muted-foreground leading-relaxed">
              The verification link is invalid or has expired. Please request a new verification email.
            </p>
          </div>

          <div className="space-y-4">
            {resendForm}

            <Button
              onClick={() => (window.location.href = "/login")}
              variant="outline"
              className="w-full h-12 border-input hover:bg-accent"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  // No token state
  return (
    <AuthSplitLayout>
      <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Verify Your Email</h1>
          <p className="text-muted-foreground leading-relaxed">
            We&apos;ve sent a verification email to your inbox. Please click the link in the email to verify your account.
          </p>
          <p className="text-sm text-muted-foreground">
            If you don&apos;t see the email, check your spam folder or request a new one.
          </p>
        </div>

        <div className="space-y-4">
          {resendForm}

          <Button
            onClick={() => (window.location.href = "/login")}
            variant="outline"
            className="w-full h-12 border-input hover:bg-accent"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    </AuthSplitLayout>
  )
}
