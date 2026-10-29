"use client"

import type React from "react"
import { Label } from "@/components/ui/label"
import { FieldError } from "@/components/ui/field"
import { cn } from "@/lib/utils"

/**
 * V2/V7/V8 (google-signup-prefill, design-spec §1.1–§1.3, §1.6): one field's
 * label, control and message slot.
 *
 * The control is rendered by `children`, which receives the props that wire it
 * to the label and the message: spread them onto the input / SelectTrigger /
 * number input. The message slot shows the helper **or** the error, never
 * both; an error replaces the helper and carries its own icon.
 */
export interface FieldControlProps {
  id: string
  "aria-invalid"?: true
  "aria-describedby"?: string
}

export const fieldHintId = (id: string) => `${id}-hint`
export const fieldErrorId = (id: string) => `${id}-error`

/** `aria-invalid` + `aria-describedby` for a control (design-spec §1.6). */
export function fieldControlProps(
  id: string,
  { error, hint, describedBy }: { error?: React.ReactNode; hint?: React.ReactNode; describedBy?: string } = {},
): FieldControlProps {
  const ids = [error ? fieldErrorId(id) : hint ? fieldHintId(id) : null, describedBy].filter(Boolean)
  return {
    id,
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(ids.length ? { "aria-describedby": ids.join(" ") } : {}),
  }
}

/** The label: `/signup`'s style, destructive while the field is in error. */
export function FormFieldLabel({
  htmlFor,
  invalid,
  optional,
  children,
  className,
  as = "label",
}: {
  htmlFor?: string
  invalid?: boolean
  optional?: boolean
  children: React.ReactNode
  className?: string
  /** `"legend"` for a `<fieldset>` group (services). */
  as?: "label" | "legend"
}) {
  // Inline text (not the Label's flex gap) so a long label wraps with its
  // "(optional)" suffix instead of leaving it stranded in a second column.
  const content = (
    <>
      {children}
      {optional && <span className="font-normal"> (optional)</span>}
    </>
  )
  const classes = cn(
    "text-sm text-muted-foreground",
    optional && "block leading-snug",
    invalid && "text-destructive",
    className,
  )
  if (as === "legend") {
    return <legend className={cn("flex items-center gap-2 font-medium leading-none mb-2", classes)}>{content}</legend>
  }
  return (
    <Label htmlFor={htmlFor} className={classes}>
      {content}
    </Label>
  )
}

/** The single message slot under a control. `aside` stays visible on the right (the bio counter). */
export function FormFieldMessage({
  id,
  hint,
  error,
  aside,
}: {
  id: string
  hint?: React.ReactNode
  error?: React.ReactNode
  aside?: React.ReactNode
}) {
  if (!error && !hint && !aside) return null
  return (
    <div className="flex items-start justify-between gap-3">
      {error ? (
        <FieldError id={fieldErrorId(id)}>{error}</FieldError>
      ) : hint ? (
        <p id={fieldHintId(id)} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : (
        <span />
      )}
      {aside}
    </div>
  )
}

export interface FormFieldProps {
  id: string
  label: React.ReactNode
  optional?: boolean
  hint?: React.ReactNode
  error?: React.ReactNode
  /** Extra ids for `aria-describedby` (e.g. `bio-count`). */
  describedBy?: string
  aside?: React.ReactNode
  className?: string
  children: (control: FieldControlProps) => React.ReactNode
}

export function FormField({ id, label, optional, hint, error, describedBy, aside, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-2 scroll-mt-24", className)}>
      <FormFieldLabel htmlFor={id} invalid={!!error} optional={optional}>
        {label}
      </FormFieldLabel>
      {children(fieldControlProps(id, { error, hint, describedBy }))}
      <FormFieldMessage id={id} hint={hint} error={error} aside={aside} />
    </div>
  )
}

/**
 * The form's one polite live region (§1.6): the error count on submit, a
 * blur error, combobox and country-picker announcements.
 */
export function FormAnnouncer({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  )
}

/** Input classes shared by `/signup` and "Complete your account" (LY1). */
export const AUTH_INPUT_CLASS = "h-10 bg-background border-input text-foreground"

/**
 * §3.9 fix 3: Radix `SelectTrigger`'s own `data-[size=default]:h-9` and `w-fit`
 * beat a plain `h-10`, so triggers rendered 36px and content-width.
 */
export const AUTH_SELECT_TRIGGER_CLASS = "w-full data-[size=default]:h-10 bg-background border-input text-foreground"
