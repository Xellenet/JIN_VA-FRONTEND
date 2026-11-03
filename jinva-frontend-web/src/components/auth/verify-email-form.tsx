"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Loader2, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { AUTH_INPUT_CLASS, FormAnnouncer, FormField } from "@/components/forms/form-field"
import { useFormValidation, type ValidationMode } from "@/hooks/use-form-validation"
import { ApiError } from "@/lib/api"
import { persistAuthTokens } from "@/lib/auth"
import { requestCode, verifyCode } from "@/lib/auth-v2-api"
import { AUTH_COPY, authErrorCopy, authErrorKind, readSession } from "@/lib/auth-v2-errors"
import { SIGNUP_DRAFT_KEY, homeAfterSignup, parseSignupDraft } from "@/lib/signup-flow"
import { clearCachedUser } from "@/contexts/auth-context"
import { AuthSplitLayout } from "./auth-split-layout"
import {
  AUTH_FIELD_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AuthHeading,
  AuthIcon,
  AuthNotice,
  SubmitButton,
  SuccessCheck,
} from "./auth-ui"
import { CodeEntry, CodeStepError } from "./code-entry"
import { Turnstile, type TurnstileHandle } from "./turnstile"
import { PENDING_VERIFY_EMAIL_KEY, validateEmail } from "./signup-fields"

/*
 * /verify-email
 *
 * - `?token=` (links emailed before auth v2): confirmed as before, then "Go to
 *   log in". A dead link offers a code instead.
 * - No token (new sign-ups): the 6-digit code entry. The address comes from
 *   the sign-up draft or the older pending-email key (QA SEC-16: never the
 *   URL, though an old `?email=` is still read); otherwise it is asked for and
 *   a code is sent (invisible Turnstile). A correct code signs the person in.
 */

type LinkState = "checking" | "confirmed" | "failed"

function knownEmail(fromLink: string | null): string | null {
  if (fromLink) return fromLink
  try {
    const draft = parseSignupDraft(sessionStorage.getItem(SIGNUP_DRAFT_KEY))
    return draft.codeEmail ?? sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY)
  } catch {
    return null
  }
}

export function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const linkEmail = searchParams.get("email")

  const [linkState, setLinkState] = useState<LinkState>("checking")
  const [hydrated, setHydrated] = useState(false)
  const [email, setEmail] = useState("")
  const [codeEmail, setCodeEmail] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState<string | null | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const turnstileRef = useRef<TurnstileHandle>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const known = knownEmail(linkEmail)
    if (known) {
      setEmail(known)
      if (!token) setCodeEmail(known)
    }
    setHydrated(true)
  }, [linkEmail, token])

  // Old links: confirm once (Strict Mode mounts twice in dev).
  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setLinkState(res.ok ? "confirmed" : "failed"))
      .catch(() => setLinkState("failed"))
  }, [token])

  const v = useFormValidation<"email">({
    fields: ["email"],
    values: { email },
    validate: (_f, mode: ValidationMode) => validateEmail(email, mode === "submit"),
    labels: { email: "Email" },
  })

  const send = async (address: string): Promise<string | null> => {
    let turnstileToken: string | undefined
    try {
      turnstileToken = await turnstileRef.current?.getToken()
    } catch {
      throw new CodeStepError(AUTH_COPY.turnstileUnavailable)
    }
    try {
      const { resendAvailableAt } = await requestCode({ email: address, purpose: "signup", turnstileToken })
      return resendAvailableAt
    } catch (error) {
      const kind = error instanceof ApiError ? authErrorKind(error.status, error.code) : "network"
      throw new CodeStepError(
        authErrorCopy(kind) ?? "We couldn't send a code. Try again.",
        error instanceof ApiError ? error.retryAfterSeconds : undefined,
      )
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!v.validateAll()) return
    setSending(true)
    try {
      const address = email.trim()
      setResendAt(await send(address))
      setCodeEmail(address)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : AUTH_COPY.network)
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async (code: string) => {
    if (!codeEmail) return
    try {
      const body = await verifyCode({ email: codeEmail, code, purpose: "signup" })
      const { accessToken, role } = readSession(body)
      if (accessToken) persistAuthTokens(accessToken)
      clearCachedUser()
      try {
        sessionStorage.removeItem(SIGNUP_DRAFT_KEY)
        sessionStorage.removeItem(PENDING_VERIFY_EMAIL_KEY)
      } catch {
        // Nothing to clear.
      }
      setSignedIn(true)
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      setTimeout(() => {
        window.location.href = homeAfterSignup(role)
      }, reduce ? 150 : 1100)
    } catch (error) {
      const kind = error instanceof ApiError ? authErrorKind(error.status, error.code) : "network"
      throw new CodeStepError(
        authErrorCopy(kind === "other" ? "code-invalid" : kind) ?? AUTH_COPY.codeInvalid,
        error instanceof ApiError ? error.retryAfterSeconds : undefined,
      )
    }
  }

  // ── Old link ──────────────────────────────────────────────────────────────
  if (token && linkState !== "failed") {
    return (
      <AuthSplitLayout>
        {linkState === "checking" ? (
          <div className="space-y-6" role="status" aria-live="polite">
            <span className="inline-flex rounded-full bg-primary/10 p-3 text-primary">
              <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            </span>
            <AuthHeading title="Confirming your email…" description={<p>This takes a moment.</p>} />
          </div>
        ) : (
          <div className="space-y-6 text-center" data-auth-step="none" role="status" aria-live="polite">
            <SuccessCheck />
            <AuthHeading align="center" title="Email confirmed" description={<p>You can log in to your account now.</p>} />
            <Link href="/login" className={`${AUTH_PRIMARY_BUTTON_CLASS} inline-flex items-center justify-center`}>
              Go to log in
            </Link>
          </div>
        )}
      </AuthSplitLayout>
    )
  }

  if (signedIn) {
    return (
      <AuthSplitLayout>
        <div className="space-y-6 text-center" data-auth-step="none" role="status" aria-live="polite">
          <SuccessCheck />
          <AuthHeading align="center" title="You're in" description={<p>Your email is confirmed. Taking you to JinVa…</p>} />
        </div>
      </AuthSplitLayout>
    )
  }

  if (!hydrated) {
    return (
      <AuthSplitLayout>
        <div className="min-h-[20rem]" aria-busy="true" />
      </AuthSplitLayout>
    )
  }

  // ── Code ──────────────────────────────────────────────────────────────────
  return (
    <AuthSplitLayout>
      <div key={codeEmail ? "code" : "email"} data-auth-step={codeEmail ? "forward" : "none"} className="space-y-5 min-[980px]:space-y-7">
        {token && linkState === "failed" && (
          <AuthNotice tone="warning" title="This link has expired or was already used">
            We&apos;ll send you a 6-digit code instead.
          </AuthNotice>
        )}
        {codeEmail ? (
          <>
            <AuthIcon>
              <Mail aria-hidden="true" />
            </AuthIcon>
            <AuthHeading
              title="Check your email"
              description={
                <p>
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-medium text-foreground [overflow-wrap:anywhere]">{codeEmail}</span>.{" "}
                  {AUTH_COPY.codeExpiry}
                </p>
              }
            />
            <CodeEntry
              initialResendAt={resendAt}
              onVerify={handleVerify}
              onResend={() => send(codeEmail)}
              onChangeEmail={() => {
                setCodeEmail(null)
                setTimeout(() => document.getElementById("email")?.focus(), 30)
              }}
            />
          </>
        ) : (
          <>
            <AuthHeading
              title="Confirm your email"
              description={<p>Enter the email you signed up with and we&apos;ll send you a 6-digit code.</p>}
            />
            <form onSubmit={handleSend} noValidate aria-busy={sending} className="space-y-4 min-[980px]:space-y-5">
              <FormAnnouncer message={v.announcement} />
              <FormField id="email" label="Email" error={v.errors.email} className={AUTH_FIELD_CLASS}>
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
                    onBlur={() => v.handleBlur("email")}
                    className={AUTH_INPUT_CLASS}
                    required
                    disabled={sending}
                  />
                )}
              </FormField>
              {formError ? (
                <AuthNotice tone="error" role="alert">
                  {formError}
                </AuthNotice>
              ) : null}
              <SubmitButton busy={sending} busyLabel="Sending your code…">
                Send code
              </SubmitButton>
            </form>
          </>
        )}
        <Turnstile ref={turnstileRef} action="code_request" />
        <p className="text-center text-sm">
          <Link href="/login" className={AUTH_LINK_CLASS}>
            Back to log in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  )
}
