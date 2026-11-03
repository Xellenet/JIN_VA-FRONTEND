"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { AUTH_INPUT_CLASS, FormAnnouncer, FormField } from "@/components/forms/form-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import {
  persistAuthTokens,
  dashboardPathForRole,
  safeInternalRedirect,
  ACCOUNT_DELETED_PARAM,
  RESTORABLE_UNTIL_PARAM,
} from "@/lib/auth"
import { ApiError } from "@/lib/api"
import { setFlashToast } from "@/lib/flash"
import { threeLetterMonth } from "@/lib/spending"
import { requestCode, verifyCode } from "@/lib/auth-v2-api"
import { AUTH_COPY, AUTH_ERROR_CODES, authErrorCopy, authErrorKind, readSession } from "@/lib/auth-v2-errors"
import { clearCachedUser } from "@/contexts/auth-context"
import { AuthSplitLayout } from "./auth-split-layout"
import {
  AUTH_LINK_CLASS,
  AuthHeading,
  AuthNotice,
  GoogleButton,
  OrDivider,
  PasswordInput,
  SegmentedControl,
  SubmitButton,
} from "./auth-ui"
import { CodeEntry, CodeStepError } from "./code-entry"
import { Turnstile, type TurnstileHandle } from "./turnstile"
import { EMAIL_MESSAGES, PASSWORD_MESSAGES, validateEmail } from "./signup-fields"

/*
 * Auth v2 login: "Password" | "Email me a code" on one screen.
 *
 * - Password: as before (remember me, the account-state banners, restore),
 *   plus a visible Turnstile check once the API answers TURNSTILE_REQUIRED
 *   after repeated failures.
 * - Email me a code: email → Send code (invisible Turnstile) → the shared
 *   6-digit step → signed in. The reply is the same whether or not the email
 *   has an account, so the form can't be used to find out who is on JinVa.
 *
 * Inline errors under each field (google-signup-prefill V1–V8); account-state
 * answers stay banners with an action.
 */
type Field = "email" | "password"
type Mode = "password" | "code"

const FIELDS_PASSWORD: readonly Field[] = ["email", "password"]
const LABELS: Record<Field, string> = { email: "Email", password: "Password" }

const MODES = [
  { value: "password", label: "Password" },
  { value: "code", label: "Email me a code" },
] as const

/** A 400 from the ValidationPipe is not about the credentials being wrong; never show its DTO text (V6). */
const LOGIN_FAILED = "Check your email and password, then try again."

/**
 * Both dates on the pending-deletion banner come from the server
 * (`meta.details`); a client-side "+30 days" would drift from the purge job.
 * Null for anything unparseable, so the banner drops the sentence.
 */
function formatWindowDate(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return threeLetterMonth(date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))
}

const BANNED_MESSAGE = "This account has been banned. Contact support if you think this is a mistake."

/** `?error=` codes other auth screens redirect here with. Unknown codes show nothing. */
const LOGIN_ERROR_COPY: Record<string, string> = {
  oauth_failed: "Something went wrong signing you in with Google. Please try again.",
  signup_expired: "Your sign-up session expired. Please continue with Google again.",
  account_banned: BANNED_MESSAGE,
}

interface PendingDeletion {
  deletedAt?: string
  restorableUntil?: string
  message?: string
}

export function LoginForm() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>("password")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // QA AUTH-31: sent with the login; ticked by default.
  const [rememberMe, setRememberMe] = useState(true)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  // G10: "this account signs in with Google", distinct from wrong credentials.
  const [socialOnlyError, setSocialOnlyError] = useState<string | null>(null)
  const [bannedError, setBannedError] = useState<string | null>(null)
  // C1.4: soft-deleted but still restorable — a banner with an action.
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreWindowClosed, setRestoreWindowClosed] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // Set by TURNSTILE_REQUIRED: the check is shown and every later try sends a token.
  const [needsTurnstile, setNeedsTurnstile] = useState(false)
  const [formData, setFormData] = useState({ email: "", password: "" })
  // Code path: the address a code was requested for (null = still on the email step).
  const [codeEmail, setCodeEmail] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState<string | null>(null)
  const loginTurnstile = useRef<TurnstileHandle>(null)
  const codeTurnstile = useRef<TurnstileHandle>(null)
  const formErrorRef = useRef<HTMLDivElement>(null)

  // C1.3: arrived straight from deleting their own account (survives a refresh).
  const justDeletedAccount = searchParams.get(ACCOUNT_DELETED_PARAM) === "1"
  const deletionRestorableUntil = formatWindowDate(searchParams.get(RESTORABLE_UNTIL_PARAM) ?? undefined)
  const redirectError = LOGIN_ERROR_COPY[searchParams.get("error") ?? ""] ?? null

  // Login checks only that a password was entered: an older password may predate the rules.
  const validateField = (field: Field, validation: ValidationMode): string | null => {
    const submit = validation === "submit"
    if (field === "email") return validateEmail(formData.email, submit)
    if (mode === "code") return null
    return submit && !formData.password ? PASSWORD_MESSAGES.enter : null
  }
  const v = useFormValidation<Field>({
    fields: mode === "code" ? (["email"] as const) : FIELDS_PASSWORD,
    values: { ...formData, mode },
    validate: validateField,
    labels: LABELS,
  })

  useEffect(() => {
    if (formError) formErrorRef.current?.focus()
  }, [formError])

  const clearBanners = () => {
    setUnverifiedEmail(null)
    setSocialOnlyError(null)
    setBannedError(null)
    setPendingDeletion(null)
    setRestoreWindowClosed(null)
    setFormError(null)
  }

  /**
   * F1: `?redirect=` is attacker-controllable, so it is reduced to a
   * same-origin path or discarded for the role dashboard (lib/auth.ts).
   */
  const redirectAfterLogin = (role: string | undefined | null) => {
    const roleDashboard = dashboardPathForRole(role ?? "")
    globalThis.location.href = safeInternalRedirect(searchParams.get("redirect"), roleDashboard)
  }

  const handleRestoreAccount = async () => {
    setIsRestoring(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/restore-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Email *and* password: an email-only restore would let anyone un-delete a stranger's account.
        body: JSON.stringify(formData),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // 410: ownership proven but nothing left to restore (window elapsed or purged).
        if (response.status === 410) {
          const deletedOn = formatWindowDate(pendingDeletion?.deletedAt)
          setRestoreWindowClosed(
            deletedOn
              ? `This account was deleted on ${deletedOn} and the 30-day recovery window has closed. You'll need to create a new account.`
              : (data.message ?? "This account can no longer be restored. You'll need to create a new account."),
          )
          return
        }
        throw new Error(data.message || "Failed to restore account")
      }

      // Restore first, then the ordinary verification gate applies.
      if (data.requiresEmailVerification) {
        setPendingDeletion(null)
        setUnverifiedEmail(formData.email)
        toast.success(data.message || "Your account has been restored. Confirm your email to log in.")
        return
      }

      persistAuthTokens(data.access_token)
      // Handed to the next page: a hard navigation destroys a toast raised here (FE-1).
      setFlashToast("Welcome back — your account has been restored.")
      redirectAfterLogin(data.data?.role)
    } catch (err) {
      // QA DEL-08: a wrong password gets the server's own answer.
      toast.error(
        err instanceof Error && err.message && !(err instanceof TypeError)
          ? err.message
          : "We couldn't restore your account. Please try again, or contact support if this keeps happening.",
      )
    } finally {
      setIsRestoring(false)
    }
  }

  // ── Password ──────────────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!v.validateAll()) return
    clearBanners()
    setIsLoading(true)

    try {
      let turnstileToken: string | undefined
      if (needsTurnstile) {
        try {
          turnstileToken = await loginTurnstile.current?.getToken()
        } catch {
          setFormError(AUTH_COPY.turnstileUnavailable)
          return
        }
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...formData, rememberMe, ...(turnstileToken ? { turnstileToken } : {}) }),
      })

      const data = await response.json().catch(() => ({}))
      const code: string | undefined = data?.meta?.error

      if (!response.ok) {
        // Auth v2: repeated failures. Show the check; the next try sends a token.
        if (code === AUTH_ERROR_CODES.turnstileRequired || code === AUTH_ERROR_CODES.turnstileFailed) {
          setNeedsTurnstile(true)
          loginTurnstile.current?.reset()
          setFormError(code === AUTH_ERROR_CODES.turnstileFailed ? AUTH_COPY.turnstileFailed : AUTH_COPY.turnstileRequired)
          return
        }
        // C1.4: checked first and by `meta.error` — it shares 403 with "unverified".
        if (response.status === 403 && code === "ACCOUNT_PENDING_DELETION") {
          const details = data?.meta?.details as { deletedAt?: string; restorableUntil?: string } | undefined
          setPendingDeletion({
            deletedAt: details?.deletedAt,
            restorableUntil: details?.restorableUntil,
            message: data.message,
          })
          return
        }
        if (response.status === 403 && code === "ACCOUNT_BANNED") {
          setBannedError(data.message || BANNED_MESSAGE)
          return
        }
        // S4: unverified accounts get a distinct 403. Auth v2: offer a code, which confirms the email and signs in.
        if (response.status === 403) {
          setUnverifiedEmail(formData.email.trim())
          return
        }
        if (response.status === 401 && code === "SocialOnlyAccountException") {
          setSocialOnlyError(
            data.message ||
              'This account signs in with Google. Continue with Google, or use "Forgot password" to set a password for this account.',
          )
          return
        }
        if (response.status === 400) {
          const message = Array.isArray(data?.message) ? data.message.join(" ") : String(data?.message ?? "")
          if (/email/i.test(message)) v.setServerError("email", EMAIL_MESSAGES.invalid)
          else setFormError(LOGIN_FAILED)
          return
        }
        if (response.status === 429) {
          setFormError(AUTH_COPY.rateLimited)
          return
        }
        setFormError(data.message || LOGIN_FAILED)
        return
      }

      // { access_token, expires_at, message, data: user }; the refresh token is an httpOnly cookie.
      persistAuthTokens(data.access_token)
      clearCachedUser()
      redirectAfterLogin(data.data?.role)
    } catch {
      setFormError(AUTH_COPY.network)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Email me a code ───────────────────────────────────────────────────────
  const sendLoginCode = async (email: string): Promise<string | null> => {
    let turnstileToken: string | undefined
    try {
      turnstileToken = await codeTurnstile.current?.getToken()
    } catch {
      throw new CodeStepError(AUTH_COPY.turnstileUnavailable)
    }
    try {
      const { resendAvailableAt } = await requestCode({ email, purpose: "login", turnstileToken })
      return resendAvailableAt
    } catch (error) {
      const kind = error instanceof ApiError ? authErrorKind(error.status, error.code) : "network"
      throw new CodeStepError(
        authErrorCopy(kind) ?? "We couldn't send a code. Try again.",
        error instanceof ApiError ? error.retryAfterSeconds : undefined,
      )
    }
  }

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!v.validateAll()) return
    clearBanners()
    setIsLoading(true)
    const email = formData.email.trim()
    try {
      const next = await sendLoginCode(email)
      setResendAt(next)
      setCodeEmail(email)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : AUTH_COPY.network)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async (code: string) => {
    if (!codeEmail) return
    try {
      const body = await verifyCode({ email: codeEmail, code, purpose: "login" })
      const { accessToken, role } = readSession(body)
      if (accessToken) persistAuthTokens(accessToken)
      clearCachedUser()
      redirectAfterLogin(role)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.code === "ACCOUNT_BANNED") {
        throw new CodeStepError(error.message || BANNED_MESSAGE)
      }
      const kind = error instanceof ApiError ? authErrorKind(error.status, error.code) : "network"
      throw new CodeStepError(
        authErrorCopy(kind === "other" ? "code-invalid" : kind) ?? AUTH_COPY.codeInvalid,
        error instanceof ApiError ? error.retryAfterSeconds : undefined,
      )
    }
  }

  const switchMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setCodeEmail(null)
    clearBanners()
  }

  // From the "confirm your email" banner: straight to a code for that address.
  const confirmByCode = () => {
    setMode("code")
    setUnverifiedEmail(null)
    // The email is already filled and valid; send once the code form has mounted.
    setTimeout(() => {
      void (async () => {
        setIsLoading(true)
        const email = formData.email.trim()
        try {
          const next = await sendLoginCode(email)
          setResendAt(next)
          setCodeEmail(email)
        } catch (error) {
          setFormError(error instanceof Error ? error.message : AUTH_COPY.network)
        } finally {
          setIsLoading(false)
        }
      })()
    }, 0)
  }

  const handleGoogleLogin = () => {
    // G1/G8: a real backend route that 302s to Google. No role from login (G9 is sign-up only).
    globalThis.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`
  }

  const emailField = (
    <FormField id="email" label="Email" error={v.errors.email}>
      {(control) => (
        <Input
          {...control}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint={mode === "code" ? "send" : "next"}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          onBlur={() => v.handleBlur("email")}
          className={AUTH_INPUT_CLASS}
          required
          disabled={isLoading}
        />
      )}
    </FormField>
  )

  const formErrorNotice = formError ? (
    <AuthNotice tone="error" role="alert" noticeRef={formErrorRef}>
      {formError}
    </AuthNotice>
  ) : null

  return (
    <AuthSplitLayout>
      <div className="space-y-8" data-auth-step="none">
        <AuthHeading
          title="Welcome back"
          description={
            <p>
              Log in to JinVa. New here?{" "}
              <Link href="/signup" className={AUTH_LINK_CLASS}>
                Create an account
              </Link>
            </p>
          }
        />

        {justDeletedAccount && !pendingDeletion && (
          <AuthNotice tone="info" title="Account deleted">
            {deletionRestorableUntil
              ? `You can restore it until ${deletionRestorableUntil} — just log in again below with the same email and password. After that it's gone for good.`
              : "You have 30 days to restore it — just log in again below with the same email and password."}
          </AuthNotice>
        )}

        {redirectError && (
          <AuthNotice tone="warning" role="alert">
            {redirectError}
          </AuthNotice>
        )}

        <div className="space-y-6">
          <SegmentedControl
            label="How do you want to log in?"
            options={MODES}
            value={mode}
            onChange={switchMode}
            disabled={isLoading}
          />

          {mode === "password" && (
            <form
              key="password"
              data-auth-step="none"
              onSubmit={handlePasswordSubmit}
              noValidate
              aria-busy={isLoading}
              className="space-y-5"
            >
              <FormAnnouncer message={v.announcement} />
              {emailField}

              <FormField id="password" label="Password" error={v.errors.password}>
                {(control) => (
                  <PasswordInput
                    control={control}
                    value={formData.password}
                    onChange={(password) => setFormData({ ...formData, password })}
                    onBlur={() => v.handleBlur("password")}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    disabled={isLoading}
                    visible={showPassword}
                    onVisibleChange={setShowPassword}
                  />
                )}
              </FormField>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex min-h-11 items-center gap-2.5 sm:min-h-9">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(!!checked)}
                    className="size-5 sm:size-4"
                  />
                  <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-muted-foreground">
                    Remember me
                  </Label>
                </div>
                <Link
                  href="/forgot-password"
                  className={`${AUTH_LINK_CLASS} inline-flex min-h-11 items-center text-sm sm:min-h-9`}
                >
                  Forgot password?
                </Link>
              </div>

              {unverifiedEmail && (
                <AuthNotice tone="warning" title="Confirm your email to log in">
                  <p>We&apos;ll email you a 6-digit code. Entering it confirms your email and logs you in.</p>
                  <button
                    type="button"
                    onClick={confirmByCode}
                    className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4 sm:min-h-0"
                  >
                    Email me a code
                  </button>
                </AuthNotice>
              )}

              {bannedError && (
                <AuthNotice tone="error" role="alert">
                  {bannedError}
                </AuthNotice>
              )}
              {socialOnlyError && <AuthNotice tone="info">{socialOnlyError}</AuthNotice>}

              {pendingDeletion && (
                <AuthNotice
                  tone="warning"
                  title={
                    restoreWindowClosed
                      ? "This account can no longer be restored"
                      : "This account is scheduled for deletion"
                  }
                >
                  {restoreWindowClosed ? (
                    <>
                      <p>{restoreWindowClosed}</p>
                      <Link href="/signup" className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4 sm:min-h-0">
                        Create an account
                      </Link>
                    </>
                  ) : (
                    <>
                      <p>
                        {formatWindowDate(pendingDeletion.deletedAt) && formatWindowDate(pendingDeletion.restorableUntil)
                          ? `You deleted it on ${formatWindowDate(pendingDeletion.deletedAt)}. You can restore it until ${formatWindowDate(pendingDeletion.restorableUntil)} — after that it's gone for good.`
                          : (pendingDeletion.message ?? "You can still restore it before the recovery window closes.")}
                      </p>
                      <button
                        type="button"
                        onClick={handleRestoreAccount}
                        disabled={isRestoring}
                        className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4 disabled:opacity-60 sm:min-h-0"
                      >
                        {isRestoring ? "Restoring…" : "Restore my account"}
                      </button>
                    </>
                  )}
                </AuthNotice>
              )}

              {formErrorNotice}

              {needsTurnstile && <Turnstile ref={loginTurnstile} action="login" mode="visible" />}

              <SubmitButton busy={isLoading} busyLabel="Logging in…">
                Log in
              </SubmitButton>
            </form>
          )}

          {mode === "code" && !codeEmail && (
            <form
              key="code-email"
              data-auth-step="none"
              onSubmit={handleSendCode}
              noValidate
              aria-busy={isLoading}
              className="space-y-5"
            >
              <FormAnnouncer message={v.announcement} />
              {emailField}
              {formErrorNotice}
              <Turnstile ref={codeTurnstile} action="code_request" />
              <SubmitButton busy={isLoading} busyLabel="Sending your code…">
                Send code
              </SubmitButton>
              <p className="text-sm text-muted-foreground">
                We&apos;ll email you a 6-digit code to log in with, no password needed.
              </p>
            </form>
          )}

          {mode === "code" && codeEmail && (
            <div key="code-entry" data-auth-step="forward" className="space-y-6">
              <AuthNotice tone="info" role="status" title="Check your email">
                If an account uses <span className="font-medium">{codeEmail}</span>, a code is on its way.{" "}
                {AUTH_COPY.codeExpiry}
              </AuthNotice>
              <CodeEntry
                initialResendAt={resendAt}
                submitLabel="Log in"
                onVerify={handleVerifyCode}
                onResend={() => sendLoginCode(codeEmail)}
                onChangeEmail={() => {
                  setCodeEmail(null)
                  setTimeout(() => document.getElementById("email")?.focus(), 30)
                }}
              />
              <Turnstile ref={codeTurnstile} action="code_request" />
              <p className="text-sm">
                <Link href="/forgot-password" className={AUTH_LINK_CLASS}>
                  Forgot password?
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <OrDivider />
          <GoogleButton onClick={handleGoogleLogin} disabled={isLoading} />
        </div>
      </div>
    </AuthSplitLayout>
  )
}
