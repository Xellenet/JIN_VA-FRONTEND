import { redirectWithQuery, type PageSearchParams } from "@/lib/redirect-with-query"

/** Verification is a tab of Settings now. Old links and bookmarks land there, query string kept. */
export default async function VerificationRedirect({ searchParams }: { searchParams: PageSearchParams }) {
  return redirectWithQuery("/dashboard/artisan/settings?tab=verification", searchParams)
}
