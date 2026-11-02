import { redirect } from "next/navigation"

export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * `target` plus the query the old URL carried, for routes that moved: a
 * bookmarked `/dashboard/artisan/analytics?range=6m` lands on
 * `/dashboard/artisan/earnings?tab=analytics&range=6m`. The target's own
 * parameters (its `tab`) win over an incoming one of the same name. The
 * browser keeps any `#fragment` across the redirect by itself.
 */
export function withQuery(target: string, incoming: Record<string, string | string[] | undefined>): string {
  const [path, own = ""] = target.split("?")
  const params = new URLSearchParams(own)
  for (const [key, value] of Object.entries(incoming)) {
    if (params.has(key) || value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export async function redirectWithQuery(target: string, searchParams: PageSearchParams): Promise<never> {
  redirect(withQuery(target, await searchParams))
}
