"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import {
  buildCustomerSearchHref,
  CUSTOMER_SEARCH_PATH,
  LOCATION_MAX_LENGTH,
  toCatalogueOptions,
  type CatalogueService,
} from "@/lib/landing-search"

/**
 * "What needs doing? / Where?" — submits to the customer search page with
 * `?serviceId=…&location=…` and nothing else.
 *
 * The select lists the live catalogue from `GET /services` (public, no
 * cookie sent). If the API is down the form still works with "Any service",
 * so the landing page never depends on the backend to render.
 *
 * Signed-out visitors: the landing page has no session awareness on purpose,
 * so the form always goes to the search route. `src/middleware.ts` sends a
 * visitor without a session to `/login?redirect=<that url>`, and the login
 * form returns them through `safeInternalRedirect`.
 *
 * Without JS the native GET submit reaches the same URL; the search page
 * sanitises what it reads either way (`readCustomerSearchSeed`).
 */
export function HeroSearch() {
  const router = useRouter()
  const [services, setServices] = useState<CatalogueService[]>([])

  useEffect(() => {
    let cancelled = false
    apiFetch<unknown>("/services?limit=100", { skipAuth: true, credentials: "omit" })
      .then((data) => {
        if (!cancelled) setServices(toCatalogueOptions(data))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    router.push(buildCustomerSearchHref({ serviceId: data.get("serviceId"), location: data.get("location") }))
  }

  return (
    <form
      action={CUSTOMER_SEARCH_PATH}
      method="get"
      role="search"
      aria-label="Find an artisan"
      onSubmit={onSubmit}
      className="flex flex-wrap gap-2.5 rounded-2xl bg-card p-2.5 text-card-foreground shadow-2xl shadow-black/30"
    >
      <div className="flex min-w-0 flex-[1_1_10rem] flex-col rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring max-sm:flex-[1_1_100%]">
        <label htmlFor="lp-service" className="text-xs font-semibold text-muted-foreground">
          What needs doing?
        </label>
        <select
          id="lp-service"
          name="serviceId"
          defaultValue=""
          className="min-h-11 w-full cursor-pointer border-0 sm:min-h-9 bg-transparent py-1 text-base text-card-foreground outline-none"
        >
          <option value="">Any service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-[1_1_10rem] flex-col rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring max-sm:flex-[1_1_100%] max-sm:rounded-none max-sm:border-t max-sm:border-border sm:border-l sm:border-border">
        <label htmlFor="lp-location" className="text-xs font-semibold text-muted-foreground">
          Where?
        </label>
        <input
          id="lp-location"
          name="location"
          type="text"
          inputMode="text"
          autoComplete="address-level2"
          maxLength={LOCATION_MAX_LENGTH}
          placeholder="e.g. Osu, Accra"
          className="min-h-11 w-full border-0 bg-transparent sm:min-h-9 py-1 text-base text-card-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button
        type="submit"
        className="min-h-13.5 flex-[0_0_auto] cursor-pointer rounded-xl bg-brand px-6 text-base font-semibold text-brand-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card max-sm:flex-[1_1_100%] dark:bg-brand-accent"
      >
        Find artisans
      </button>
    </form>
  )
}
