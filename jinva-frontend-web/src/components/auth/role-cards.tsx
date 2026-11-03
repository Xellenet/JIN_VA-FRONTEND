"use client"

import type React from "react"
import { useRef } from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SelfSignupRole } from "@/lib/signup-flow"

/**
 * Auth v2 step 1: the two roles as large cards with radio semantics. Arrow keys
 * move between them and select, as in any radio group; Tab enters the group on
 * the chosen card (or the first one) and leaves it in one press.
 *
 * The chosen card is marked three ways — the ring, a tick, and `aria-checked`
 * read out as "selected" — so it never depends on colour.
 *
 * Auth redesign: each card carries one of JinVa's own photos; it lifts on
 * hover and its ring settles in with a popping check (auth-motion.css).
 */

const ROLES: readonly {
  value: SelfSignupRole
  title: string
  body: string
  photo: string
}[] = [
  { value: "CUSTOMER", title: "I need work done", body: "Post jobs, book artisans and pay safely.", photo: "/portfolio/job-kitchen-sink.jpg" },
  { value: "ARTISAN", title: "I offer a service", body: "Get booked, get paid to MoMo or bank.", photo: "/artisan-in-orange-vest.jpg" },
]

export function RoleCards({
  id,
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid,
  disabled,
  compact,
}: {
  id: string
  value: SelfSignupRole | null
  onChange: (role: SelfSignupRole) => void
  labelledBy: string
  describedBy?: string
  invalid?: boolean
  disabled?: boolean
  /** Side by side on wider screens (Complete your account). */
  compact?: boolean
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = ROLES.findIndex((r) => r.value === value)

  const onKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const delta =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0
    if (delta) {
      e.preventDefault()
      const next = (index + delta + ROLES.length) % ROLES.length
      onChange(ROLES[next].value)
      refs.current[next]?.focus()
      return
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault()
      onChange(ROLES[index].value)
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      aria-required="true"
      className={cn("grid gap-3", compact && "sm:grid-cols-2")}
    >
      {ROLES.map((role, i) => {
        const checked = role.value === value
        const tabbable = checked || (selected === -1 && i === 0)
        return (
          <button
            key={role.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={i === 0 ? `${id}-first` : `${id}-${role.value.toLowerCase()}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            data-role-card
            onClick={() => onChange(role.value)}
            onKeyDown={onKeyDown(i)}
            className={cn(
              "group relative flex w-full items-center gap-3.5 rounded-2xl border bg-card p-3 text-left min-[980px]:p-4",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30",
              "hover:border-foreground/25",
              checked ? "border-primary shadow-[0_0_0_0.5px_var(--primary)]" : "border-border",
              invalid && !checked && "border-destructive/60",
              disabled && "opacity-60",
            )}
          >
            <Image
              src={role.photo}
              alt=""
              width={112}
              height={112}
              sizes="56px"
              draggable={false}
              className="size-12 shrink-0 rounded-[0.875rem] object-cover object-[center_25%] min-[980px]:size-14"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-foreground min-[980px]:text-[1.0625rem]">{role.title}</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{role.body}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-[1.375rem] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                checked ? "border-primary bg-primary text-primary-foreground dark:text-background" : "border-input bg-card",
              )}
            >
              {checked ? (
                <span data-role-tick className="flex">
                  <Check className="h-3 w-3" strokeWidth={3.4} />
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
