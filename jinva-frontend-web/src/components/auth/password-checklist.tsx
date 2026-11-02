"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Circle, KeyRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PASSWORD_RULES_ATTRIBUTE, generateStrongPassword, passwordRuleStates } from "@/lib/password-rules"

/**
 * Sign-up form v2: the live new-password checklist, the "Passwords match" tick
 * and "Suggest a strong password". One set of components for /signup, reset
 * password and both Settings → Security forms; the rules come from
 * `@/lib/password-rules`, the same source as `validateNewPassword`.
 *
 * Nothing here is red: while typing the list only says what is done and what
 * is still needed. The form's own error (on blur or submit) stays as it was.
 */

/**
 * Spread onto every new-password `<input>` so browsers that read
 * `passwordrules` (Safari) only suggest a password we accept. Autocomplete is
 * left on; if a browser fills in something we don't accept, the checklist
 * shows what's missing.
 */
export const NEW_PASSWORD_INPUT_PROPS = { passwordrules: PASSWORD_RULES_ATTRIBUTE } as Record<string, string>

/** Announce the count only after typing pauses, and only when it changed. */
const ANNOUNCE_DELAY_MS = 700

export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  const rules = passwordRuleStates(password)
  const core = rules.filter((r) => r.id !== "allowed")
  const met = core.filter((r) => r.met).length
  const hasDisallowed = rules.some((r) => r.id === "allowed")

  const [announcement, setAnnouncement] = useState("")
  const lastAnnounced = useRef<string | null>(null)
  const summary = !password
    ? ""
    : met === core.length && !hasDisallowed
      ? "All password rules met."
      : `${met} of ${core.length} password rules met.${hasDisallowed ? " Use only letters, numbers and the listed symbols." : ""}`

  useEffect(() => {
    if (summary === lastAnnounced.current) return
    const timer = setTimeout(() => {
      lastAnnounced.current = summary
      setAnnouncement(summary)
    }, ANNOUNCE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [summary])

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <ul id={id} aria-label="Password rules" className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {rules.map((rule) => {
          const blocked = rule.id === "allowed"
          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-start gap-2 leading-snug",
                rule.met ? "text-foreground" : "text-muted-foreground",
                (blocked || rule.id === "symbol") && "sm:col-span-2",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  rule.met ? "bg-success text-success-foreground" : "border border-current",
                )}
              >
                {rule.met ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : blocked ? (
                  <X className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <Circle className="h-1 w-1 fill-current" />
                )}
              </span>
              <span>
                {rule.label}
                <span className="sr-only">{rule.met ? " — done" : blocked ? " — remove other characters" : " — still needed"}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Under the confirm field: a tick once it equals the password. */
export function PasswordMatch({ id, password, confirmation }: { id: string; password: string; confirmation: string }) {
  const matches = confirmation !== "" && confirmation === password
  return (
    <p id={id} role="status" aria-live="polite" className="flex min-h-4 items-center gap-2 text-xs text-foreground">
      {matches && (
        <>
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          Passwords match
        </>
      )}
    </p>
  )
}

/**
 * "Suggest a strong password": 16 characters from `crypto.getRandomValues`
 * that always pass our rule. The form fills both fields and turns "show" on;
 * this button then says to save it.
 */
export function SuggestPasswordButton({
  onSuggest,
  disabled,
}: {
  onSuggest: (password: string) => void
  disabled?: boolean
}) {
  const [suggested, setSuggested] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        className="h-11 sm:h-9"
        // Keep focus in the password field while pressing: blurring it shows
        // its error, which pushes this button down between mousedown and
        // mouseup, so the click landed nowhere after the user had typed.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onSuggest(generateStrongPassword())
          setSuggested(true)
        }}
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Suggest a strong password
      </Button>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {suggested ? "Save it in your password manager." : ""}
      </p>
    </div>
  )
}
