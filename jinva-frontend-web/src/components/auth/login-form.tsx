"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { persistAuthTokens, dashboardPathForRole } from "@/lib/auth"
import { AuthSplitLayout } from "./auth-split-layout"

export function LoginForm() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  // G10: distinct state for "this account signs in with Google" — kept
  // separate from the generic invalid-credentials toast per api-contract.md.
  const [socialOnlyError, setSocialOnlyError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const handleResendVerification = async (email: string) => {
    setIsResending(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || "Failed to resend email")
      toast.success("Verification email has been resent.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend email")
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setUnverifiedEmail(null)
    setSocialOnlyError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        // S4: unverified accounts are rejected with a distinct 403 (see auth.service.ts).
        // Surface a specific message plus a resend path instead of a generic error.
        if (response.status === 403) {
          setUnverifiedEmail(formData.email)
          toast.error(data.message || "Please verify your email before logging in.")
          return
        }
        // G10: social-only accounts (no usable password) get a distinct 401
        // shape — check meta.error, not just status, so it never gets folded
        // into the generic invalid-credentials toast below.
        if (response.status === 401 && data?.meta?.error === "SocialOnlyAccountException") {
          setSocialOnlyError(
            data.message ||
              'This account signs in with Google. Continue with Google, or use "Forgot password" to set a password for this account.',
          )
          return
        }
        throw new Error(data.message || "Login failed")
      }

      // Login returns { access_token, expires_at, message, data: user } — the
      // refresh token is never in the body, it arrives as an httpOnly
      // Set-Cookie the browser stores automatically (credentials: "include").
      const role = data.data?.role

      persistAuthTokens(data.access_token)

      toast.success("You have been logged in successfully.")

      const redirectTarget = searchParams.get("redirect")
      const roleDashboard = dashboardPathForRole(role ?? "")
      const destination =
        redirectTarget?.startsWith("/") && !redirectTarget.startsWith("//")
          ? redirectTarget
          : roleDashboard

      globalThis.location.href = destination
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid credentials");
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/oauth/${provider}`)
      const data = await response.json()

      // Redirect to OAuth provider
      globalThis.location.href = data.authUrl
    } catch (error) {
      toast.error("Failed to initiate social login" + (error instanceof Error ? `: ${error.message}` : ""));
      setIsLoading(false)
    }
  }

  // G1/G8: unlike other providers, Google's flow is a real backend route
  // (`GET /auth/google`) that itself 302s straight to Google's consent
  // screen — per api-contract.md this must be a full-page navigation, not a
  // fetch-then-redirect. No `role` param from the login page (G9 only
  // applies on signup).
  const handleGoogleLogin = () => {
    globalThis.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-8 bg-background md:rounded-lg md:p-8 p-4 w-full md:w-auto md:border-0">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Sign In</h1>
          <p className="text-muted-foreground">
            {"Don't have an account? "}
            <Link href="/signup" className="text-foreground underline hover:text-muted-foreground transition-colors">
              Create now
            </Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-muted-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@gmail.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
              required
              disabled={isLoading}
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="@#*%"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-10 pr-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(!!checked)} className="shadow-md" />
              <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer font-normal">
                Remember me
              </Label>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm text-foreground underline hover:text-muted-foreground transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          {/* S4: unverified-account block — offer a resend path */}
          {unverifiedEmail && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
              <p>Please verify your email before logging in.</p>
              <button
                type="button"
                onClick={() => handleResendVerification(unverifiedEmail)}
                disabled={isResending}
                className="mt-1 font-medium underline underline-offset-2 hover:text-warning disabled:opacity-60"
              >
                {isResending ? "Resending..." : "Resend verification email"}
              </button>
            </div>
          )}

          {/* G10: social-only account — shown distinctly from the generic
              invalid-credentials toast. No embedded Google button here on
              purpose: the real "Continue with Google" button is already
              visible further down this same form, so this stays a message
              only rather than duplicating it. */}
          {socialOnlyError && (
            <div className="rounded-md border border-info/30 bg-info/10 p-3 text-sm text-foreground">
              <p>{socialOnlyError}</p>
            </div>
          )}

          {/* Sign In Button */}
          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">OR</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-10 border border-input bg-background hover:bg-accent font-normal text-foreground hover:text-accent-foreground transition-colors"
            >
              <svg className="mr-3 h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              onClick={() => handleSocialLogin("facebook")}
              disabled={isLoading}
              className="w-full h-10 border border-input bg-background hover:bg-accent font-normal text-foreground hover:text-accent-foreground transition-colors"
            >
              <svg className="mr-3 h-5 w-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </Button>
          </div>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
