"use client"

import Link from "next/link"
import { CheckCircle2, Circle, EyeOff } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * C2 — the artisan's self-view "why am I not in search?" indicator.
 *
 * One component behind all three surfaces the design spec places it on
 * (design-spec.md §3.1): the full checklist card on the Profile page, and the
 * compact alert on the dashboard overview and Settings → Account. Labels,
 * copy and fix destinations live here once so the three placements can't
 * drift apart.
 *
 * It is deliberately presentational: every surface already fetches
 * `GET /users/me/artisan-profile` for its own reasons, so the page owns the
 * data (and, critically, re-feeds it from the `PATCH` response so the
 * indicator updates without a second GET — api-contract.md, C2's
 * `PATCH /users/me/artisan-profile` section).
 */

/** The four keys `computeProfileCompleteness()` can report (api-contract.md C2). */
const FIELD_ORDER = ["bio", "hourlyRate", "location", "services"] as const

type KnownFieldKey = (typeof FIELD_ORDER)[number]

interface FieldCopy {
  /** Row label — artisan-facing, never the raw backend key. */
  label: string
  /** Sub-line: what the customer uses this for. */
  why: string
  /** Row action label. */
  actionLabel: string
  /** Where the artisan fixes it. */
  href: string
  /**
   * The `id` of the real input on `/dashboard/artisan/profile`. Present only
   * for fields edited on that page — the Profile page passes `onFixField` and
   * these rows then scroll to and focus the input instead of navigating.
   */
  anchorId?: string
  /** How the field reads inside the compact variant's one-line prose. */
  phrase: string
}

const FIELD_COPY: Record<KnownFieldKey, FieldCopy> = {
  bio: {
    label: "About you",
    why: "A short description of your work and experience",
    actionLabel: "Add",
    href: "/dashboard/artisan/profile#bio",
    anchorId: "bio",
    phrase: "a short bio",
  },
  hourlyRate: {
    label: "Hourly rate",
    why: "Your starting rate in GH₵ — customers filter on price",
    actionLabel: "Add",
    href: "/dashboard/artisan/profile#hourlyRate",
    anchorId: "hourlyRate",
    phrase: "an hourly rate",
  },
  location: {
    label: "Service area",
    why: "The town or area you work in, so nearby customers find you",
    actionLabel: "Add",
    href: "/dashboard/artisan/profile#location",
    anchorId: "location",
    phrase: "your service area",
  },
  services: {
    label: "At least one service",
    why: "The trades you offer, e.g. Plumbing or Electrical",
    actionLabel: "Choose services",
    href: "/dashboard/artisan/services",
    phrase: "at least one service",
  },
}

/**
 * api-contract.md asks us to treat `missingFields` as open-ended: a future
 * required field must still be counted, with a humanized label and no action
 * link, so the count never silently under-reports.
 */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z\d])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export type ProfileCompletenessState = "unknown" | "complete" | "incomplete"

/** The two fields of `ArtisanProfileResponseDto` this component reads. */
export interface ProfileCompletenessSource {
  isProfileComplete?: boolean
  missingFields?: string[]
}

/**
 * The one place "am I allowed to say anything about search visibility?" is
 * decided.
 *
 * `isProfileComplete === false` with an absent or empty `missingFields` means
 * **unknown**, never "incomplete" (design-spec.md §3.5): that is exactly the
 * shape the endpoint returned before the C2.1 fix, and a fail-loud reading of
 * it would accuse a fully set-up artisan of being invisible. A disagreement
 * between the two fields (complete-but-missing, or incomplete-with-nothing-
 * missing) is a backend defect per api-contract.md and is also treated as
 * unknown here — silence is strictly better than a false accusation in one
 * direction or a false reassurance in the other.
 */
export function readProfileCompleteness(
  source: ProfileCompletenessSource | null | undefined,
): { state: ProfileCompletenessState; missingFields: string[] } {
  const missingFields = source?.missingFields
  if (!source || !Array.isArray(missingFields)) return { state: "unknown", missingFields: [] }

  const missing = missingFields.filter((key) => typeof key === "string" && key.length > 0)

  if (source.isProfileComplete === true && missing.length === 0) return { state: "complete", missingFields: [] }
  if (source.isProfileComplete === false && missing.length > 0) return { state: "incomplete", missingFields: missing }

  return { state: "unknown", missingFields: [] }
}

const NUMBER_WORDS = ["", "One", "Two", "Three", "Four"]

/**
 * design-spec.md §3.3: the compact variant's body is prose, not a list, and it
 * degrades — enumerating four items in a one-line banner is what the full card
 * exists for.
 */
function compactProse(missing: string[]): string {
  const phrases = missing.map((key) =>
    key in FIELD_COPY ? FIELD_COPY[key as KnownFieldKey].phrase : humanizeKey(key).toLowerCase(),
  )

  if (phrases.length === 1) return `One thing is missing: ${phrases[0]}.`
  if (phrases.length === 2) return `Two things are missing: ${phrases[0]} and ${phrases[1]}.`

  const count = NUMBER_WORDS[phrases.length] ?? String(phrases.length)
  return `${count} things are missing before customers can find you.`
}

interface ProfileCompletenessProps {
  variant: "card" | "compact"
  /** The profile response (or the fields off it). `null` while unloaded/failed. */
  profile: ProfileCompletenessSource | null | undefined
  /**
   * Card variant: shows a Skeleton in the card's slot. Compact variant:
   * renders nothing — never flash "you're invisible in search" into a page
   * before the data has arrived.
   */
  isLoading?: boolean
  /** Compact variant only. */
  actionLabel?: string
  /**
   * Card variant, Profile page only: scroll to and focus the real input with
   * this `id` on the current page instead of navigating to it. Rows whose
   * field isn't edited on this page (services) always navigate.
   */
  onFixField?: (anchorId: string) => void
}

export function ProfileCompleteness({
  variant,
  profile,
  isLoading = false,
  actionLabel = "Finish my profile",
  onFixField,
}: ProfileCompletenessProps) {
  if (isLoading) {
    // design-spec.md §3.5: Skeleton in the shape the card is about to become
    // on the Profile page; nothing at all for the compact variant.
    return variant === "card" ? <Skeleton className="h-56 w-full rounded-xl" /> : null
  }

  const { state, missingFields } = readProfileCompleteness(profile)

  // Complete → no "well done" panel to dismiss; the positive signal is the
  // Profile hero's "Visible in search" badge (§3.4). Unknown → nothing.
  if (state !== "incomplete") return null

  if (variant === "compact") {
    return (
      <Alert className="border-warning/30">
        <EyeOff className="h-4 w-4 text-warning" />
        <AlertTitle>Your profile isn&apos;t showing in search yet</AlertTitle>
        <AlertDescription>
          <p>{compactProse(missingFields)}</p>
          <Button size="sm" variant="outline" className="mt-2 bg-transparent" asChild>
            <Link href="/dashboard/artisan/profile">{actionLabel}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Missing items first in the fixed order, then the done ones — completed
  // rows stay listed because "2 of 4" is meaningless without them (§3.2).
  const unknownKeys = missingFields.filter((key) => !(key in FIELD_COPY))
  const orderedKeys: string[] = [
    ...FIELD_ORDER.filter((key) => missingFields.includes(key)),
    ...unknownKeys,
    ...FIELD_ORDER.filter((key) => !missingFields.includes(key)),
  ]
  const total = FIELD_ORDER.length + unknownKeys.length
  const done = total - missingFields.length

  return (
    <Card className="border-warning/30">
      <div className="border-b border-warning/30 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2">
              <EyeOff className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Your profile isn&apos;t showing in search yet</h3>
              <p className="text-sm text-muted-foreground">Customers can&apos;t find you until these are filled in.</p>
            </div>
          </div>
          <Badge variant="outline" className="border-warning/20 bg-warning/10 text-warning">
            {done} of {total} done
          </Badge>
        </div>
      </div>
      <CardContent className="space-y-3 p-6">
        {orderedKeys.map((key) => {
          const copy = key in FIELD_COPY ? FIELD_COPY[key as KnownFieldKey] : null
          const isMissing = missingFields.includes(key)
          const anchorId = copy?.anchorId

          return (
            <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
              <div className="flex items-start gap-3">
                {isMissing ? (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                )}
                <div>
                  <p className="font-medium">{copy?.label ?? humanizeKey(key)}</p>
                  {copy && <p className="text-sm text-muted-foreground">{copy.why}</p>}
                </div>
              </div>

              {!isMissing && (
                <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  Done
                </Badge>
              )}
              {isMissing && copy && (
                anchorId && onFixField ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 bg-transparent"
                    onClick={() => onFixField(anchorId)}
                  >
                    {copy.actionLabel}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="shrink-0 bg-transparent" asChild>
                    <Link href={copy.href}>{copy.actionLabel}</Link>
                  </Button>
                )
              )}
              {/* An unknown key still counts, but has nowhere to send them. */}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/**
 * §3.4: the permanent, glanceable search-visibility signal in the Profile
 * hero, beside the existing Available/Busy badge. Both states carry a text
 * label — nothing here is signalled by colour alone. Renders nothing while the
 * state is unknown, for the same reason the card does.
 */
export function SearchVisibilityBadge({ profile }: { profile: ProfileCompletenessSource | null | undefined }) {
  const { state } = readProfileCompleteness(profile)
  if (state === "unknown") return null

  const isVisible = state === "complete"
  return (
    <Badge
      variant="outline"
      className={
        isVisible
          ? "border-success/20 bg-success/10 text-success"
          : "border-warning/20 bg-warning/10 text-warning"
      }
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {isVisible ? "Visible in search" : "Not in search"}
    </Badge>
  )
}
