"use client"

/**
 * Profile → Services: the services an artisan offers, picked from JinVa's
 * catalogue (was `/dashboard/artisan/services`, which now redirects here).
 */

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, CheckCircle2, Loader2, Plus, Search, Wrench } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { cn, formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import {
  readProfileCompleteness,
  type ProfileCompletenessSource,
} from "@/components/artisan/profile-completeness"

interface BackendService {
  id: string
  name: string
  description?: string
  /** Null, not absent, when no price is set — `GET /services` returns the column. */
  price?: number | null
}

// FE-3: `services` is one of the four fields the search gate reads, so both the
// add and remove responses carry the recomputed completeness (api-contract.md,
// C2) — the same two fields the profile and settings pages read off their own
// save responses.
interface ArtisanProfile extends ProfileCompletenessSource {
  id: string
  services?: { id: string; name: string }[]
}

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-ring"

type LoadState = "loading" | "error" | "ready"

/** What an add or remove changed, for the Profile page's header and checklist. */
export type ServicesProfileUpdate = ProfileCompletenessSource & { services?: { id: string; name: string }[] }

export function ServicesTab({ onProfileChange }: Readonly<{ onProfileChange?: (saved: ServicesProfileUpdate) => void }> = {}) {
  const [allServices, setAllServices] = useState<BackendService[]>([])
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [confirmRemove, setConfirmRemove] = useState<BackendService | null>(null)
  // FE-3: what the search gate said about this artisan *before* the next add.
  // Stays null if the profile fetch fails, which `readProfileCompleteness`
  // reads as "unknown" — and unknown never earns a visibility claim.
  const [completeness, setCompleteness] = useState<ProfileCompletenessSource | null>(null)

  const load = useCallback(() => {
    setLoadState("loading")
    Promise.all([
      apiFetch<BackendService[] | { items: BackendService[] }>("/services"),
      apiFetch<ArtisanProfile>("/users/me/artisan-profile"),
    ])
      .then(([servicesResult, profile]) => {
        const services = Array.isArray(servicesResult)
          ? servicesResult
          : (servicesResult as { items: BackendService[] }).items ?? []
        setAllServices(services)
        // String ids on both sides: the profile and the catalogue don't agree
        // on number vs string, and a Set compares by identity.
        setEnrolledIds(new Set(profile.services?.map((s) => String(s.id)) ?? []))
        setCompleteness({
          isProfileComplete: profile.isProfileComplete,
          missingFields: profile.missingFields,
        })
        setLoadState("ready")
      })
      .catch(() => setLoadState("error"))
  }, [])

  useEffect(() => { load() }, [load])

  const query = searchQuery.trim().toLowerCase()
  // P2: your services are always shown first and never hidden by the search —
  // the search only narrows the catalogue you're adding from.
  const myServices = allServices.filter((s) => enrolledIds.has(String(s.id)))
  const availableServices = allServices.filter(
    (s) =>
      !enrolledIds.has(String(s.id)) &&
      (!query ||
        s.name.toLowerCase().includes(query) ||
        (s.description ?? "").toLowerCase().includes(query)),
  )
  const notYetAddedCount = allServices.length - myServices.length

  const handleAdd = async (serviceId: string) => {
    setActionLoading(serviceId)
    // FE-3: read before the write, because the claim being made is about a
    // transition — "you are now findable" is only true if they weren't before.
    const wasIncomplete = readProfileCompleteness(completeness).state === "incomplete"
    try {
      const saved = await apiFetch<ArtisanProfile>(`/artisans/me/services/${serviceId}`, {
        method: "POST",
      })
      setEnrolledIds((prev) => new Set([...prev, String(serviceId)]))
      setCompleteness({
        isProfileComplete: saved.isProfileComplete,
        missingFields: saved.missingFields,
      })
      onProfileChange?.(saved)

      // Exactly one toast, never the ordinary one stacked with a second. The
      // visibility variant needs completeness to be *known* on both sides of
      // the write and to have actually flipped (C2: never guess whether
      // someone is in client search).
      const nowComplete = readProfileCompleteness(saved).state === "complete"
      toast.success(
        wasIncomplete && nowComplete
          ? "Service added. Clients can now find you in search."
          : "Service added to your profile.",
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the service. Try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async (serviceId: string) => {
    setActionLoading(serviceId)
    try {
      const saved = await apiFetch<ArtisanProfile>(`/artisans/me/services/${serviceId}`, {
        method: "DELETE",
      })
      setEnrolledIds((prev) => {
        const next = new Set(prev)
        next.delete(String(serviceId))
        return next
      })
      // Stored so that re-adding a service straight afterwards judges its
      // transition against the real state rather than a stale one.
      setCompleteness({
        isProfileComplete: saved.isProfileComplete,
        missingFields: saved.missingFields,
      })
      onProfileChange?.(saved)
      toast.success("Service removed from your profile.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the service. Try again.")
    } finally {
      setActionLoading(null)
    }
  }

  const removingLast = confirmRemove !== null && myServices.length === 1

  return (
    <>
      <div className="max-w-4xl space-y-6">
        <p className="max-w-[60ch] text-sm text-muted-foreground sm:text-base">
          The work you take on. Clients find you in search by these services.
        </p>

        {loadState === "loading" ? (
          <ListSkeleton />
        ) : loadState === "error" ? (
          <section
            aria-labelledby="services-error-title"
            className="flex flex-col items-start gap-3 rounded-xl border bg-card px-5 py-6 sm:px-6"
          >
            <AlertCircle aria-hidden className="h-6 w-6 text-destructive" />
            <div>
              <h2 id="services-error-title" className="font-semibold text-foreground">
                Couldn&apos;t load your services
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            </div>
            <Button variant="outline" className={cn(FOCUS_RING, "h-11 bg-transparent sm:h-9")} onClick={load}>
              Try again
            </Button>
          </section>
        ) : (
          <>
            {/* Your services — pinned first */}
            <section aria-labelledby="my-services-title" className="overflow-hidden rounded-xl border bg-card">
              <div className="flex min-h-[49px] items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                <h2 id="my-services-title" className="text-[15px] font-semibold text-foreground">
                  Your services
                </h2>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {myServices.length === 1 ? "1 service" : `${myServices.length} services`}
                </span>
              </div>
              {myServices.length === 0 ? (
                <div className="px-4 py-6 sm:px-5">
                  <p className="font-medium text-foreground">You don&apos;t offer any services yet</p>
                  <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">
                    Clients can&apos;t find you in search until you add at least one. Pick from the list below.
                  </p>
                </div>
              ) : (
                <ul className="divide-y">
                  {myServices.map((s) => (
                    <ServiceRow
                      key={s.id}
                      service={s}
                      enrolled
                      busy={actionLoading === String(s.id)}
                      disabled={actionLoading !== null}
                      onAction={() => setConfirmRemove(s)}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Catalogue to add from */}
            <section aria-labelledby="add-services-title" className="overflow-hidden rounded-xl border bg-card">
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <h2 id="add-services-title" className="text-[15px] font-semibold text-foreground">
                  Add a service
                  <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
                    {notYetAddedCount} available
                  </span>
                </h2>
                {notYetAddedCount > 0 && (
                  <div className="relative w-full sm:max-w-xs">
                    <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      aria-label="Search services to add"
                      placeholder="Search services"
                      className="h-11 pl-9 sm:h-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {notYetAddedCount === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
                  You offer every service on JinVa.
                </p>
              ) : availableServices.length === 0 ? (
                <div className="flex flex-col items-start gap-3 px-4 py-6 sm:px-5">
                  <p className="text-sm text-muted-foreground">
                    No services match &ldquo;<span className="text-foreground">{searchQuery.trim()}</span>&rdquo;.
                  </p>
                  <Button
                    variant="outline"
                    className={cn(FOCUS_RING, "h-11 bg-transparent sm:h-9")}
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                <ul className="divide-y">
                  {availableServices.map((s) => (
                    <ServiceRow
                      key={s.id}
                      service={s}
                      enrolled={false}
                      busy={actionLoading === String(s.id)}
                      disabled={actionLoading !== null}
                      onAction={() => handleAdd(String(s.id))}
                    />
                  ))}
                </ul>
              )}
            </section>

            <p className="text-sm text-muted-foreground">
              Typical starting prices are a guide for clients. You agree the final price with each client.
            </p>
          </>
        )}
      </div>

      <AlertDialog open={confirmRemove !== null} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmRemove?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingLast
                ? "This is your only service. Once it's removed, clients won't find you in search until you add a service again."
                : "Clients won't find you for this service any more. You can add it back at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9">Keep service</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-white hover:bg-destructive/90 sm:h-9"
              onClick={() => {
                if (confirmRemove) handleRemove(String(confirmRemove.id))
                setConfirmRemove(null)
              }}
            >
              Remove service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ServiceRow({
  service,
  enrolled,
  busy,
  disabled,
  onAction,
}: Readonly<{
  service: BackendService
  enrolled: boolean
  busy: boolean
  disabled: boolean
  onAction: () => void
}>) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
      <span
        aria-hidden
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          enrolled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {enrolled ? <CheckCircle2 className="h-5 w-5" /> : <Wrench className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{service.name}</p>
        {service.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-1">{service.description}</p>
        )}
        {/* `!= null` on purpose: the API returns `price: null` for a service
            with no set price. No price means no price line. P2: this is the
            catalogue's typical price, not one the artisan has set. */}
        {service.price != null && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Typical starting price{" "}
            <span className="tnum font-medium tabular-nums text-foreground">{formatCurrency(service.price)}</span>
          </p>
        )}
      </div>
      <Button
        variant="outline"
        aria-label={enrolled ? `Remove ${service.name}` : `Add ${service.name}`}
        disabled={disabled}
        onClick={onAction}
        className={cn(
          FOCUS_RING,
          "h-11 min-w-[5.5rem] shrink-0 bg-transparent sm:h-9",
          enrolled
            ? "text-muted-foreground hover:border-destructive/50 hover:text-destructive"
            : "border-primary/40 text-primary hover:bg-primary/5",
        )}
      >
        {busy ? (
          <Loader2 aria-hidden className="h-4 w-4 motion-safe:animate-spin" />
        ) : enrolled ? (
          "Remove"
        ) : (
          <>
            <Plus aria-hidden className="h-4 w-4" />
            Add
          </>
        )}
      </Button>
    </li>
  )
}

function ListSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3 sm:px-5">
        <Skeleton className="h-5 w-32" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      ))}
    </div>
  )
}
