import { redirectWithQuery, type PageSearchParams } from "@/lib/redirect-with-query"

/** Portfolio is a tab of Profile now (the shop front). Old links and bookmarks land there, query string kept. */
export default async function PortfolioRedirect({ searchParams }: { searchParams: PageSearchParams }) {
  return redirectWithQuery("/dashboard/artisan/profile?tab=portfolio", searchParams)
}
