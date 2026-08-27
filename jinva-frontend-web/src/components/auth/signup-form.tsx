"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthSplitLayout } from "./auth-split-layout"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * The only two roles a visitor may self-select. ADMIN is deliberately absent:
 * PRD §5.1 makes admin accounts seed-only and not publicly registerable, so
 * `?role=ADMIN` must be treated exactly like any other junk value — ignored.
 */
const PREFILLABLE_ROLES = ["CUSTOMER", "ARTISAN"] as const

/**
 * LP13 — normalise `?role=` into a starting value for the role selector.
 *
 * Anything that is not exactly CUSTOMER or ARTISAN — absent, misspelled,
 * lowercase, ADMIN, an injected value — returns "", which leaves the selector
 * empty and the existing validation untouched. ADMIN is excluded deliberately,
 * not by omission: PRD §5.1 makes admin accounts seed-only and not publicly
 * registerable, so `?role=ADMIN` has to be treated as junk like anything else.
 *
 * The param is a convenience only. The submitted payload is still what the
 * backend validates.
 */
function roleFromParam(requested: string | null): string {
  if (!requested) return ""
  return (PREFILLABLE_ROLES as readonly string[]).includes(requested) ? requested : ""
}

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /**
   * Read `?role=` during render as the initial value, rather than applying it
   * from an effect.
   *
   * This is deliberate and it is the pattern `verify-email-form.tsx` already
   * uses for `?email=`. An effect keyed on the `useSearchParams()` object does
   * work in dev but does NOT apply on `/signup` in a production build, because
   * the route is statically prerendered and the effect does not get a second
   * run once the real params are known. Reading it at render time has no such
   * timing dependency, and it is simpler.
   */
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    gender: "",
    role: roleFromParam(searchParams.get("role")),
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

    if (!formData.role || !["CUSTOMER", "ARTISAN"].includes(formData.role)) {
      toast.error("Role must be either CUSTOMER or ARTISAN")
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

      window.location.href = `/verify-email?email=${encodeURIComponent(formData.email)}`
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

  // G9: read whichever role is currently selected on the existing role
  // toggle at the moment "Continue with Google" is clicked, and pass it as
  // `?role=` on GET /auth/google — omit entirely if no role is selected yet
  // (backend defaults an unrecognized/missing role to CUSTOMER anyway). Per
  // api-contract.md this is a real full-page navigation (the route itself
  // 302s to Google), not a fetch-then-redirect.
  const handleGoogleSignup = () => {
    const role = formData.role.toLowerCase()
    const query = role ? `?role=${encodeURIComponent(role)}` : ""
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google${query}`
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-8 bg-background md:rounded-lg md:p-8  p-4 w-full md:w-auto">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Create Account</h1>
          <p className="text-muted-foreground">
            {"Already have an account? "}
            <Link href="/login" className="text-foreground underline hover:text-muted-foreground transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstname" className="text-sm text-muted-foreground">
                First Name
              </Label>
              <Input
                id="firstname"
                type="text"
                placeholder="John"
                value={formData.firstname}
                onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastname" className="text-sm text-muted-foreground">
                Last Name
              </Label>
              <Input
                id="lastname"
                type="text"
                placeholder="Doe"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username" className="text-sm text-muted-foreground">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="johndoe"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
              required
              disabled={isLoading}
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="text-sm text-muted-foreground">
              Phone Number
            </Label>
            <Input
              id="phoneNumber"
              type="text"
              placeholder="123-456-7890"
              value={formData.phoneNumber}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
              required
              disabled={isLoading}
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground">Format: XXX-XXX-XXXX</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-sm text-muted-foreground">
                Gender
              </Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                disabled={isLoading}
                required
              >
                <SelectTrigger className="h-10 bg-background border-input text-foreground">
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
              <Label htmlFor="role" className="text-sm text-muted-foreground">
                Role
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={isLoading}
                required
              >
                <SelectTrigger className="h-10 bg-background border-input text-foreground">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="ARTISAN">Artisan</SelectItem>
                  {/* <SelectItem value="ADMIN">Admin</SelectItem> */}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
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
            <p className="text-xs text-muted-foreground">At least 8 characters with letters, numbers, and symbols</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="h-10 pr-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">OR</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGoogleSignup}
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
              onClick={() => handleSocialSignup("facebook")}
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
