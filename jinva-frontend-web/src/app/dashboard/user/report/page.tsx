import { redirect } from "next/navigation"

/**
 * This page used to show sample figures from `lib/data/mock-data` as if they
 * were real (the same problem as QA ADM-19). The real figures live on
 * My Bookings (spending is under Settings → Payments), so old links and bookmarks go there.
 */
export default function ReportPage() {
  redirect("/dashboard/user/bookings")
}
