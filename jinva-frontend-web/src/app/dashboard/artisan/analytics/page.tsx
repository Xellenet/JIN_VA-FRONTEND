import { redirectWithQuery, type PageSearchParams } from "@/lib/redirect-with-query"

/** Analytics is a tab of Earnings now. Old links and bookmarks land there, query string kept. */
export default async function AnalyticsRedirect({ searchParams }: { searchParams: PageSearchParams }) {
  return redirectWithQuery("/dashboard/artisan/earnings?tab=analytics", searchParams)
}
