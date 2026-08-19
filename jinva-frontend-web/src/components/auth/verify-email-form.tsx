"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"
import { AuthSplitLayout } from "./auth-split-layout"

type VerificationState = "loading" | "success" | "error" | "no-token"

export function VerifyEmailForm() {
  const [state, setState] = useState<VerificationState>("loading")
  const [isResending, setIsResending] = useState(false)
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  // F1: the backend's resend-verification endpoint requires an email to
  // identify the account. Prefer it from the link's query string (wired up
  // in signup-form.tsx); fall back to asking the user for it.
  const [email, setEmail] = useState(searchParams.get("email") ?? "")

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

  const handleResendEmail = async () => {
    if (!email.trim()) {
      toast.error("Enter the email address you registered with.")
      return
    }

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
        throw new Error(data.message || "Failed to resend email")
      }

      toast.success("If that email is registered and unverified, a new verification link has been sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend email")
    } finally {
      setIsResending(false)
    }
  }

  const emailPrompt = !searchParams.get("email") && (
    <div className="space-y-2 text-left">
      <Label htmlFor="resend-email" className="text-sm text-gray-600">
        Your email address
      </Label>
      <Input
        id="resend-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isResending}
      />
    </div>
  )

  if (state === "loading") {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-white rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#1c4532]/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#1c4532] animate-spin" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Verifying your email...</h1>
            <p className="text-gray-600">Please wait while we verify your email address.</p>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  if (state === "success") {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-white rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#1c4532]/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#1c4532]" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Email Verified!</h1>
            <p className="text-gray-600 leading-relaxed">
              Your email has been successfully verified. You can now sign in to your account.
            </p>
          </div>

          <Button
            onClick={() => (window.location.href = "/login")}
            className="w-full h-12 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
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
        <div className="space-y-8 text-center bg-white rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Verification Failed</h1>
            <p className="text-gray-600 leading-relaxed">
              The verification link is invalid or has expired. Please request a new verification email.
            </p>
          </div>

          <div className="space-y-4">
            {emailPrompt}
            <Button
              onClick={handleResendEmail}
              disabled={isResending}
              className="w-full h-12 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
            >
              {isResending ? "Sending..." : "Resend Verification Email"}
            </Button>

            <Button
              onClick={() => (window.location.href = "/login")}
              variant="outline"
              className="w-full h-12 border-gray-200 hover:bg-gray-50"
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
      <div className="space-y-8 text-center bg-white rounded-lg p-8 shadow-sm">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#1c4532]/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-[#1c4532]" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Verify Your Email</h1>
          <p className="text-gray-600 leading-relaxed">
            We&apos;ve sent a verification email to your inbox. Please click the link in the email to verify your account.
          </p>
          <p className="text-sm text-gray-500">
            If you don&apos;t see the email, check your spam folder or request a new one.
          </p>
        </div>

        <div className="space-y-4">
          {emailPrompt}
          <Button
            onClick={handleResendEmail}
            disabled={isResending}
            className="w-full h-12 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
          >
            {isResending ? "Sending..." : "Resend Verification Email"}
          </Button>

          <Button
            onClick={() => (window.location.href = "/login")}
            variant="outline"
            className="w-full h-12 border-gray-200 hover:bg-gray-50"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    </AuthSplitLayout>
  )
}
