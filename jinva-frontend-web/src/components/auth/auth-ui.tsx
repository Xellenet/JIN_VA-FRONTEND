"use client"

import type React from "react"
import { useRef } from "react"
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AUTH_INPUT_CLASS, type FieldControlProps } from "@/components/forms/form-field"

/**
 * Auth v2: the small pieces every auth screen shares, so sign-up, login,
 * forgot password, verify email and "Complete your account" keep one rhythm:
 * a 2rem heading, 15px body, 44px controls, one primary action.
 */

export const AUTH_PRIMARY_BUTTON_CLASS =
  "h-11 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
export const AUTH_SECONDARY_BUTTON_CLASS =
  "h-11 w-full rounded-lg border border-input bg-background text-base font-normal text-foreground hover:bg-accent hover:text-accent-foreground"
/** Text links; 44px tall on phones (inline-flex keeps them in the sentence). */
export const AUTH_LINK_CLASS =
  "font-medium text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground max-sm:inline-flex max-sm:min-h-11 max-sm:items-center"

/** The page's single h1 and its one-line lead. */
export function AuthHeading({
  title,
  description,
  headingRef,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Focused after a step change, so screen readers land on the new step. */
  headingRef?: React.Ref<HTMLHeadingElement>
}) {
  return (
    <div className="space-y-2">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground outline-none sm:text-[2rem]"
      >
        {title}
      </h1>
      {description ? <div className="text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</div> : null}
    </div>
  )
}

/**
 * "Step 2 of 3", with the three named steps beneath a bar. A real sequence, so
 * the numbering carries information; the current step is also given in text,
 * never by the bar's colour alone.
 */
export function StepIndicator({
  steps,
  current,
}: {
  steps: readonly string[]
  /** 1-based. */
  current: number
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Step {current} of {steps.length}</span>
        <span aria-hidden="true"> · </span>
        <span>{steps[current - 1]}</span>
      </p>
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Sign-up steps">
        {steps.map((label, i) => {
          const state = i + 1 < current ? "done" : i + 1 === current ? "current" : "upcoming"
          return (
            <li key={label} className="min-w-0">
              <span className="block h-1 overflow-hidden rounded-full bg-muted">
                <span
                  data-step-bar
                  className="block h-full origin-left rounded-full bg-primary"
                  style={{ transform: `scaleX(${state === "upcoming" ? 0 : 1})` }}
                />
              </span>
              <span className="sr-only">
                {label}
                {state === "done" ? ", done" : state === "current" ? ", current step" : ", not started"}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** A password field with a show/hide button that is a real, reachable 44px control. */
export function PasswordInput({
  control,
  value,
  onChange,
  onBlur,
  autoComplete,
  enterKeyHint,
  disabled,
  visible,
  onVisibleChange,
  extraProps,
}: {
  control: FieldControlProps
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  autoComplete: "new-password" | "current-password"
  enterKeyHint?: "next" | "done" | "go" | "send"
  disabled?: boolean
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  extraProps?: Record<string, string>
}) {
  return (
    <div className="relative">
      <Input
        {...control}
        {...extraProps}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={cn(AUTH_INPUT_CLASS, "pr-12")}
        required
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => onVisibleChange(!visible)}
        // Keep focus (and the caret) in the field while toggling.
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        aria-pressed={visible}
        aria-controls={control.id}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Google's sign-in, as a full-page navigation (the backend route 302s to Google). */
export function GoogleButton({
  onClick,
  disabled,
  children = "Continue with Google",
}: {
  onClick: () => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled} className={AUTH_SECONDARY_BUTTON_CLASS}>
      <svg className="h-5 w-5 text-foreground/70" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {children}
    </Button>
  )
}

export function OrDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  )
}

/** A primary submit with its own spinner; the label changes, so status is never colour or motion alone. */
export function SubmitButton({
  busy,
  busyLabel,
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  busy?: boolean
  busyLabel: string
  children: React.ReactNode
  disabled?: boolean
  type?: "submit" | "button"
  onClick?: () => void
}) {
  return (
    <Button type={type} onClick={onClick} className={AUTH_PRIMARY_BUTTON_CLASS} disabled={busy || disabled}>
      {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {busy ? busyLabel : children}
    </Button>
  )
}

const NOTICE_TONES = {
  info: { icon: Info, className: "border-info/30 bg-info/10" },
  warning: { icon: TriangleAlert, className: "border-warning/30 bg-warning/10" },
  error: { icon: AlertCircle, className: "border-destructive/30 bg-destructive/10" },
  success: { icon: CheckCircle2, className: "border-success/30 bg-success/10" },
} as const

/** A banner with an icon and a heading-weight first line, so its meaning never rests on the tint. */
export function AuthNotice({
  tone,
  title,
  children,
  role,
  noticeRef,
}: {
  tone: keyof typeof NOTICE_TONES
  title?: React.ReactNode
  children?: React.ReactNode
  role?: "alert" | "status"
  noticeRef?: React.Ref<HTMLDivElement>
}) {
  const { icon: Icon, className } = NOTICE_TONES[tone]
  return (
    <div
      ref={noticeRef}
      role={role}
      tabIndex={noticeRef ? -1 : undefined}
      data-auth-reveal
      className={cn("flex gap-3 rounded-xl border p-3.5 text-sm text-foreground outline-none", className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  )
}

/** The success moment: a ring and tick that draw themselves (still, with reduced motion). */
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <span className={cn("auth-check-bloom inline-flex rounded-full bg-success/10 p-2 text-success", className)}>
      <svg viewBox="0 0 52 52" className="h-12 w-12" fill="none" aria-hidden="true">
        <circle className="auth-check-ring" cx="26" cy="26" r="24" stroke="currentColor" strokeWidth="2.5" />
        <path
          className="auth-check-tick"
          d="M15 27l7.5 7.5L37.5 19"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/**
 * A two-option segmented control with radio semantics (arrow keys move and
 * select, like the role cards). Used by login: "Password" | "Email me a code".
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (index + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="relative grid rounded-xl bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        data-segment-thumb
        className="absolute inset-y-1 left-1 rounded-lg bg-background shadow-sm ring-1 ring-border/60"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option, i) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 min-h-11 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 sm:min-h-10",
              checked ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** An "Add a middle name"-style text button that reveals something. */
export function RevealButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 sm:min-h-9"
    >
      {children}
    </button>
  )
}

/** Focus an element by id once the next step has rendered. */
export function focusById(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus())
}
