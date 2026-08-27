"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {toast} from "sonner"
import { CheckCircle2, ArrowLeft } from "lucide-react"
import { AuthSplitLayout } from "./auth-split-layout"

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to send reset email")
      }

      setIsSubmitted(true)
      toast.success("Password reset link has been sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reset email");
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <AuthSplitLayout>
        <div className="space-y-8 text-center bg-background rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Check your email</h1>
            <p className="text-muted-foreground leading-relaxed">
              We&apos;ve sent a password reset link to <span className="font-medium text-foreground">{email}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              The link will expire in 24 hours. If you don&apos;t see the email, check your spam folder.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => (window.location.href = "/login")}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            >
              Back to Sign In
            </Button>

            <Button
              onClick={() => {
                setIsSubmitted(false)
                setEmail("")
              }}
              variant="outline"
              className="w-full h-12 border-border/50 hover:bg-secondary/50"
            >
              Resend Email
            </Button>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-8 bg-background rounded-lg p-8 ">
        {/* Back Button */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Forgot Password?</h1>
          <p className="text-muted-foreground leading-relaxed">No worries, we&apos;ll send you reset instructions to your email.</p>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
              required
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
