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
        <div className="space-y-8 text-center bg-white rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#1c4532]/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#1c4532]" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Check your email</h1>
            <p className="text-gray-600 leading-relaxed">
              We've sent a password reset link to <span className="font-medium text-gray-900">{email}</span>
            </p>
            <p className="text-sm text-gray-500">
              The link will expire in 24 hours. If you don't see the email, check your spam folder.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => (window.location.href = "/login")}
              className="w-full h-12 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
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
      <div className="space-y-8 bg-white rounded-lg p-8 ">
        {/* Back Button */}
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Forgot Password?</h1>
          <p className="text-gray-600 leading-relaxed">No worries, we'll send you reset instructions to your email.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-gray-600">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
              required
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-10 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </div>
    </AuthSplitLayout>
  )
}
