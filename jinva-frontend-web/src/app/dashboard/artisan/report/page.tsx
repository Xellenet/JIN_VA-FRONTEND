import { redirectWithQuery, type PageSearchParams } from "@/lib/redirect-with-query"

/**
 * C2: this route used to show sample figures. An artisan's real statement
 * (what clients paid, the fee, the payout and where it is) is on Earnings, so
 * old links and bookmarks go there, query string kept.
 */
export default async function ReportPage({ searchParams }: { searchParams: PageSearchParams }) {
  return redirectWithQuery("/dashboard/artisan/earnings", searchParams)
}
