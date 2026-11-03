import { ApiError, apiFetch } from "@/lib/api"
import type { SetupProfileFacts, VerificationFact } from "@/lib/artisan-setup"

/**
 * Reads the facts the setup checklist is derived from, with the endpoints the
 * rest of the app already uses (no setup-only endpoint and no saved flag):
 * the artisan profile, the weekly hours and the latest identity check. The
 * photo comes from the signed-in user (`user.avatar`), which the photo card
 * refreshes after an upload.
 *
 * Any failure rejects: a checklist built on a missing answer would tell a
 * set-up artisan they still have work to do.
 */

export interface SetupSlot {
  id: number
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface SetupProfile extends SetupProfileFacts {
  id: string
}

export interface LoadedSetupFacts {
  profile: SetupProfile
  slots: SetupSlot[]
  verification: VerificationFact
}

const VERIFICATION_STATES: readonly VerificationFact[] = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]

/** `GET /verification/me?ifNone=null`: null (or a 404 on an older API) means nothing was ever sent. */
export async function loadVerificationFact(): Promise<VerificationFact> {
  try {
    const v = await apiFetch<{ status?: string } | null>("/verification/me?ifNone=null", { cache: "no-store" })
    if (!v) return "none"
    const status = String(v.status ?? "")
    if ((VERIFICATION_STATES as readonly string[]).includes(status)) return status as VerificationFact
    throw new Error("Unknown verification status")
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return "none"
    throw err
  }
}

export async function loadSetupFacts(): Promise<LoadedSetupFacts> {
  const [profile, availability] = await Promise.all([
    apiFetch<SetupProfile>("/users/me/artisan-profile", { cache: "no-store" }),
    apiFetch<{ slots?: SetupSlot[] }>("/availability/my", { cache: "no-store" }),
  ])
  // Already verified: the check itself needn't be read.
  const verification = profile.isVerified ? "APPROVED" : await loadVerificationFact()
  return { profile, slots: Array.isArray(availability?.slots) ? availability.slots : [], verification }
}
