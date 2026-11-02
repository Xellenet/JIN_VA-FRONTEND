/**
 * Requests behind the artisan Overview and Calendar (artisan fixes H3, H4).
 * Same rules as `customer-api.ts`: `no-store`, an optional AbortSignal, query
 * strings from typed values only, ids checked before they go into a path.
 */
import { apiFetch, apiFetchWithMeta } from "@/lib/api"
import { safeId, type ArtisanOverview } from "@/lib/artisan-overview"

const NO_STORE = { cache: "no-store" as const }

/** B1 `GET /artisans/me/overview`. */
export async function getArtisanOverview(signal?: AbortSignal): Promise<ArtisanOverview> {
  const data = await apiFetch<ArtisanOverview>("/artisans/me/overview", { ...NO_STORE, signal })
  return { ...data, failedSections: Array.isArray(data?.failedSections) ? data.failedSections : [] }
}

/** An OPEN job as the artisan's job list returns it (with B4 `hasApplied`). */
export interface OpenJob {
  id: number
  title: string
  location?: string | null
  budgetMin?: string | number | null
  budgetMax?: string | number | null
  createdAt: string
  deadline?: string | null
  status: string
  hasApplied?: boolean
  service?: { id: number; name: string } | null
}

/** The newest OPEN jobs, and how many there are in total. */
export async function getOpenJobs(limit: number, signal?: AbortSignal): Promise<{ items: OpenJob[]; total: number }> {
  const params = new URLSearchParams({ status: "OPEN", page: "1", limit: String(Math.min(50, Math.max(1, limit))) })
  const { data, meta } = await apiFetchWithMeta<OpenJob[] | { items?: OpenJob[] }>(`/jobs?${params}`, {
    ...NO_STORE,
    signal,
  })
  const items = (Array.isArray(data) ? data : (data?.items ?? [])).filter((j) => j.status === "OPEN")
  const pagination = meta?.pagination as { total?: unknown } | undefined
  const total = typeof pagination?.total === "number" ? pagination.total : items.length
  return { items, total }
}

/** A booking as `GET /bookings/artisan` and `GET /bookings/:id` return it. */
export interface ArtisanBookingRecord {
  id: number
  scheduledDate: string
  startTime: string
  endTime: string
  status: string
  notes?: string | null
  artisanNotes?: string | null
  agreedPrice?: string | number | null
  currency?: string
  jobId?: number | null
  noShowByCustomerAt?: string | null
  noShowByArtisanAt?: string | null
  createdAt?: string
  customer?: { id: number; firstname: string; lastname: string; profilePicture?: string | null } | null
  service?: { id: number; name: string; price?: string | number | null } | null
}

/** My bookings, newest date first (max 100 per request, the server's cap). */
export async function getArtisanBookings(
  opts: { status?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ArtisanBookingRecord[]> {
  const params = new URLSearchParams({ page: "1", limit: String(Math.min(100, Math.max(1, opts.limit ?? 100))) })
  if (opts.status && /^[A-Z_]+$/.test(opts.status)) params.set("status", opts.status)
  const data = await apiFetch<ArtisanBookingRecord[] | { items?: ArtisanBookingRecord[] }>(`/bookings/artisan?${params}`, {
    ...NO_STORE,
    signal,
  })
  return Array.isArray(data) ? data : (data?.items ?? [])
}

export async function getBooking(id: number, signal?: AbortSignal): Promise<ArtisanBookingRecord> {
  const n = safeId(id)
  if (!n) throw new Error("Booking not found.")
  return apiFetch<ArtisanBookingRecord>(`/bookings/${n}`, { ...NO_STORE, signal })
}

/** A job I'm on, reduced to what the Calendar needs to link a booking to it. */
export interface BookingJobLink {
  id: number
  bookingId?: number | null
  location?: string | null
  status: string
}

/**
 * Jobs created from my confirmed bookings (to start or in progress), so each
 * booking can show its job's location and link to it. Bookings themselves
 * carry neither.
 */
export async function getBookingJobs(signal?: AbortSignal): Promise<BookingJobLink[]> {
  const load = (status: string) =>
    apiFetch<BookingJobLink[] | { items?: BookingJobLink[] }>(
      `/jobs?${new URLSearchParams({ status, page: "1", limit: "50" })}`,
      { ...NO_STORE, signal },
    ).then((d) => (Array.isArray(d) ? d : (d?.items ?? [])))
  const lists = await Promise.all([load("PENDING"), load("IN_PROGRESS"), load("COMPLETED")])
  return lists.flat().filter((j) => safeId(j.bookingId) !== null)
}
