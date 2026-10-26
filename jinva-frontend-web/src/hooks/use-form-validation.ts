"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * V1–V8 (google-signup-prefill, design-spec §1): the one validation behaviour
 * every auth form shares. The form owns its values and its rules; this hook
 * owns *when* errors show, where focus goes, and what is announced.
 *
 * Timing (§1.4, decided once for all forms):
 * - nothing shows while a fresh field is typed in;
 * - leaving a field runs its **format** rules only (`mode: "blur"`): an empty
 *   field is not an error yet;
 * - submit runs everything (`mode: "submit"`), shows every error at once,
 *   focuses the first in DOM order and announces the count;
 * - a field already showing an error re-validates on every change (any value
 *   change, so a field that depends on another — confirm password, Region on
 *   the phone country — follows too) and clears the moment it is valid;
 * - a server error (`setServerError`, V5) stays until *that* field changes.
 */
export type ValidationMode = "blur" | "submit"

export interface UseFormValidationOptions<F extends string> {
  /** Every validated field, in DOM / visual order (two-up rows: left, right). */
  fields: readonly F[]
  /**
   * The form's current values, keyed by field. Only used to notice which
   * fields changed between renders, compared with `Object.is`. Include any
   * extra input a rule depends on (e.g. the phone country) under its own key.
   */
  values: Readonly<Record<string, unknown>>
  /** The field's message, or `null` when valid. Read the form's current state. */
  validate: (field: F, mode: ValidationMode) => string | null
  /** Short field names for blur announcements ("Phone number: Enter …"). */
  labels: Readonly<Record<F, string>>
  /**
   * The element to focus for a field. Defaults to `document.getElementById(field)`.
   * Point it at the number input for a phone, the first checkbox for a group.
   */
  focusTarget?: (field: F) => HTMLElement | null
}

type Flag = "client" | "server"

export function fieldsNeedFixingMessage(count: number): string {
  return count === 1 ? "1 field needs fixing." : `${count} fields need fixing.`
}

export function useFormValidation<F extends string>({
  fields,
  values,
  validate,
  labels,
  focusTarget,
}: UseFormValidationOptions<F>) {
  const [errors, setErrorsState] = useState<Partial<Record<F, string>>>({})
  const [announcement, setAnnouncement] = useState("")

  const errorsRef = useRef(errors)
  const flags = useRef(new Map<F, Flag>())
  const submitted = useRef(false)
  const prevValues = useRef(values)
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Latest closures, so the change effect below never validates stale state.
  const validateRef = useRef(validate)
  validateRef.current = validate
  const focusTargetRef = useRef(focusTarget)
  focusTargetRef.current = focusTarget

  const commit = useCallback((next: Partial<Record<F, string>>) => {
    errorsRef.current = next
    setErrorsState(next)
  }, [])

  /** Polite, via the form's single live region. Re-announces identical text. */
  const announce = useCallback((message: string) => {
    if (announceTimer.current) clearTimeout(announceTimer.current)
    setAnnouncement("")
    announceTimer.current = setTimeout(() => setAnnouncement(message), 50)
  }, [])

  useEffect(
    () => () => {
      if (announceTimer.current) clearTimeout(announceTimer.current)
    },
    [],
  )

  const focusField = useCallback((field: F) => {
    requestAnimationFrame(() => {
      const el = focusTargetRef.current?.(field) ?? document.getElementById(field)
      if (!el) return
      el.focus({ preventScroll: true })
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" })
    })
  }, [])

  // Re-validate flagged fields whenever a value changes.
  useEffect(() => {
    const prev = prevValues.current
    prevValues.current = values
    if (prev === values) return
    const changed = new Set(Object.keys(values).filter((key) => !Object.is(prev[key], values[key])))
    if (changed.size === 0 || flags.current.size === 0) return

    const mode: ValidationMode = submitted.current ? "submit" : "blur"
    let next: Partial<Record<F, string>> | null = null
    for (const [field, flag] of flags.current) {
      if (flag === "server" && !changed.has(field)) continue
      const message = validateRef.current(field, mode)
      if (message === errorsRef.current[field]) continue
      next ??= { ...errorsRef.current }
      if (message) {
        next[field] = message
        flags.current.set(field, "client")
      } else {
        delete next[field]
        flags.current.delete(field)
      }
    }
    if (next) commit(next)
  })

  /** Call from a field's `onBlur` (format rules only). */
  const handleBlur = useCallback(
    (field: F) => {
      if (flags.current.get(field) === "server") return
      const message = validateRef.current(field, submitted.current ? "submit" : "blur")
      const current = errorsRef.current[field]
      if (message === current || (!message && !current)) return
      const next = { ...errorsRef.current }
      if (message) {
        next[field] = message
        flags.current.set(field, "client")
        announce(`${labels[field]}: ${message}`)
      } else {
        delete next[field]
        flags.current.delete(field)
      }
      commit(next)
    },
    [announce, commit, labels],
  )

  /**
   * Shows the given fields' errors without focusing or announcing (e.g. a
   * Google name already over the limit when the page loads, §1.4).
   */
  const validateFields = useCallback(
    (only: readonly F[], mode: ValidationMode = "blur") => {
      const next = { ...errorsRef.current }
      for (const field of only) {
        const message = validateRef.current(field, mode)
        if (message) {
          next[field] = message
          flags.current.set(field, "client")
        } else {
          delete next[field]
          flags.current.delete(field)
        }
      }
      commit(next)
    },
    [commit],
  )

  /** Submit: validates every field. Returns `true` when the form may be sent. */
  const validateAll = useCallback((): boolean => {
    submitted.current = true
    const next: Partial<Record<F, string>> = {}
    flags.current.clear()
    for (const field of fields) {
      const message = validateRef.current(field, "submit")
      if (message) {
        next[field] = message
        flags.current.set(field, "client")
      }
    }
    commit(next)
    const invalid = fields.filter((field) => next[field])
    if (invalid.length === 0) return true
    announce(fieldsNeedFixingMessage(invalid.length))
    focusField(invalid[0])
    return false
  }, [announce, commit, fields, focusField])

  /** V5: a server error about one field, shown on it until it changes. */
  const setServerError = useCallback(
    (field: F, message: string) => {
      flags.current.set(field, "server")
      commit({ ...errorsRef.current, [field]: message })
      announce(`${labels[field]}: ${message}`)
      focusField(field)
    },
    [announce, commit, focusField, labels],
  )

  /** Drops a field's error (e.g. the field was hidden). */
  const clearError = useCallback(
    (field: F) => {
      if (!(field in errorsRef.current)) return
      flags.current.delete(field)
      const next = { ...errorsRef.current }
      delete next[field]
      commit(next)
    },
    [commit],
  )

  return {
    errors,
    announcement,
    announce,
    handleBlur,
    validateAll,
    validateFields,
    setServerError,
    clearError,
    focusField,
  }
}
