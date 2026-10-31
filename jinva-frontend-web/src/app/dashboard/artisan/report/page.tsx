import { redirect } from "next/navigation"

/**
 * C2: this route used to show sample figures. An artisan's real statement
 * (what clients paid, the fee, the payout and where it is) is on Earnings, so
 * old links and bookmarks go there.
 */
export default function ReportPage() {
  redirect("/dashboard/artisan/earnings")
}
