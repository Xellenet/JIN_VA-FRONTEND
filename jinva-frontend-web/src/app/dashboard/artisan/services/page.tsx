import { redirectWithQuery, type PageSearchParams } from "@/lib/redirect-with-query"

/** Services is a tab of Profile now (the shop front). Old links and bookmarks land there, query string kept. */
export default async function ServicesRedirect({ searchParams }: { searchParams: PageSearchParams }) {
  return redirectWithQuery("/dashboard/artisan/profile?tab=services", searchParams)
}
