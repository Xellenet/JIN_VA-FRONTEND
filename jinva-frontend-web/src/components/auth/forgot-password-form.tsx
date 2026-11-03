"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AUTH_INPUT_CLASS, FormAnnouncer, FormField } from "@/components/forms/form-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { ApiError } from "@/lib/api"
import { dashboardPathForRole, persistAuthTokens } from "@/lib/auth"
import { forgotPassword, resetPasswordWithCode } from "@/lib/auth-v2-api"
import { AUTH_COPY, authErrorCopy, authErrorKind, readSession } from "@/lib/auth-v2-errors"
import { clearCachedUser } from "@/contexts/auth-context"
import { AuthSplitLayout } from "./auth-split-layout"
import {
  AUTH_FIELD_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthHeading,
  AuthIcon,
  AuthNotice,
  PasswordInput,
  StepIndicator,
  SubmitButton,
  SuccessCheck,
} from "./auth-ui"
import { CodeEntry, CodeStepError } from "./code-entry"
import { Turnstile, type TurnstileHandle } from "./turnstile"
import { NEW_PASSWORD_INPUT_PROPS, PasswordChecklist, SuggestPasswordButton } from "./password-checklist"
import { EMAIL_MESSAGES, PASSWORD_MESSAGES, validateEmail, validateNewPassword } from "./signup-fields"

/*
 * Auth v2 forgot password: email (invisible Turnstile) → the 6-digit code →
 * a new password (the live checklist, no confirm field) → signed in, with
 * every other device signed out.
 *
 * The code is only collected on step 2; it is checked together with the new
 * password by `POST /auth/password/reset` (there is no separate verify call),
 * so a refused code sends the person back to step 2 with the error there.
 *
 * Links already sent by the old flow keep working at /reset-password?token=.
 */

type Step = "email" | "code" | "password" | "done"
const STEPS = ["Email", "Code", "New password"] as const

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("email")
  const [direction, setDirection] = useState<"forward" | "back" | "none">("none")
  const [email, setEmail] = useState("")
  const [sentTo, setSentTo] = useState("")
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [home, setHome] = useState("/login")
  const turnstileRef = useRef<TurnstileHandle>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formErrorRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const emailV = useFormValidation<"email">({
    fields: ["email"],
    values: { email },
    validate: (_f, mode: ValidationMode) => validateEmail(email, mode === "submit"),
    labels: { email: "Email" },
  })
  const passwordV = useFormValidation<"password">({
    fields: ["password"],
    values: { password },
    validate: (_f, mode: ValidationMode) => validateNewPassword(password, mode === "submit"),
    labels: { password: "New password" },
  })

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (step !== "code") headingRef.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(() => {
    if (formError) formErrorRef.current?.focus()
  }, [formError])

  const go = (next: Step, dir: "forward" | "back") => {
    setDirection(dir)
    setFormError(null)
    setStep(next)
  }

  const send = async (address: string): Promise<string | null> => {
    let turnstileToken: string | undefined
    try {
      turnstileToken = await turnstileRef.current?.getToken()
    } catch {
      throw new CodeStepError(AUTH_COPY.turnstileUnavailable)
    }
    try {
      const { resendAvailableAt } = await forgotPassword({ email: address, turnstileToken })
      return resendAvailableAt
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && authErrorKind(error.status, error.code) === "other") {
        throw new CodeStepError(EMAIL_MESSAGES.invalid)
      }
      const kind = error instanceof ApiError ? authErrorKind(error.status, error.code) : "network"
      throw new CodeStepError(
        authErrorCopy(kind) ?? "We couldn't send a code. Try again.",
        error instanceof ApiError ? error.retryAfterSeconds : undefined,
      )
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!emailV.validateAll()) return
    setBusy(true)
    const address = email.trim()
    try {
      const next = await send(address)
      setResendAt(next)
      setSentTo(address)
      setCode("")
      setCodeError(null)
      go("code", "forward")
    } catch (error) {
      const message = error instanceof Error ? error.message : AUTH_COPY.network
      if (message === EMAIL_MESSAGES.invalid) emailV.setServerError("email", message)
      else setFormError(message)
    } finally {
      setBusy(false)
    }
  }

  // Step 2 only collects the code; it is checked with the new password.
  const handleCode = async (value: string) => {
    setCode(value)
    setCodeError(null)
    go("password", "forward")
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!passwordV.validateAll()) return
    setBusy(true)
    try {
      const body = await resetPasswordWithCode({ email: sentTo, code, newPassword: password })
      const { accessToken, role } = readSession(body)
      if (accessToken) persistAuthTokens(accessToken)
      clearCachedUser()
      setPassword("")
      setHome(accessToken || role ? dashboardPathForRole(role ?? "") : "/login")
      go("done", "forward")
    } catch (error) {
      const kind = error instanceof ApiError ? authErrorKind(error.status, error.code) : "network"
      if (kind === "code-invalid" || kind === "code-locked") {
        // Back to the code, with the reason on it; the password they chose stays typed.
        setCodeError(authErrorCopy(kind))
        go("code", "back")
        return
      }
      if (error instanceof ApiError && error.status === 400 && kind === "other" && /password/i.test(error.message)) {
        passwordV.setServerError("password", PASSWORD_MESSAGES.rule)
        return
      }
      setFormError(authErrorCopy(kind) ?? "We couldn't change your password. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const stepNumber = step === "email" ? 1 : step === "code" ? 2 : 3

  return (
    <AuthSplitLayout>
      <div key={step} data-auth-step={direction} className="space-y-5 min-[980px]:space-y-7">
        {step === "done" ? (
          <div className="space-y-6 text-center" role="status" aria-live="polite">
            <SuccessCheck />
            <AuthHeading
              align="center"
              headingRef={headingRef}
              title="Password changed"
              description={
                <p>
                  You&apos;re logged in with your new password. For your safety, every other device that was logged in
                  to your account has been logged out.
                </p>
              }
            />
            <a href={home} className={`${AUTH_PRIMARY_BUTTON_CLASS} inline-flex items-center justify-center`}>
              {home === "/login" ? "Go to log in" : "Go to your dashboard"}
            </a>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="-my-2 inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to log in
            </Link>

            <StepIndicator steps={STEPS} current={stepNumber} />

            {step === "email" && (
              <>
                <AuthHeading
                  headingRef={headingRef}
                  title="Forgot your password?"
                  description={<p>Enter your email and we&apos;ll send you a 6-digit code to set a new one.</p>}
                />
                <form onSubmit={handleEmailSubmit} noValidate aria-busy={busy} className="space-y-4 min-[980px]:space-y-5">
                  <FormAnnouncer message={emailV.announcement} />
                  <FormField id="email" label="Email" error={emailV.errors.email} className={AUTH_FIELD_CLASS}>
                    {(control) => (
                      <Input
                        {...control}
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="send"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => emailV.handleBlur("email")}
                        className={AUTH_INPUT_CLASS}
                        required
                        disabled={busy}
                      />
                    )}
                  </FormField>
                  {formError ? (
                    <AuthNotice tone="error" role="alert" noticeRef={formErrorRef}>
                      {formError}
                    </AuthNotice>
                  ) : null}
                  <Turnstile ref={turnstileRef} action="forgot" />
                  <SubmitButton busy={busy} busyLabel="Sending your code…">
                    Send code
                  </SubmitButton>
                </form>
              </>
            )}

            {step === "code" && (
              <>
                <AuthIcon>
                  <Mail aria-hidden="true" />
                </AuthIcon>
                <AuthHeading
                  headingRef={headingRef}
                  title="Check your email"
                  description={
                    <p>
                      If an account uses{" "}
                      <span className="font-medium text-foreground [overflow-wrap:anywhere]">{sentTo}</span>, a code is
                      on its way. {AUTH_COPY.codeExpiry}
                    </p>
                  }
                />
                {codeError ? (
                  <AuthNotice tone="error" role="alert">
                    {codeError}
                  </AuthNotice>
                ) : null}
                <CodeEntry
                  initialResendAt={resendAt}
                  submitLabel="Continue"
                  busyLabel="Continuing…"
                  onVerify={handleCode}
                  onResend={() => send(sentTo).then((next) => (setCodeError(null), next))}
                  onChangeEmail={() => {
                    go("email", "back")
                    setTimeout(() => document.getElementById("email")?.focus(), 30)
                  }}
                />
                <Turnstile ref={turnstileRef} action="forgot" />
              </>
            )}

            {step === "password" && (
              <>
                <AuthHeading
                  headingRef={headingRef}
                  title="Choose a new password"
                  description={<p>You&apos;ll use it to log in from now on.</p>}
                />
                <form onSubmit={handlePasswordSubmit} noValidate aria-busy={busy} className="space-y-4 min-[980px]:space-y-5">
                  <FormAnnouncer message={passwordV.announcement} />
                  <div className="space-y-3">
                    <FormField
                      id="password"
                      label="New password"
                      error={passwordV.errors.password}
                      describedBy="password-rules"
                      className={AUTH_FIELD_CLASS}
                    >
                      {(control) => (
                        <PasswordInput
                          control={control}
                          value={password}
                          onChange={setPassword}
                          onBlur={() => passwordV.handleBlur("password")}
                          autoComplete="new-password"
                          enterKeyHint="done"
                          disabled={busy}
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
                      disabled={busy}
                    />
                  </div>
                  {formError ? (
                    <AuthNotice tone="error" role="alert" noticeRef={formErrorRef}>
                      {formError}
                    </AuthNotice>
                  ) : null}
                  <SubmitButton busy={busy} busyLabel="Saving your password…">
                    Save and log in
                  </SubmitButton>
                  <p className="text-sm text-muted-foreground">
                    Saving logs out every other device on your account.{" "}
                    <button
                      type="button"
                      onClick={() => go("code", "back")}
                      className={`${AUTH_LINK_CLASS} inline-flex min-h-11 items-center sm:min-h-0`}
                    >
                      Re-enter the code
                    </button>
                  </p>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </AuthSplitLayout>
  )
}
