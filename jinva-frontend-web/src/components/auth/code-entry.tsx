"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowLeft, RotateCw } from "lucide-react"
import { useResendCountdown } from "@/hooks/use-resend-countdown"
import { CODE_LENGTH, countdownWords, formatCountdown } from "@/lib/auth-code"
import { CodeInput, type CodeInputHandle } from "./code-input"
import { SubmitButton } from "./auth-ui"

/**
 * Auth v2: the code step every flow shares — sign-up step 3, login by code,
 * forgot password and /verify-email. The six boxes, a submit button for people
 * who'd rather press one, "Resend" counting down to the server's
 * `resendAvailableAt`, and a way back to change the email.
 *
 * The parent owns the API: `onVerify` resolves on success (and then moves the
 * page on) or throws an Error whose message is shown under the boxes;
 * `onResend` resolves with the new `resendAvailableAt` or throws likewise
 * (optionally with `retryAfterSeconds`, which restarts the timer).
 */

export class CodeStepError extends Error {
  readonly retryAfterSeconds?: number
  constructor(message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = "CodeStepError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function CodeEntry({
  id = "code",
  initialResendAt,
  onVerify,
  onResend,
  onChangeEmail,
  changeEmailLabel = "Use a different email",
  submitLabel = "Verify and continue",
  busyLabel = "Checking your code…",
  verifyOnComplete = true,
  hint,
}: {
  id?: string
  /** The API's `resendAvailableAt`; `undefined` = resend allowed straight away (nothing known). */
  initialResendAt: string | null | undefined
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<string | null>
  onChangeEmail: () => void
  changeEmailLabel?: string
  submitLabel?: string
  busyLabel?: string
  /** Submit on the sixth digit (true everywhere except where the code is only collected). */
  verifyOnComplete?: boolean
  hint?: React.ReactNode
}) {
  const inputRef = useRef<CodeInputHandle>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const verifyingRef = useRef(false)
  const countdown = useResendCountdown(initialResendAt)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const verify = async (value: string) => {
    if (verifyingRef.current) return
    if (value.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits of the code`)
      inputRef.current?.focus()
      return
    }
    verifyingRef.current = true
    setVerifying(true)
    setError(null)
    setStatus(busyLabel)
    try {
      await onVerify(value)
      setStatus("Code accepted.")
    } catch (e) {
      setStatus("")
      setError(e instanceof Error && e.message ? e.message : "That code didn't work. Check it or ask for a new one.")
      if (e instanceof CodeStepError && e.retryAfterSeconds) countdown.start(e.retryAfterSeconds)
      inputRef.current?.clear()
    } finally {
      verifyingRef.current = false
      setVerifying(false)
    }
  }

  const resend = async () => {
    if (!countdown.canResend || resending) return
    setResending(true)
    setError(null)
    setStatus("Sending a new code…")
    try {
      const next = await onResend()
      countdown.start(next)
      setStatus("We sent a new code. The earlier one no longer works.")
      inputRef.current?.clear()
    } catch (e) {
      setStatus("")
      setError(e instanceof Error && e.message ? e.message : "We couldn't send a new code. Try again.")
      if (e instanceof CodeStepError && e.retryAfterSeconds) countdown.start(e.retryAfterSeconds)
    } finally {
      setResending(false)
    }
  }

  return (
    <form
      noValidate
      aria-busy={verifying}
      onSubmit={(e) => {
        e.preventDefault()
        void verify(code)
      }}
      className="space-y-6"
    >
      <CodeInput
        ref={inputRef}
        id={id}
        error={error}
        status={status}
        disabled={verifying}
        onChange={(value) => {
          setCode(value)
          if (error) setError(null)
        }}
        onComplete={(value) => {
          if (verifyOnComplete) void verify(value)
        }}
      />

      {hint ? <div className="text-sm text-muted-foreground">{hint}</div> : null}

      <SubmitButton busy={verifying} busyLabel={busyLabel}>
        {submitLabel}
      </SubmitButton>

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-h-11 flex-wrap items-center gap-x-1.5 text-muted-foreground sm:min-h-9">
          <span>Didn&apos;t get it? Check spam, or</span>
          {countdown.canResend ? (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="inline-flex min-h-11 items-center gap-1 rounded-md font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:opacity-60 sm:min-h-9"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              {resending ? "sending…" : "resend the code"}
            </button>
          ) : (
            <span className="inline-flex min-h-11 items-center sm:min-h-9">
              <span aria-hidden="true">
                resend in <span className="font-medium tabular-nums text-foreground">{formatCountdown(countdown.remaining)}</span>
              </span>
              <span className="sr-only">you can ask for a new code in {countdownWords(countdown.remaining)}</span>
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onChangeEmail}
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 sm:min-h-9 sm:self-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {changeEmailLabel}
        </button>
      </div>
    </form>
  )
}
