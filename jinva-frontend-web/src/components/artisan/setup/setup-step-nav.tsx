"use client"

import { Check } from "lucide-react"
import type { SetupState, SetupStepKey, SetupView } from "@/lib/artisan-setup"
import { cn } from "@/lib/utils"

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

/** The numbered disc, or a check once the step is done. */
function StepMark({ index, done, active, size }: { index: number; done: boolean; active: boolean; size: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors duration-200 motion-reduce:transition-none",
        size === "lg" ? "h-11 w-11" : "h-7 w-7 text-xs",
        done
          ? "border-transparent bg-primary text-primary-foreground"
          : active
            ? "border-primary bg-background text-foreground ring-2 ring-primary/20"
            : "border-border bg-background text-muted-foreground",
      )}
    >
      {done ? <Check className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} strokeWidth={3} /> : index + 1}
    </span>
  )
}

function stepAriaLabel(index: number, title: string, done: boolean): string {
  return `Step ${index + 1}: ${title}, ${done ? "done" : "to do"}`
}

/**
 * Desktop: the six steps as a list, each with its state in an icon and in
 * words, and what's saved (or missing) underneath. The open step carries
 * `aria-current="step"`.
 */
export function SetupStepList({
  state,
  view,
  onSelect,
}: Readonly<{ state: SetupState; view: SetupView; onSelect: (key: SetupStepKey) => void }>) {
  return (
    <nav aria-label="Setup steps">
      <ol className="space-y-1">
        {state.steps.map((step, i) => {
          const active = view === step.key
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 motion-reduce:transition-none",
                  active ? "bg-muted" : "hover:bg-muted/60",
                  FOCUS_RING,
                )}
              >
                <StepMark index={i} done={step.done} active={active} size="md" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm text-foreground", active ? "font-semibold" : "font-medium")}>
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    <span className={cn("font-medium", step.done ? "text-success" : "text-foreground/70")}>
                      {step.done ? "Done" : "To do"}:
                    </span>{" "}
                    {step.detail}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Phones: six 44px discs on a line, the open one ringed, done ones checked.
 * Each says its number, title and state to assistive tech.
 */
export function SetupStepper({
  state,
  view,
  onSelect,
}: Readonly<{ state: SetupState; view: SetupView; onSelect: (key: SetupStepKey) => void }>) {
  return (
    <nav aria-label="Setup steps">
      <ol className="relative flex items-center justify-between">
        <span aria-hidden="true" className="absolute inset-x-5 top-1/2 h-px -translate-y-1/2 bg-border" />
        {state.steps.map((step, i) => {
          const active = view === step.key
          return (
            <li key={step.key} className="relative">
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={active ? "step" : undefined}
                aria-label={stepAriaLabel(i, step.title, step.done)}
                className={cn("block rounded-full", FOCUS_RING)}
              >
                <StepMark index={i} done={step.done} active={active} size="lg" />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
