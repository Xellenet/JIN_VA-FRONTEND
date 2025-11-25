"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthSplitLayout } from "./auth-split-layout"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    gender: "",
    role: "",
  })

  const validatePassword = (password: string): boolean => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long")
      return false
    }

    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    if (!hasLetter || !hasNumber || !hasSymbol) {
      toast.error("Password must contain a mix of letters, numbers, and symbols")
      return false
    }

    return true
  }

  const validatePhone = (phone: string): boolean => {
    // Format: XXX-XXX-XXXX
    const phoneRegex = /^\d{3}-\d{3}-\d{4}$/
    if (!phoneRegex.test(phone)) {
      toast.error("Phone number must be in the format XXX-XXX-XXXX")
      return false
    }
    return true
  }

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "")

    // Format as XXX-XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
    } else {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setFormData({ ...formData, phoneNumber: formatted })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePassword(formData.password)) {
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (!validatePhone(formData.phoneNumber)) {
      return
    }

    if (!formData.gender || !["MALE", "FEMALE", "OTHER"].includes(formData.gender)) {
      toast.error("Gender must be either MALE, FEMALE, or OTHER")
      return
    }

    if (!formData.role || !["CUSTOMER", "STYLIST", "ADMIN"].includes(formData.role)) {
      toast.error("Role must be either CUSTOMER, STYLIST, or ADMIN")
      return
    }

    setIsLoading(true)

    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        username: formData.username,
        firstname: formData.firstname,
        lastname: formData.lastname,
        phoneNumber: formData.phoneNumber,
        gender: formData.gender,
        role: formData.role,
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Registration failed")
      }

      toast.success("Please check your email to verify your account.")

      window.location.href = "/verify-email"
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialSignup = async (provider: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/oauth/${provider}`)
      const data = await response.json()

      window.location.href = data.authUrl
    } catch (error) {
      toast.error("Failed to initiate social signup")
      setIsLoading(false)
    }
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-8 bg-white md:rounded-lg md:p-8 md:shadow-sm p-4 w-full md:w-auto">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Create Account</h1>
          <p className="text-gray-600">
            {"Already have an account? "}
            <Link href="/login" className="text-gray-900 underline hover:text-gray-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstname" className="text-sm text-gray-600">
                First Name
              </Label>
              <Input
                id="firstname"
                type="text"
                placeholder="John"
                value={formData.firstname}
                onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname" className="text-sm text-gray-600">
                Last Name
              </Label>
              <Input
                id="lastname"
                type="text"
                placeholder="Doe"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm text-gray-600">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="johndoe"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-gray-600">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="example@gmail.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="text-sm text-gray-600">
              Phone Number
            </Label>
            <Input
              id="phoneNumber"
              type="text"
              placeholder="123-456-7890"
              value={formData.phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
              required
              disabled={isLoading}
              maxLength={12}
            />
            <p className="text-xs text-gray-500">Format: XXX-XXX-XXXX</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-sm text-gray-600">
                Gender
              </Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                disabled={isLoading}
                required
              >
                <SelectTrigger className="h-10 bg-white border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm text-gray-600">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={isLoading}
                required
              >
                <SelectTrigger className="h-10 bg-white border-gray-200 text-gray-900">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="STYLIST">Stylist</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-gray-600">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-10 pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
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
            <p className="text-xs text-gray-500">At least 8 characters with letters, numbers, and symbols</p>
          </div>

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
                className="h-10 pr-10 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
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

          <Button
            type="submit"
            className="w-full h-10 bg-[#1c4532] hover:bg-[#2d5a42] text-white font-medium text-base"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">OR</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => handleSocialSignup("google")}
              disabled={isLoading}
              className="w-full h-10 border border-gray-800 bg-gray-900 hover:bg-gray-800 font-normal text-gray-400 hover:text-gray-400 transition-colors"
            >
              <svg className="mr-3 h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <Button
              type="button"
              onClick={() => handleSocialSignup("facebook")}
              disabled={isLoading}
              className="w-full h-10 border border-gray-800 bg-gray-900 hover:bg-gray-800 font-normal text-gray-400 hover:text-gray-400 transition-colors"
            >
              <svg className="mr-3 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
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
