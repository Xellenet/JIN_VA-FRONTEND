"use client"

import type React from "react"
import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CODE_LENGTH,
  applyCodeBackspace,
  applyCodeDelete,
  applyCodeInput,
  codeFromDigits,
  emptyCode,
  focusTargetFor,
  isCodeComplete,
  moveCodeFocus,
  type CodeChange,
} from "@/lib/auth-code"

/**
 * Auth v2: the 6-digit email code, as six boxes that behave as one field.
 *
 * - One group, labelled "6-digit code", with one error and one live status.
 * - The first box carries `autocomplete="one-time-code"`, so phones offer the
 *   code from the email; every box is `inputmode="numeric"`.
 * - Typing moves forward, Backspace moves back, arrows/Home/End move freely,
 *   and a paste (or an autofill landing in one box) fills all six.
 * - The sixth digit calls `onComplete`, which is where the form submits; there
 *   is no separate press needed, though the form keeps a submit button for
 *   people who prefer one.
 *
 * The logic is pure and tested (src/lib/auth-code.ts); this file only wires it
 * to the DOM.
 */

export interface CodeInputHandle {
  focus: () => void
  clear: () => void
}

export interface CodeInputProps {
  ref?: Ref<CodeInputHandle>
  /** Base id; boxes are `${id}-0` … `${id}-5`. The first box is `id` itself, so labels and focus can target it. */
  id: string
  label?: string
  error?: React.ReactNode
  /** Polite status ("Checking your code…"). Errors are announced too. */
  status?: string
  disabled?: boolean
  onChange?: (code: string) => void
  onComplete?: (code: string) => void
  autoFocus?: boolean
  className?: string
}

export function CodeInput({
  ref,
  id,
  label = "6-digit code",
  error,
  status,
  disabled,
  onChange,
  onComplete,
  autoFocus,
  className,
}: CodeInputProps) {
  const [digits, setDigitsState] = useState<string[]>(() => emptyCode())
  // Focus moves synchronously inside an event, before React re-renders, so the
  // focus handler must read the digits just committed, not the render's copy.
  const digitsRef = useRef(digits)
  const setDigits = useCallback((next: string[]) => {
    digitsRef.current = next
    setDigitsState(next)
  }, [])
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const labelId = useId()
  const errorId = `${id}-error`
  // Bumped on each new error so the shake replays even for the same message.
  const [errorKey, setErrorKey] = useState(0)
  const lastError = useRef<React.ReactNode>(null)
  useEffect(() => {
    if (error && error !== lastError.current) setErrorKey((k) => k + 1)
    lastError.current = error ?? null
  }, [error])

  const focusBox = useCallback((index: number) => {
    const el = inputs.current[index]
    if (!el) return
    el.focus()
    // Select so typing over a filled box replaces its digit.
    requestAnimationFrame(() => el.select())
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => focusBox(focusTargetFor(digitsRef.current, 0)),
      clear: () => {
        setDigits(emptyCode())
        onChange?.("")
        requestAnimationFrame(() => focusBox(0))
      },
    }),
    [focusBox, onChange, setDigits],
  )

  useEffect(() => {
    if (autoFocus) focusBox(0)
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commit = (change: CodeChange, fromTyping: boolean) => {
    const before = codeFromDigits(digitsRef.current)
    setDigits(change.digits)
    const code = codeFromDigits(change.digits)
    if (code !== before) onChange?.(code)
    focusBox(change.focus)
    if (fromTyping && code !== before && isCodeComplete(change.digits)) onComplete?.(code)
  }

  const handleChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // The box held one digit; whatever is new is everything except it.
    const previous = digitsRef.current[index]
    const typed = raw.length > 1 && previous && raw.includes(previous) && raw.length === 2 ? raw.replace(previous, "") : raw
    if (!typed) {
      commit(applyCodeDelete(digitsRef.current, index), false)
      return
    }
    commit(applyCodeInput(digitsRef.current, index, typed), true)
  }

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      commit(applyCodeBackspace(digitsRef.current, index), false)
      return
    }
    if (e.key === "Delete") {
      e.preventDefault()
      commit(applyCodeDelete(digitsRef.current, index), false)
      return
    }
    const target = moveCodeFocus(e.key, index)
    if (target !== null) {
      e.preventDefault()
      focusBox(target)
    }
  }

  const handlePaste = (index: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    commit(applyCodeInput(digitsRef.current, index, e.clipboardData.getData("text")), true)
  }

  const handleFocus = (index: number) => () => {
    const target = focusTargetFor(digitsRef.current, index)
    if (target !== index) focusBox(target)
    else requestAnimationFrame(() => inputs.current[index]?.select())
  }

  const describedBy = error ? errorId : undefined

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className="space-y-2"
      >
        <p id={labelId} className={cn("text-sm font-medium text-foreground", error && "text-destructive")}>
          {label}
        </p>
        <div
          key={errorKey}
          data-code-shake={error ? "true" : undefined}
          className="grid grid-cols-6 gap-2 sm:gap-2.5"
          dir="ltr"
        >
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el
              }}
              id={i === 0 ? id : `${id}-${i}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              enterKeyHint={i === CODE_LENGTH - 1 ? "done" : "next"}
              aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              value={digits[i]}
              disabled={disabled}
              onChange={handleChange(i)}
              onKeyDown={handleKeyDown(i)}
              onPaste={handlePaste(i)}
              onFocus={handleFocus(i)}
              data-filled={digits[i] ? "true" : undefined}
              className={cn(
                "auth-code-box h-14 w-full min-w-0 rounded-xl border bg-background text-center text-2xl font-semibold tabular-nums text-foreground caret-primary shadow-xs outline-none",
                "transition-[border-color,box-shadow,background-color] duration-150",
                "border-input dark:bg-input/30",
                "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25",
                "data-[filled=true]:border-primary/60 data-[filled=true]:bg-primary/[0.04]",
                "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            />
          ))}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {error ? (typeof error === "string" ? error : "") : (status ?? "")}
      </p>
    </div>
  )
}
