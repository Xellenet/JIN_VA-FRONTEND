"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { AuthSplitLayout } from "./auth-split-layout"

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

  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing reset token")

    }
  }, [token, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match")

      return
    }

    if (!token) {
      toast.error("Invalid or missing reset token")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to reset password")
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
        <div className="space-y-8 text-center bg-white rounded-lg p-8 shadow-sm">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-[#1c4532]/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#1c4532]" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Password Reset!</h1>
            <p className="text-gray-600 leading-relaxed">
              Your password has been successfully reset. You can now sign in with your new password.
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

  return (
    <AuthSplitLayout>
      <div className="space-y-8 bg-white rounded-lg p-8 shadow-sm">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Reset Password</h1>
          <p className="text-gray-600 leading-relaxed">Enter your new password below to reset your account.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-gray-600">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-12 pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm text-gray-600">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="h-12 pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
            disabled={isLoading || !token}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  )
}
