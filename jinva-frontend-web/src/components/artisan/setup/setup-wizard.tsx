"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, ArrowLeft, Check, Circle, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AboutTab, type BackendArtisanProfile } from "@/components/artisan/profile/about-tab"
import { ServicesTab, type ServicesProfileUpdate } from "@/components/artisan/profile/services-tab"
import { WorkingHoursCard, type ApiSlot } from "@/components/artisan/calendar/calendar-hours"
import { PayoutMethodCard } from "@/components/settings/payout-method-card"
import { VerificationTab } from "@/components/artisan/settings/verification-tab"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import {
  PURPOSE_LABELS,
  SETUP_STEPS,
  deriveSetup,
  nextView,
  previousStep,
  progressLabel,
  resumeView,
  searchLine,
  stepIndex,
  type SetupFacts,
  type SetupState,
  type SetupStepKey,
  type SetupView,
  type VerificationFact,
} from "@/lib/artisan-setup"
import { loadSetupFacts, type LoadedSetupFacts, type SetupProfile } from "@/lib/artisan-setup-api"
import { cn } from "@/lib/utils"
import { CheckDraw } from "./check-draw"
import { SetupAreaStep } from "./setup-area-step"
import { SetupProgress } from "./setup-progress"
import { SetupStepList, SetupStepper } from "./setup-step-nav"

const OVERVIEW_HREF = "/dashboard/artisan"

/** Steps that save through their own controls: how, in one line. */
const SAVE_NOTES: Partial<Record<SetupStepKey, string>> = {
  hours: "Hours save as soon as you add or switch them.",
  payout: "Save the payout method below, then continue.",
  verify: "Send your documents below, then continue.",
}

/** Steps whose fields sit in one form: the step's primary button submits it. */
const FORM_IDS: Partial<Record<SetupStepKey, string>> = {
  services: "setup-services-form",
  area: "setup-area-form",
  profile: "setup-profile-form",
}

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; facts: LoadedSetupFacts; loadedAt: number }

/** The fields a save response actually carries, so a partial one never blanks the rest. */
function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

/**
 * /dashboard/artisan/setup: six short steps, each a focused screen around the
 * component that already does the job elsewhere (Profile, Calendar,
 * Settings). Progress is derived from the artisan's real data on every load
 * (`deriveSetup`), never stored, so it is the same on any device. Each step
 * saves on its own; "Finish later" goes to the Overview.
 */
export function SetupWizard() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [load, setLoad] = useState<LoadState>({ kind: "loading" })
  const [view, setView] = useState<SetupView | null>(null)
  const [busy, setBusy] = useState(false)
  /** The view the "You now appear in search" moment showed up on. */
  const [momentView, setMomentView] = useState<SetupView | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusOnChange = useRef(false)

  const fetchFacts = useCallback(() => {
    setLoad({ kind: "loading" })
    loadSetupFacts()
      .then((facts) => setLoad({ kind: "ready", facts, loadedAt: Date.now() }))
      .catch(() => setLoad({ kind: "error" }))
  }, [])

  useEffect(() => {
    fetchFacts()
  }, [fetchFacts])

  const facts: SetupFacts | null = useMemo(
    () =>
      load.kind === "ready"
        ? {
            profile: load.facts.profile,
            hasPhoto: Boolean(user?.avatar),
            slots: load.facts.slots,
            verification: load.facts.verification,
          }
        : null,
    [load, user?.avatar],
  )
  const state = useMemo(() => (facts ? deriveSetup(facts) : null), [facts])

  // Opening /setup: the `?step=` asked for, else the first unfinished step,
  // else the completion view. Decided once, so finishing a step doesn't move
  // the screen under the artisan.
  useEffect(() => {
    if (!state || view !== null) return
    setView(resumeView(state, searchParams.get("step")))
  }, [state, view, searchParams])

  // The "You now appear in search" moment: only on a real change seen here,
  // from not listed to listed, as the backend reports it.
  const lastVisible = useRef<boolean | null | undefined>(undefined)
  useEffect(() => {
    if (!state) return
    const was = lastVisible.current
    lastVisible.current = state.searchVisible
    if (was === false && state.searchVisible === true) setMomentView(view)
  }, [state, view])

  // Moving between steps lands focus on the new step's heading.
  useEffect(() => {
    if (!focusOnChange.current) return
    focusOnChange.current = false
    headingRef.current?.focus()
  }, [view])

  const goTo = useCallback(
    (next: SetupView) => {
      focusOnChange.current = true
      setBusy(false)
      setView(next)
      setMomentView((m) => (m === next ? m : null))
      const params = new URLSearchParams(searchParams.toString())
      params.set("step", next)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      document.querySelector("main")?.scrollTo({ top: 0 })
    },
    [pathname, router, searchParams],
  )

  // ── Writes from the embedded components ──────────────────────────────────
  const update = useCallback((change: (f: LoadedSetupFacts) => LoadedSetupFacts) => {
    setLoad((prev) => (prev.kind === "ready" ? { ...prev, facts: change(prev.facts) } : prev))
  }, [])

  const mergeProfile = useCallback(
    (saved: Partial<SetupProfile> | ServicesProfileUpdate | BackendArtisanProfile) =>
      update((f) => ({ ...f, profile: { ...f.profile, ...definedOnly(saved as Partial<SetupProfile>) } })),
    [update],
  )

  /** A form step saved: take the response, then go on to what's left. */
  const savedAndContinue = useCallback(
    (current: SetupStepKey, saved: Partial<SetupProfile>) => {
      if (load.kind !== "ready") return
      const profile = { ...load.facts.profile, ...definedOnly(saved) }
      mergeProfile(saved)
      const after = deriveSetup({
        profile,
        hasPhoto: Boolean(user?.avatar),
        slots: load.facts.slots,
        verification: load.facts.verification,
      })
      goTo(nextView(after, current))
    },
    [goTo, load, mergeProfile, user?.avatar],
  )

  const setSlots = useCallback(
    (fn: (prev: ApiSlot[]) => ApiSlot[]) => update((f) => ({ ...f, slots: fn(f.slots as ApiSlot[]) })),
    [update],
  )

  const refreshProfile = useCallback(() => {
    apiFetch<SetupProfile>("/users/me/artisan-profile", { cache: "no-store" })
      .then((p) => mergeProfile(p))
      .catch(() => {})
  }, [mergeProfile])

  const setVerification = useCallback(
    (status: VerificationFact) => update((f) => ({ ...f, verification: status })),
    [update],
  )

  if (!user) return null

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Set up your business</h1>
        {state ? (
          <div className="mt-2 space-y-4">
            <p className="text-sm text-muted-foreground sm:text-base" aria-live="polite">
              <span className="font-medium text-foreground tabular-nums">{progressLabel(state)}</span>
              {searchLine(state.searchVisible) && <>. {searchLine(state.searchVisible)}</>}
            </p>
            <SetupProgress state={state} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Six short steps. Each one saves on its own, so you can finish later.
          </p>
        )}
      </header>

      {load.kind === "loading" || (state && view === null) ? (
        <SetupSkeleton />
      ) : load.kind === "error" || !state || view === null ? (
        <div role="alert" className="mt-8 flex max-w-xl flex-col items-start gap-3 rounded-xl border bg-card p-5 sm:p-6">
          <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">Couldn&apos;t load your setup</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing has changed. Try again, or finish later.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="h-11 sm:h-9" onClick={fetchFacts}>
              Try again
            </Button>
            <Button variant="ghost" className="h-11 sm:h-9" asChild>
              <Link href={OVERVIEW_HREF}>Go to your overview</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-10">
          <aside className="hidden lg:sticky lg:top-4 lg:block">
            <SetupStepList state={state} view={view} onSelect={goTo} />
          </aside>
          <div className="lg:hidden">
            <SetupStepper state={state} view={view} onSelect={goTo} />
          </div>

          <div className="min-w-0">
            {momentView === view && state.searchVisible === true && (
              <SearchMoment onClose={() => setMomentView(null)} />
            )}

            {view === "done" ? (
              <DoneView state={state} headingRef={headingRef} onSelect={goTo} />
            ) : (
              <StepScreen
                key={view}
                stepKey={view}
                state={state}
                headingRef={headingRef}
                busy={busy}
                onBack={() => {
                  const prev = previousStep(view)
                  if (prev) goTo(prev)
                }}
                onContinue={() => goTo(nextView(state, view))}
              >
                {view === "services" && load.kind === "ready" && (
                  <div className="space-y-6">
                    <section aria-labelledby="setup-rate-title" className="rounded-xl border bg-card p-4 sm:p-5">
                      <h3 id="setup-rate-title" className="text-[15px] font-semibold text-foreground">
                        Your starting rate
                      </h3>
                      <p className="mt-1 mb-4 text-sm text-muted-foreground">
                        What you charge per hour. Clients see it on your profile and can filter by it.
                      </p>
                      <AboutTab
                        fields={["hourlyRate"]}
                        formId={FORM_IDS.services}
                        profile={load.facts.profile as unknown as BackendArtisanProfile}
                        loadState="ready"
                        loadedAt={load.loadedAt}
                        onReload={fetchFacts}
                        onSaved={(saved) => savedAndContinue("services", saved as unknown as Partial<SetupProfile>)}
                        onSavingChange={setBusy}
                      />
                    </section>
                    <ServicesTab onProfileChange={mergeProfile} />
                  </div>
                )}
                {view === "area" && load.kind === "ready" && (
                  <SetupAreaStep
                    formId={FORM_IDS.area!}
                    profile={load.facts.profile}
                    onSaved={(saved) => savedAndContinue("area", saved)}
                    onSavingChange={setBusy}
                  />
                )}
                {view === "profile" && load.kind === "ready" && (
                  <AboutTab
                    fields={["photo", "bio", "businessName"]}
                    formId={FORM_IDS.profile}
                    profile={load.facts.profile as unknown as BackendArtisanProfile}
                    loadState="ready"
                    loadedAt={load.loadedAt}
                    onReload={fetchFacts}
                    onSaved={(saved) => savedAndContinue("profile", saved as unknown as Partial<SetupProfile>)}
                    onSavingChange={setBusy}
                  />
                )}
                {view === "hours" && load.kind === "ready" && (
                  <WorkingHoursCard slots={load.facts.slots as ApiSlot[]} setSlots={setSlots} />
                )}
                {view === "payout" && <PayoutMethodCard onSaved={refreshProfile} />}
                {view === "verify" && <VerificationTab onSubmitted={setVerification} />}
              </StepScreen>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SetupSkeleton() {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]" aria-busy="true">
      <div className="hidden space-y-2 lg:block">
        {SETUP_STEPS.map((s) => (
          <Skeleton key={s.key} className="h-14 w-full rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-11 w-full rounded-full lg:hidden" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <span className="sr-only">Loading your setup</span>
    </div>
  )
}

/** Done or to do, in an icon and in words. */
function StepStatus({ done }: { done: boolean }) {
  return done ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      Done
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground/80">
      <Circle className="h-3.5 w-3.5" aria-hidden="true" />
      To do
    </span>
  )
}

function StepScreen({
  stepKey,
  state,
  headingRef,
  busy,
  onBack,
  onContinue,
  children,
}: {
  stepKey: SetupStepKey
  state: SetupState
  headingRef: React.RefObject<HTMLHeadingElement | null>
  busy: boolean
  onBack: () => void
  onContinue: () => void
  children: ReactNode
}) {
  const i = stepIndex(stepKey)
  const step = state.steps[i]
  const formId = FORM_IDS[stepKey]

  return (
    <section aria-labelledby="setup-step-title" data-swap="">
      <p className="text-sm text-muted-foreground tabular-nums">
        Step {i + 1} of {state.total}
      </p>
      <h2
        id="setup-step-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-1 text-xl font-semibold tracking-tight text-foreground outline-none sm:text-2xl"
      >
        {step.title}
      </h2>
      <p className="mt-2 max-w-[62ch] text-sm text-muted-foreground sm:text-base">{step.intro}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <StepStatus done={step.done} />
        <span className="text-muted-foreground">{PURPOSE_LABELS[step.purpose]}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Done when:</span> {step.doneWhen}
        {SAVE_NOTES[stepKey] && ` ${SAVE_NOTES[stepKey]}`}
      </p>

      <div className="mt-6">{children}</div>

      {/* Sticky so the step's actions stay in reach on long steps (the
          service catalogue). The negative bottom and extra padding cover
          <main>'s own bottom padding, so nothing scrolls by underneath. */}
      <div className="sticky -bottom-4 z-10 -mx-4 mt-8 border-t bg-background px-4 pt-3 pb-7 md:-bottom-6 md:-mx-6 md:px-6 md:pb-9">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          {i > 0 ? (
            <Button type="button" variant="outline" className="h-11 bg-transparent sm:h-10" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button type="button" variant="ghost" className={cn("h-11 sm:h-10", i === 0 && "col-span-2 sm:col-span-1")} asChild>
            <Link href={OVERVIEW_HREF}>Finish later</Link>
          </Button>
          {formId ? (
            <Button
              type="submit"
              form={formId}
              className="order-first col-span-2 h-11 sm:order-none sm:ml-auto sm:h-10"
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              Save and continue
            </Button>
          ) : (
            <Button
              type="button"
              variant={step.done ? "default" : "outline"}
              className={cn("order-first col-span-2 h-11 sm:order-none sm:ml-auto sm:h-10", !step.done && "bg-transparent")}
              onClick={onContinue}
            >
              {step.done ? "Continue" : "Skip for now"}
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

/** The calm "you're listed now" moment, shown once, where it happened. */
function SearchMoment({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      data-swap=""
      className="mb-6 flex items-start gap-4 rounded-xl border border-success/25 bg-success/[0.06] p-4 sm:p-5"
    >
      <CheckDraw className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">You now appear in search</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Clients looking for your services in your area can find you. The next steps help them choose and book you.
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mt-1 -mr-1 h-11 w-11 shrink-0"
        aria-label="Close this message"
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** After the last step: the completion state, or what's left. */
function DoneView({
  state,
  headingRef,
  onSelect,
}: {
  state: SetupState
  headingRef: React.RefObject<HTMLHeadingElement | null>
  onSelect: (key: SetupStepKey) => void
}) {
  const remaining = state.steps.filter((s) => !s.done)
  return (
    <section aria-labelledby="setup-step-title" data-swap="" className="max-w-2xl">
      {state.allDone ? (
        <>
          <CheckDraw className="h-14 w-14" />
          <h2
            id="setup-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 text-xl font-semibold tracking-tight text-foreground outline-none sm:text-2xl"
          >
            Your business is set up
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            All six steps are done. Clients can find you, book you and pay you. You can change any step here, or later
            in Profile, Calendar and Settings.
          </p>
        </>
      ) : (
        <>
          <h2
            id="setup-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight text-foreground outline-none sm:text-2xl"
          >
            {remaining.length === 1 ? "One step left" : `${remaining.length} steps left`}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Everything you saved is kept. Finish these whenever suits you.
          </p>
        </>
      )}

      <ul className="mt-6 divide-y rounded-xl border bg-card">
        {(state.allDone ? state.steps : remaining).map((step) => (
          <li key={step.key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            {step.done ? (
              <Check className="h-5 w-5 shrink-0 text-success" strokeWidth={3} aria-hidden="true" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
                {step.detail}
              </p>
            </div>
            <Button
              type="button"
              variant={step.done ? "ghost" : "outline"}
              className={cn("h-11 shrink-0 sm:h-9", !step.done && "bg-transparent")}
              onClick={() => onSelect(step.key)}
              aria-label={`${step.done ? "Change" : "Start"}: ${step.title}`}
            >
              {step.done ? "Change" : "Start"}
            </Button>
          </li>
        ))}
      </ul>

      <Button className="mt-6 h-11 sm:h-10" asChild>
        <Link href={OVERVIEW_HREF}>Go to your overview</Link>
      </Button>
    </section>
  )
}
