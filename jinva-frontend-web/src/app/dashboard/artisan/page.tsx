"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CalendarDays, ListChecks, Search } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { ApplyJobDialog } from "@/components/dashboard/apply-job-dialog"
import { useBookingResponse } from "@/components/artisan/booking-response"
import { BookingRequests } from "@/components/dashboard/overview/booking-requests"
import { OpenJobsList, type OpenJobsState } from "@/components/dashboard/overview/open-jobs-list"
import { StageStrip } from "@/components/dashboard/overview/stage-strip"
import {
  ArtisanRail,
  RailAppointments,
  RailArtisanActions,
  RailEarnings,
  type ArtisanRailStates,
} from "@/components/dashboard/overview/artisan-rail"
import type { RailSectionState } from "@/components/dashboard/overview/rail-section"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import {
  ARTISAN_STAGES,
  artisanActionRows,
  artisanJobsHref,
  artisanStopLabel,
  artisanSummary,
  formatGhs,
  type ArtisanOverview,
  type ArtisanOverviewSection,
  type BookingRequest,
  type ArtisanVerificationNeed,
} from "@/lib/artisan-overview"
import { getArtisanBookings, getArtisanOverview, getOpenJobs, type OpenJob } from "@/lib/artisan-overview-api"
import { isAbortError, isRateLimited, retryAfter } from "@/lib/customer-api"
import { ProfileCompleteness, type ProfileCompletenessSource } from "@/components/artisan/profile-completeness"
import { SetupCard } from "@/components/dashboard/overview/setup-card"
import { SETUP_CARD_HIDDEN_KEY, deriveSetup, type VerificationFact } from "@/lib/artisan-setup"
import { loadVerificationFact, type SetupProfile, type SetupSlot } from "@/lib/artisan-setup-api"

/** The overview refetches on focus at most this often (same as the customer rail). */
const REFRESH_MS = 30_000
const OPEN_JOBS_COUNT = 5

type OverviewState =
  | { kind: "loading" }
  | { kind: "error"; rateLimited: boolean }
  | { kind: "ready"; data: ArtisanOverview }

export default function ArtisanDashboard() {
  return (
    <DashboardLayout>
      <OverviewContent />
    </DashboardLayout>
  )
}

/**
 * Artisan Overview (H3): "what needs me now". Booking requests to answer,
 * today's and the next appointment, jobs by stage, earnings, disputes that
 * need a response, then open jobs to apply for. Everything except open jobs
 * comes from `GET /artisans/me/overview`; a section that failed there shows
 * its own error while the rest still render.
 */
function OverviewContent() {
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())

  // ── B1 overview ────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewState>({ kind: "loading" })
  const abortRef = useRef<AbortController | null>(null)
  const lastFetch = useRef(0)
  const rateTimer = useRef<number | undefined>(undefined)

  const load = useCallback((showSkeleton: boolean) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    lastFetch.current = Date.now()
    if (showSkeleton) setOverview({ kind: "loading" })
    getArtisanOverview(ctrl.signal)
      .then((data) => {
        setOverview({ kind: "ready", data })
        setNow(new Date())
      })
      .catch((err) => {
        if (isAbortError(err)) return
        if (isRateLimited(err)) {
          setOverview((prev) => (prev.kind === "ready" && !showSkeleton ? prev : { kind: "error", rateLimited: true }))
          window.clearTimeout(rateTimer.current)
          rateTimer.current = window.setTimeout(
            () => setOverview((prev) => (prev.kind === "error" ? { kind: "error", rateLimited: false } : prev)),
            retryAfter(err) * 1000,
          )
          return
        }
        setOverview((prev) => (prev.kind === "ready" && !showSkeleton ? prev : { kind: "error", rateLimited: false }))
      })
  }, [])

  // ── Agreed prices of pending requests (so Accept can be one tap) ──────────
  const [prices, setPrices] = useState<Map<number, string | null>>(new Map())
  const loadPrices = useCallback(() => {
    getArtisanBookings({ status: "PENDING", limit: 100 })
      .then((rows) => setPrices(new Map(rows.map((b) => [b.id, b.agreedPrice != null ? String(b.agreedPrice) : null]))))
      .catch(() => setPrices(new Map()))
  }, [])

  // ── Open jobs ──────────────────────────────────────────────────────────────
  const [openJobs, setOpenJobs] = useState<OpenJobsState>({ kind: "loading" })
  const [appliedNow, setAppliedNow] = useState<Set<number>>(new Set())
  const [applyTarget, setApplyTarget] = useState<OpenJob | null>(null)
  const loadOpenJobs = useCallback(() => {
    setOpenJobs({ kind: "loading" })
    getOpenJobs(OPEN_JOBS_COUNT)
      .then(({ items, total }) => setOpenJobs({ kind: "ready", items: items.slice(0, OPEN_JOBS_COUNT), total }))
      .catch(() => setOpenJobs({ kind: "error" }))
  }, [])

  // C2.3: the hidden-from-search banner. Stays null if the fetch fails.
  const [completeness, setCompleteness] = useState<ProfileCompletenessSource | null>(null)
  // "Get verified" in Needs your action: only when no documents were sent or
  // the last ones were turned down. In review, verified or unknown → no row.
  const [verificationNeed, setVerificationNeed] = useState<ArtisanVerificationNeed>(null)

  // "Finish setting up": the same facts the setup checklist is derived from.
  // Stays null if any of them didn't load, so the card never nags on a guess.
  const [setupFacts, setSetupFacts] = useState<{
    profile: SetupProfile
    slots: SetupSlot[]
    verification: VerificationFact
  } | null>(null)
  // "Hide" lasts for this browser session; the card is back next time while steps remain.
  const [setupHidden, setSetupHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(SETUP_CARD_HIDDEN_KEY) === "1"
    } catch {
      return false
    }
  })
  const hideSetup = useCallback(() => {
    setSetupHidden(true)
    try {
      window.sessionStorage.setItem(SETUP_CARD_HIDDEN_KEY, "1")
    } catch {
      // Storage blocked: hidden until the page is reloaded.
    }
    document.getElementById("overview-title")?.focus()
  }, [])

  useEffect(() => {
    load(true)
    loadPrices()
    loadOpenJobs()
    apiFetch<SetupProfile>("/users/me/artisan-profile")
      .then(async (profile) => {
        setCompleteness(profile)
        // `ifNone=null`: nothing ever sent comes back as 200 with `data: null`
        // rather than a 404 the browser would log as an error. A 404 (an
        // older backend) is still read the same way.
        const verification: VerificationFact | null =
          profile.isVerified !== false ? "APPROVED" : await loadVerificationFact().catch(() => null)
        setVerificationNeed(verification === "none" ? "none" : verification === "REJECTED" ? "rejected" : null)
        const slots = await apiFetch<{ slots?: SetupSlot[] }>("/availability/my")
          .then((a) => (Array.isArray(a?.slots) ? a.slots : []))
          .catch(() => null)
        if (verification && slots) setSetupFacts({ profile, slots, verification })
      })
      .catch(() => {})
    const refresh = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - lastFetch.current < REFRESH_MS) return
      load(false)
      loadPrices()
    }
    // The reply countdowns move on while the page is open.
    const tick = window.setInterval(() => setNow(new Date()), 60_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      window.clearInterval(tick)
      abortRef.current?.abort()
      window.clearTimeout(rateTimer.current)
    }
  }, [load, loadPrices, loadOpenJobs])

  const retry = useCallback(() => load(true), [load])

  // ── Accept / Decline ───────────────────────────────────────────────────────
  const dropRequest = useCallback((id: number) => {
    setOverview((prev) => {
      if (prev.kind !== "ready" || !prev.data.pendingRequests) return prev
      const items = prev.data.pendingRequests.items.filter((r) => r.bookingId !== id)
      if (items.length === prev.data.pendingRequests.items.length) return prev
      return {
        kind: "ready",
        data: { ...prev.data, pendingRequests: { total: Math.max(0, prev.data.pendingRequests.total - 1), items } },
      }
    })
  }, [])

  const { accept, decline, respondingId, dialogs } = useBookingResponse({
    onAccepted: (id) => {
      dropRequest(id)
      // The accepted booking becomes a job to start and may be today's appointment.
      load(false)
    },
    onDeclined: dropRequest,
  })

  const toTarget = (r: BookingRequest) => ({
    id: r.bookingId,
    clientName: r.clientName,
    agreedPrice: prices.has(r.bookingId) ? prices.get(r.bookingId) : undefined,
  })

  // ── Setup card ─────────────────────────────────────────────────────────────
  const setupState = useMemo(
    () => (setupFacts ? deriveSetup({ ...setupFacts, hasPhoto: Boolean(user?.avatar) }) : null),
    [setupFacts, user?.avatar],
  )
  const showSetupCard = setupState != null && !setupState.allDone && !setupHidden

  // ── Section states ─────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    type S<T> = RailSectionState<T>
    if (overview.kind !== "ready") {
      const s = overview.kind === "loading" ? ({ kind: "loading" } as const) : overview
      return {
        requests: s as S<NonNullable<ArtisanOverview["pendingRequests"]>>,
        counts: s as S<NonNullable<ArtisanOverview["stageCounts"]>>,
        rail: { actions: s, appointments: s, earnings: s } as ArtisanRailStates,
      }
    }
    const d = overview.data
    const failed = (k: ArtisanOverviewSection) => d.failedSections.includes(k)
    const err = { kind: "error", rateLimited: false } as const
    const requestsOk = d.pendingRequests && !failed("pendingRequests")
    const earningsOk = d.earnings && !failed("earnings")
    const disputesOk = d.disputesNeedingResponse != null && !failed("disputes")
    const bookingsOk = !failed("bookings") && d.todayBookings != null
    const partial = !requestsOk || !earningsOk || !disputesOk
    return {
      requests: requestsOk ? { kind: "ready" as const, data: d.pendingRequests! } : err,
      counts: d.stageCounts && !failed("stageCounts") ? { kind: "ready" as const, data: d.stageCounts } : err,
      rail: {
        actions:
          !requestsOk && !earningsOk && !disputesOk
            ? err
            : {
                kind: "ready",
                data: {
                  requests: requestsOk ? d.pendingRequests!.total : null,
                  disputes: disputesOk ? d.disputesNeedingResponse : null,
                  earnings: earningsOk ? d.earnings : null,
                  verification: verificationNeed,
                  setupCard: showSetupCard,
                  partial,
                },
              },
        appointments: bookingsOk
          ? { kind: "ready", data: { today: d.todayBookings ?? [], next: d.nextBooking ?? null } }
          : err,
        earnings: earningsOk ? { kind: "ready", data: d.earnings! } : err,
      } satisfies ArtisanRailStates,
    }
  }, [overview, verificationNeed, showSetupCard])

  if (!user) return null

  const counts = sections.counts.kind === "ready" ? sections.counts.data : null
  const requestTotal = sections.requests.kind === "ready" ? sections.requests.data.total : null
  const todayCount = sections.rail.appointments.kind === "ready" ? sections.rail.appointments.data.today.length : null
  const showActionsCard =
    sections.rail.actions.kind === "error" ||
    (sections.rail.actions.kind === "ready" &&
      (artisanActionRows(sections.rail.actions.data).length > 0 || sections.rail.actions.data.partial))

  const stops = ARTISAN_STAGES.map((s) => {
    const count = counts ? counts[s.key] : null
    return {
      key: s.stage,
      label: s.label,
      count,
      href: artisanJobsHref(s.stage),
      ariaLabel: artisanStopLabel(s.label, count),
      aside: s.stage === "closed",
    }
  })

  return (
    <div className="w-full max-w-[1600px] min-[1600px]:p-2">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] min-[1600px]:grid-cols-[minmax(0,1fr)_360px] min-[1600px]:gap-8">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <header data-enter className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1
                id="overview-title"
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight text-foreground outline-none sm:text-[1.75rem]"
              >
                Welcome back, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {overview.kind === "loading" ? "Loading your work…" : artisanSummary(counts, requestTotal, todayCount)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <Button className="h-11 sm:h-9" asChild>
                <Link href="/dashboard/artisan/jobs">
                  <Search aria-hidden className="h-4 w-4" />
                  Find jobs
                </Link>
              </Button>
              <Button variant="outline" className="h-11 bg-transparent sm:h-9" asChild>
                <Link href="/dashboard/artisan/calendar">
                  <CalendarDays aria-hidden className="h-4 w-4" />
                  Calendar
                </Link>
              </Button>
            </div>
          </header>

          {showSetupCard ? (
            <SetupCard
              state={setupState}
              payoutWaiting={
                overview.kind === "ready" &&
                overview.data.earnings &&
                !overview.data.earnings.hasPayoutMethod &&
                overview.data.earnings.needsActionCount > 0
                  ? formatGhs(overview.data.earnings.needsAction)
                  : null
              }
              onHide={hideSetup}
            />
          ) : (
            // The setup card already says when they're not in search.
            <ProfileCompleteness variant="compact" profile={completeness} actionLabel="Finish my profile" />
          )}

          {showActionsCard && (
            <div className="xl:hidden">
              <RailArtisanActions state={sections.rail.actions} layout="cards" onRetry={retry} />
            </div>
          )}

          <BookingRequests
            state={sections.requests}
            prices={prices}
            now={now}
            respondingId={respondingId}
            onAccept={(r) => accept(toTarget(r))}
            onDecline={(r) => decline(toTarget(r))}
            onRetry={retry}
          />

          <div className="xl:hidden">
            <RailAppointments state={sections.rail.appointments} layout="cards" now={now} onRetry={retry} />
          </div>

          <section aria-labelledby="stages-label" data-enter style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
            <div className="mb-2 flex min-h-6 flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <h2 id="stages-label" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <ListChecks aria-hidden className="h-4 w-4 text-muted-foreground" />
                Your jobs
              </h2>
              {sections.counts.kind === "loading" ? (
                <span aria-hidden className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
              ) : sections.counts.kind === "error" ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
                  <span>{sections.counts.rateLimited ? "Too many requests, please wait a moment" : "Couldn't load job counts."}</span>
                  {!sections.counts.rateLimited && (
                    <button
                      type="button"
                      onClick={retry}
                      className="inline-flex min-h-11 items-center rounded font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0 dark:focus-visible:ring-ring"
                    >
                      Try again
                    </button>
                  )}
                </p>
              ) : (
                <p className="text-sm tabular-nums text-muted-foreground">
                  {sections.counts.data.total} {sections.counts.data.total === 1 ? "job" : "jobs"} in total
                </p>
              )}
            </div>
            <StageStrip stops={stops} loading={sections.counts.kind === "loading"} labelledBy="stages-label" />
            {counts && counts.applied > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ve applied to {counts.applied} open {counts.applied === 1 ? "job" : "jobs"} that{" "}
                {counts.applied === 1 ? "is" : "are"} waiting for the client to choose.
              </p>
            )}
          </section>

          <OpenJobsList
            state={openJobs}
            applied={appliedNow}
            onApply={setApplyTarget}
            onRetry={loadOpenJobs}
          />

          <div className="xl:hidden">
            <RailEarnings state={sections.rail.earnings} layout="cards" onRetry={retry} />
          </div>
        </div>

        <ArtisanRail layout="rail" states={sections.rail} now={now} onRetry={retry} className="hidden xl:block" />
      </div>

      {dialogs}
      <ApplyJobDialog
        job={applyTarget}
        open={applyTarget != null}
        onOpenChange={(open) => !open && setApplyTarget(null)}
        onApplied={(id) => setAppliedNow((prev) => new Set(prev).add(Number(id)))}
      />
    </div>
  )
}
