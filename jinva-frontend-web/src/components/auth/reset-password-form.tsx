"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { FormAnnouncer, FormField } from "@/components/forms/form-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { AUTH_COPY } from "@/lib/auth-v2-errors"
import { AuthSplitLayout } from "./auth-split-layout"
import {
  AUTH_FIELD_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthHeading,
  AuthNotice,
  PasswordInput,
  SubmitButton,
  SuccessCheck,
} from "./auth-ui"
import { PASSWORD_MESSAGES, validateNewPassword } from "./signup-fields"
import { NEW_PASSWORD_INPUT_PROPS, PasswordChecklist, SuggestPasswordButton } from "./password-checklist"

/*
 * /reset-password?token= — the link-based reset, kept for links that were
 * already emailed before auth v2 (new requests use a code at
 * /forgot-password). Auth v2 look and one password field with the live
 * checklist; the old endpoint still wants `confirmNewPassword`, so the same
 * value is sent twice.
 */

export function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [password, setPassword] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const formErrorRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const v = useFormValidation<"password">({
    fields: ["password"],
    values: { password },
    validate: (_f, mode: ValidationMode) => validateNewPassword(password, mode === "submit"),
    labels: { password: "New password" },
  })

  useEffect(() => {
    if (formError) formErrorRef.current?.focus()
  }, [formError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!v.validateAll() || !token) return
    setIsLoading(true)
    try {
      // S6: the token travels as ?token=, and the body carries both fields.
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/reset-password?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: password, confirmNewPassword: password }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(" ") : String(data?.message ?? "")
        if (response.status === 400 && /password/i.test(message) && !/token/i.test(message)) {
          v.setServerError("password", PASSWORD_MESSAGES.rule)
          return
        }
        if (/token|expired|invalid/i.test(message)) {
          setLinkError("This link has expired or was already used.")
          return
        }
        setFormError(message || "We couldn't change your password. Try again.")
        return
      }
      setPassword("")
      setIsSuccess(true)
    } catch {
      setFormError(AUTH_COPY.network)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthSplitLayout>
        <div className="space-y-6 text-center" data-auth-step="none" role="status" aria-live="polite">
          <SuccessCheck />
          <AuthHeading align="center" title="Password changed" description={<p>Log in with your new password.</p>} />
          <Link href="/login" className={`${AUTH_PRIMARY_BUTTON_CLASS} inline-flex items-center justify-center`}>
            Go to log in
          </Link>
        </div>
      </AuthSplitLayout>
    )
  }

  if (!token || linkError) {
    return (
      <AuthSplitLayout>
        <div className="space-y-6" data-auth-step="none">
          <AuthHeading
            title="This reset link doesn't work"
            description={
              <p>
                {linkError ?? "The link is missing part of its address."} Ask for a 6-digit code instead; it only takes
                your email.
              </p>
            }
          />
          <Link href="/forgot-password" className={`${AUTH_PRIMARY_BUTTON_CLASS} inline-flex items-center justify-center`}>
            Get a code
          </Link>
          <p className="text-center text-sm">
            <Link href="/login" className={AUTH_LINK_CLASS}>
              Back to log in
            </Link>
          </p>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-5 min-[980px]:space-y-7" data-auth-step="none">
        <AuthHeading title="Choose a new password" description={<p>You&apos;ll use it to log in from now on.</p>} />
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading} className="space-y-4 min-[980px]:space-y-5">
          <FormAnnouncer message={v.announcement} />
          <div className="space-y-3">
            <FormField
              id="password"
              label="New password"
              error={v.errors.password}
              describedBy="password-rules"
              className={AUTH_FIELD_CLASS}
            >
              {(control) => (
                <PasswordInput
                  control={control}
                  value={password}
                  onChange={setPassword}
                  onBlur={() => v.handleBlur("password")}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  disabled={isLoading}
                  visible={showPassword}
                  onVisibleChange={setShowPassword}
                  extraProps={NEW_PASSWORD_INPUT_PROPS}
                />
              )}
            </FormField>
            <PasswordChecklist id="password-rules" password={password} />
            <SuggestPasswordButton
              onSuggest={(suggested) => {
                setPassword(suggested)
                setShowPassword(true)
              }}
              disabled={isLoading}
            />
          </div>
          {formError ? (
            <AuthNotice tone="error" role="alert" noticeRef={formErrorRef}>
              {formError}
            </AuthNotice>
          ) : null}
          <SubmitButton busy={isLoading} busyLabel="Saving your password…">
            Save new password
          </SubmitButton>
        </form>
        <p className="text-center text-sm">
          <Link href="/login" className={AUTH_LINK_CLASS}>
            Back to log in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  )
}
